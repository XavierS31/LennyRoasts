import copy
from datetime import timedelta

import pytest
from sqlalchemy import create_engine, select, update, func
from sqlalchemy.pool import StaticPool

from backend.app.database import Store, metadata, configs, pools, projects, scores, jobs, users, utcnow
from backend.app.field_import import validate_artifact
from backend.app.judge_config import config_hash
from backend.tests.live_helpers import replay_field


@pytest.fixture
def store(tmp_path):
    engine=create_engine('sqlite:///' + str(tmp_path/'replay.db'),connect_args={'check_same_thread':False})
    metadata.create_all(engine)
    yield Store(engine)
    engine.dispose()


def test_idempotent_immutable_import_and_exact_counts(store):
    artifact,config=replay_field()
    assert not store.import_field(artifact,config)['idempotent']
    assert store.import_field(artifact,config)['idempotent']
    assert store.field()==(artifact,config)
    with store.engine.connect() as db:
        assert db.execute(select(func.count()).select_from(scores)).scalar()==15
    changed=copy.deepcopy(artifact);changed['projects'][0]['submission']['name']='Changed'
    with pytest.raises(ValueError,match='immutable'):store.import_field(changed,config)
    config=copy.deepcopy(config);config['prompts']['overall']='Reviewed clarification. '+config['prompts']['overall']
    changed=copy.deepcopy(artifact);changed['judge_config_sha256']=config_hash(config)
    with pytest.raises(ValueError,match='immutable'):store.import_field(changed,config)
    assert store.field()[0]==artifact


@pytest.mark.parametrize('case',['hash','coverage','total','quote','fit','duplicate','enriched','run','provisional','mock','timestamp','seed','integer'])
def test_invalid_import_atomic(store,case):
    a,c=replay_field();r=a['projects'][0]['challenge_results'][0]
    if case=='hash':a['judge_config_sha256']='0'*64
    if case=='coverage':a['projects'][0]['challenge_results'].pop()
    if case=='total':r['total']+=1
    if case=='quote':r['evidence']['wow']='invented excerpt'
    if case=='fit':a['projects'][0]['meta']['fit']={}
    if case=='duplicate':a['projects'].append(copy.deepcopy(a['projects'][0]))
    if case=='enriched':r['improvements']=['Enriched']
    if case=='run':r['runs'][1]['run']=0
    if case=='provisional':c['judge_version']='provisional-judge'
    if case=='mock':a['pool_version']='mock-pool'
    if case=='timestamp':a['projects'][0]['meta']['created_at']='not a date'
    if case=='seed':a['projects'][0]['meta']['seed_ids'].append('unexpected')
    if case=='integer':r['runs'][0]['criteria']['wow']=3.0
    with pytest.raises(Exception):store.import_field(a,c)
    with store.engine.connect() as db:
        assert db.execute(select(func.count()).select_from(configs)).scalar()==0
        assert db.execute(select(func.count()).select_from(pools)).scalar()==0


def test_version_snapshot_private_restart_retention(store):
    a,c=replay_field();store.import_field(a,c)
    job=store.create_job('owner',a,c,a['projects'][0]['submission'])
    assert store.read_job(job['evaluation_id'],'stranger') is None
    assert store.claim(job['evaluation_id'])['status']=='running'
    assert store.claim(job['evaluation_id']) is None
    newer=copy.deepcopy(a);newer['pool_version']='test-replay-field-v2';newer['projects'][0]['meta']['pool_version']=newer['pool_version']
    store.import_field(newer,c)
    assert store.read_job(job['evaluation_id'],'owner')['pool_version']==a['pool_version']
    assert store.field(a['pool_version'])[0]==a
    Store(store.engine).recover()
    assert store.read_job(job['evaluation_id'],'owner')['status']=='failed'
    with store.engine.connect() as db:
        assert db.execute(select(users.c.submission)).scalar() is None
    with store.engine.begin() as db:
        db.execute(update(jobs).values(expires_at=utcnow()-timedelta(seconds=1)))
        db.execute(update(users).values(expires_at=utcnow()-timedelta(seconds=1)))
    store.expire()
    assert store.read_job(job['evaluation_id'],'owner') is None
    with store.engine.connect() as db:
        assert db.execute(select(func.count()).select_from(users)).scalar()==0


def test_session_limits(store):
    a,c=replay_field();store.import_field(a,c)
    job=store.create_job('owner',a,c,a['projects'][0]['submission'])
    with pytest.raises(ValueError):store.create_job('owner',a,c,a['projects'][0]['submission'])
    assert store.claim(job['evaluation_id'])
    store.finish(job['evaluation_id'],result={'challenge_results':a['projects'][0]['challenge_results']})
    assert store.read_job(job['evaluation_id'],'owner')['status']=='completed'
