"""SQLAlchemy 2 / psycopg 3 storage. Runtime never creates its own schema."""
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets

from sqlalchemy import (MetaData, Table, Column, String, Integer, DateTime, JSON,
                        ForeignKey, CheckConstraint, create_engine, select, insert, update, delete, func)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import make_url

from .field_import import validate_artifact
from .judge_config import config_hash
from .settings import load_environment

metadata = MetaData()
json_type = JSON(none_as_null=True).with_variant(JSONB(none_as_null=True), 'postgresql')
configs = Table('judge_configs', metadata,
    Column('judge_version',String(100),primary_key=True), Column('config_sha256',String(64),nullable=False),
    Column('config',json_type,nullable=False))
pools = Table('field_versions',metadata,
    Column('pool_version',String(100),primary_key=True), Column('judge_version',String(100),ForeignKey('judge_configs.judge_version'),nullable=False),
    Column('artifact_sha256',String(64),nullable=False), Column('manifest',json_type,nullable=False))
projects = Table('pool_projects',metadata,
    Column('pool_version',String(100),ForeignKey('field_versions.pool_version'),primary_key=True),
    Column('project_id',String(100),primary_key=True), Column('position',Integer,nullable=False), Column('submission',json_type,nullable=False), Column('meta',json_type,nullable=False),
    Column('challenge_results',json_type,nullable=False))
scores = Table('scores',metadata,
    Column('pool_version',String(100),ForeignKey('field_versions.pool_version'),primary_key=True),
    Column('project_id',String(100),primary_key=True), Column('challenge_id',String(100),primary_key=True),
    Column('run',Integer,primary_key=True), Column('judge_version',String(100),ForeignKey('judge_configs.judge_version'),nullable=False),
    Column('score',json_type,nullable=False), CheckConstraint('run IN (0, 1, 2)'))
active = Table('active_field',metadata,Column('slot',Integer,primary_key=True),
    Column('pool_version',String(100),ForeignKey('field_versions.pool_version'),nullable=False),CheckConstraint('slot = 1'))
users = Table('user_projects',metadata,Column('id',String(100),primary_key=True),Column('session_hash',String(64),nullable=False,index=True),
    Column('submission',json_type,nullable=True),Column('created_at',DateTime(timezone=True),nullable=False),Column('expires_at',DateTime(timezone=True),nullable=False))
jobs = Table('evaluation_jobs',metadata,Column('id',String(100),ForeignKey('user_projects.id',ondelete='CASCADE'),primary_key=True),
    Column('session_hash',String(64),nullable=False,index=True),
    Column('judge_version',String(100),ForeignKey('judge_configs.judge_version'),nullable=False),
    Column('pool_version',String(100),ForeignKey('field_versions.pool_version'),nullable=False),
    Column('status',String(20),nullable=False),Column('result',json_type),Column('error',json_type),
    Column('created_at',DateTime(timezone=True),nullable=False),Column('expires_at',DateTime(timezone=True),nullable=False),
    CheckConstraint("status IN ('queued','running','completed','failed')"))


class StorageUnavailable(RuntimeError):
    pass


def make_engine(*, direct=False):
    load_environment()
    name = 'DATABASE_URL_DIRECT' if direct else 'DATABASE_URL'
    value = os.getenv(name)
    if not value:
        raise StorageUnavailable(f'{name} is not configured.')
    try:
        url = make_url(value)
        if url.get_backend_name() not in {'postgres', 'postgresql'} or not url.host or not url.host.endswith('.neon.tech'):
            raise ValueError('Not a Neon PostgreSQL connection')
        if url.query.get('sslmode') not in {'require','verify-ca','verify-full'}:
            raise ValueError('TLS required')
        url = url.set(drivername='postgresql+psycopg')
        return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=0, hide_parameters=True,
                             connect_args={'connect_timeout':10})
    except (ValueError, TypeError):
        raise StorageUnavailable(f'{name} must be a Neon PostgreSQL URL with TLS settings.') from None


def utcnow():
    return datetime.now(timezone.utc)


def session_hash(value):
    return hashlib.sha256(value.encode()).hexdigest()


def wire_job(row):
    return dict(evaluation_id=row['id'],contract_version='1.0.0',judge_version=row['judge_version'],
                pool_version=row['pool_version'],status=row['status'],result=row['result'],error=row['error'])


class Store:
    def __init__(self, engine):
        self.engine = engine
        self.worker_lock = None
        self._fields = {}

    def import_field(self, artifact, config, *, activate=True):
        from .judge_config import canonical_json
        validate_artifact(artifact,config)
        digest = hashlib.sha256(canonical_json(artifact).encode()).hexdigest()
        version = artifact['pool_version']
        with self.engine.begin() as db:
            if db.dialect.name == 'postgresql':
                # Serialize imports, including first activation and version races.
                db.exec_driver_sql('SELECT pg_advisory_xact_lock(190991, 1)')
            existing_config = db.execute(select(configs).where(configs.c.judge_version == config['judge_version'])).mappings().first()
            if existing_config and existing_config['config_sha256'] != config_hash(config):
                raise ValueError('Judge version is immutable; use a new version and rescore.')
            previous = db.execute(select(pools).where(pools.c.pool_version == version)).mappings().first()
            if previous and previous['artifact_sha256'] != digest:
                raise ValueError('Pool version is immutable; different contents rejected.')
            if not existing_config:
                db.execute(insert(configs).values(judge_version=config['judge_version'],config_sha256=config_hash(config),config=config))
            if not previous:
                manifest = {k:v for k,v in artifact.items() if k != 'projects'}
                db.execute(insert(pools).values(pool_version=version,judge_version=config['judge_version'],artifact_sha256=digest,manifest=manifest))
                for position, p in enumerate(artifact['projects']):
                    db.execute(insert(projects).values(pool_version=version,position=position,**p))
                    for result in p['challenge_results']:
                        for run in result['runs']:
                            db.execute(insert(scores).values(pool_version=version,project_id=p['project_id'],challenge_id=result['challenge_id'],
                                run=run['run'],judge_version=config['judge_version'],score=run))
            if activate:
                current = db.execute(select(active.c.slot)).first()
                if current:
                    db.execute(update(active).where(active.c.slot==1).values(pool_version=version))
                else:
                    db.execute(insert(active).values(slot=1,pool_version=version))
        return {'pool_version':version,'judge_version':config['judge_version'],'idempotent':bool(previous)}

    def field(self, pool_version=None):
        with self.engine.connect() as db:
            if pool_version is None:
                pool_version = db.execute(select(active.c.pool_version).where(active.c.slot==1)).scalar_one_or_none()
            if pool_version is None:
                return None
            if pool_version in self._fields:
                return copy.deepcopy(self._fields[pool_version])
            row=db.execute(select(pools,configs.c.config,configs.c.config_sha256).join(configs).where(pools.c.pool_version==pool_version)).mappings().one()
            artifact=copy.deepcopy(row['manifest'])
            artifact['projects']=[{k:p[k] for k in ('project_id','submission','meta','challenge_results')} for p in db.execute(select(projects).where(projects.c.pool_version==pool_version).order_by(projects.c.position)).mappings()]
            validate_artifact(artifact,row['config'])
            from .judge_config import canonical_json
            if hashlib.sha256(canonical_json(artifact).encode()).hexdigest() != row['artifact_sha256']:
                raise StorageUnavailable('Stored field integrity check failed.')
            self._fields[pool_version] = (artifact,row['config'])
            return copy.deepcopy(self._fields[pool_version])

    def acquire_worker(self):
        if self.engine.dialect.name != 'postgresql':
            return  # Replay engine only; production factory accepts Neon exclusively.
        self.worker_lock=self.engine.connect()
        if not self.worker_lock.exec_driver_sql('SELECT pg_try_advisory_xact_lock(190991, 2)').scalar():
            self.worker_lock.close();self.worker_lock=None
            raise StorageUnavailable('Another live API worker owns this database; run one instance.')

    def release_worker(self):
        if self.worker_lock is not None:
            # Transaction lock also works through Neon's transaction pooler.
            self.worker_lock.rollback()
            self.worker_lock.close();self.worker_lock=None

    def check_worker(self):
        if self.engine.dialect.name == 'postgresql':
            if self.worker_lock is None or not self.worker_lock.in_transaction():
                raise StorageUnavailable('Live worker lock was lost.')
            self.worker_lock.exec_driver_sql('SELECT 1')

    def recover(self):
        error=dict(code='INTERRUPTED',message='The server restarted during evaluation. Please submit again.',details=[])
        with self.engine.begin() as db:
            interrupted=list(db.execute(select(jobs.c.id).where(jobs.c.status.in_(['queued','running']))).scalars())
            if interrupted:
                db.execute(update(jobs).where(jobs.c.id.in_(interrupted)).values(status='failed',result=None,error=error))
                db.execute(update(users).where(users.c.id.in_(interrupted)).values(submission=None))
        self.expire()

    def expire(self):
        with self.engine.begin() as db:
            db.execute(delete(jobs).where(jobs.c.expires_at <= utcnow()))
            db.execute(delete(users).where(users.c.expires_at <= utcnow()))

    def create_job(self, owner, pool, config, submission):
        now=utcnow();digest=session_hash(owner)
        with self.engine.begin() as db:
            if db.dialect.name=='postgresql':
                db.exec_driver_sql('SELECT pg_advisory_xact_lock(190991, 3)')
            outstanding=db.execute(select(func.count()).select_from(jobs).where(jobs.c.status.in_(['queued','running']),jobs.c.expires_at>now)).scalar_one()
            recent=db.execute(select(func.count()).select_from(jobs).where(jobs.c.session_hash==digest,jobs.c.created_at>now-timedelta(minutes=10))).scalar_one()
            own=db.execute(select(func.count()).select_from(jobs).where(jobs.c.session_hash==digest,jobs.c.status.in_(['queued','running']),jobs.c.expires_at>now)).scalar_one()
            if outstanding>=8 or recent>=3 or own>=1:
                raise ValueError('Evaluation limit reached. Try again after current work completes.')
            identifier=secrets.token_urlsafe(24);expires=now+timedelta(hours=1)
            db.execute(insert(users).values(id=identifier,session_hash=digest,submission=submission,created_at=now,expires_at=expires))
            values=dict(id=identifier,session_hash=digest,judge_version=config['judge_version'],pool_version=pool['pool_version'],status='queued',result=None,error=None,created_at=now,expires_at=expires)
            db.execute(insert(jobs).values(**values))
        return wire_job(values)

    def read_job(self, identifier, owner):
        with self.engine.connect() as db:
            row=db.execute(select(jobs).where(jobs.c.id==identifier,jobs.c.session_hash==session_hash(owner),jobs.c.expires_at>utcnow())).mappings().first()
            return wire_job(row) if row else None

    def claim(self, identifier):
        with self.engine.begin() as db:
            changed=db.execute(update(jobs).where(jobs.c.id==identifier,jobs.c.status=='queued',jobs.c.expires_at>utcnow()).values(status='running'))
            if changed.rowcount!=1: return None
            row=db.execute(select(jobs,users.c.submission).join(users).where(jobs.c.id==identifier)).mappings().one()
            return dict(row)

    def finish(self, identifier, *, result=None, error=None):
        with self.engine.begin() as db:
            db.execute(update(jobs).where(jobs.c.id==identifier,jobs.c.status=='running').values(status='failed' if error else 'completed',result=result,error=error))
            db.execute(update(users).where(users.c.id==identifier).values(submission=None))
