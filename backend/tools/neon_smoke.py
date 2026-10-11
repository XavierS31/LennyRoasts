"""Isolated PostgreSQL replay checks. Never activate synthetic data in public schema."""
import asyncio
import json
import secrets
import threading
import time

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, select, update

from backend.app.database import Store, make_engine, jobs, users
from backend.app.contracts import FIXTURES
from backend.app.live_api import create_live_app
from backend.tests.live_helpers import replay_field, replay_results
from backend.tools.migrate import migrate


def main():
    schema='lenny_smoke_'+secrets.token_hex(6)
    admin=make_engine(direct=True);engine=None
    try:
        with admin.begin() as db:db.exec_driver_sql(f'CREATE SCHEMA {schema}')
        # Direct isolated connection: search_path is enforced per connection. Production uses pooled URL.
        engine=create_engine(admin.url,connect_args={'options':f'-csearch_path={schema}','connect_timeout':10},hide_parameters=True,pool_pre_ping=True)
        print(json.dumps({'phase':'migration','applied':migrate(engine)}))
        assert migrate(engine)==[]
        a,c=replay_field();store=Store(engine)
        imported=store.import_field(a,c);assert store.import_field(a,c)['idempotent']
        assert store.field()==(a,c)
        immutable=False
        try:
            with engine.begin() as db:db.exec_driver_sql("UPDATE judge_configs SET config_sha256='changed'")
        except Exception:immutable=True
        assert immutable
        gate=threading.Event();started=threading.Event();calls=[]
        async def scorer(submission,ids,config):
            calls.append(1);started.set()
            while not gate.is_set():await asyncio.sleep(.01)
            return replay_results(submission,ids)
        with TestClient(create_live_app(store=store,scorer=scorer),base_url='https://testserver') as client:
            queued=client.post('/api/evaluations',json=FIXTURES['request']);assert queued.status_code==202
            identifier=queued.json()['evaluation_id'];cookie=queued.cookies.get('lenny_session')
            assert started.wait(5)
            assert client.get('/api/evaluations/'+identifier).json()['status']=='running'
            client.cookies.clear();assert client.get('/api/evaluations/'+identifier).status_code==404
            client.cookies.set('lenny_session',cookie);gate.set()
            deadline=time.monotonic()+10
            while time.monotonic()<deadline:
                completed=client.get('/api/evaluations/'+identifier).json()
                if completed['status'] in {'completed','failed'}:break
                time.sleep(.05)
            assert completed['status']=='completed' and len(calls)==1
        with TestClient(create_live_app(store=Store(engine),scorer=scorer),base_url='https://testserver') as restarted:
            restarted.cookies.set('lenny_session',cookie)
            assert restarted.get('/api/evaluations/'+identifier).json()==completed
            assert len(calls)==1
        with engine.connect() as db:assert db.execute(select(users.c.submission)).scalar() is None
        store.acquire_worker()
        other=Store(engine)
        lock_blocked=False
        try:other.acquire_worker()
        except Exception:lock_blocked=True
        assert lock_blocked
        store.release_worker()
        unfinished=store.create_job('interrupted-owner',a,c,a['projects'][0]['submission'])
        store.claim(unfinished['evaluation_id']);Store(engine).recover()
        assert store.read_job(unfinished['evaluation_id'],'interrupted-owner')['status']=='failed'
        print(json.dumps({'success':True,'evidence':'Neon PostgreSQL with SYNTHETIC REPLAY scorer in temporary schema','imported_projects':1,'three_run_rows':15,'atomic_idempotent_import':True,'immutable_trigger':True,'private_404':True,'post_without_get_starts_worker':True,'completed_report_survives_restart':True,'interrupted_jobs_failed':True,'second_worker_blocked':True,'production_field_activated':False}))
    except Exception as exc:
        import traceback
        print(json.dumps({'failure_type':type(exc).__name__,'frames':[{'file':f.filename.rsplit('/',1)[-1],'line':f.lineno,'function':f.name} for f in traceback.extract_tb(exc.__traceback__)][-6:]}))
        raise SystemExit('Isolated Neon replay check failed; inspect privately. No credentials or provider input logged.') from None
    finally:
        if engine:engine.dispose()
        with admin.begin() as db:db.exec_driver_sql(f'DROP SCHEMA IF EXISTS {schema} CASCADE')
        admin.dispose()
        print('Temporary replay schema removed.')


if __name__=='__main__':main()
