"""Apply reviewed versioned SQL with the direct Neon connection."""
import hashlib
from sqlalchemy import text
from backend.app.contracts import ROOT
from backend.app.database import make_engine


def migrate(engine):
    applied=[]
    with engine.begin() as db:
        db.exec_driver_sql('SELECT pg_advisory_xact_lock(190991, 0)')
        db.exec_driver_sql('CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(100) PRIMARY KEY, sha256 varchar(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())')
        for path in sorted((ROOT/'backend/migrations').glob('*.sql')):
            sql=path.read_text();digest=hashlib.sha256(sql.encode()).hexdigest()
            previous=db.execute(text('SELECT sha256 FROM schema_migrations WHERE version=:version'),{'version':path.name}).scalar_one_or_none()
            if previous:
                if previous!=digest: raise ValueError('Applied migration checksum mismatch; add a new migration instead.')
                continue
            # psycopg accepts this complete migration including dollar-quoted functions.
            db.exec_driver_sql(sql,execution_options={'no_parameters':True})
            db.execute(text('INSERT INTO schema_migrations(version,sha256) VALUES (:version,:sha256)'),{'version':path.name,'sha256':digest})
            applied.append(path.name)
    return applied


def main():
    engine=None
    try:
        engine=make_engine(direct=True)
        print('Applied migrations:',migrate(engine))
    except Exception:
        raise SystemExit('Migration failed. Check direct Neon settings/schema permissions privately; credentials are not logged.') from None
    finally:
        if engine: engine.dispose()


if __name__=='__main__': main()
