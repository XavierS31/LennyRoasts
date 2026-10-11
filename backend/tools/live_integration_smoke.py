"""Bounded Qwen → isolated Neon → asynchronous API smoke using one synthetic project.

Not the ten-project Luna field. Never activates data in the public/live schema.
"""
import asyncio
import json
import secrets
import time

from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from backend.app.contracts import FIXTURES, GENERAL_IDS, ROOT
from backend.app.database import Store, make_engine
from backend.app.judge_config import load_config, config_hash
from backend.app.judging import score_submission
from backend.app.live_api import create_live_app
from backend.tests.live_helpers import replay_field
from backend.tools.migrate import migrate


def main():
    schema='lenny_live_smoke_'+secrets.token_hex(6)
    admin=make_engine(direct=True);engine=None
    try:
        config=load_config();config['judge_version']='kh9-qwen32b-v4-isolated-smoke'
        artifact,_=replay_field()
        artifact['judge_version']=config['judge_version'];artifact['judge_config_sha256']=config_hash(config)
        project=artifact['projects'][0]
        project['meta']['model']='synthetic-authored-control'
        # Exactly four automatic categories + Gemini. Same three-run protocol offline/live.
        project['challenge_results']=asyncio.run(score_submission(project['submission'],project['submission']['challenges']+list(GENERAL_IDS),config))
        directory=ROOT/'.local-tests/live-integration-smoke';directory.mkdir(parents=True,exist_ok=True,mode=0o700)
        for name,value in [('config.json',config),('pool.json',artifact)]:
            path=directory/name;path.write_text(json.dumps(value,indent=2,ensure_ascii=False));path.chmod(0o600)
        print(json.dumps({'phase':'live_field_scored','projects':1,'validated_runs':15,'config_hash':config_hash(config)}),flush=True)
        with admin.begin() as db:db.exec_driver_sql(f'CREATE SCHEMA {schema}')
        engine=create_engine(admin.url,connect_args={'options':f'-csearch_path={schema}','connect_timeout':10},hide_parameters=True,pool_pre_ping=True)
        migrate(engine);store=Store(engine);store.import_field(artifact,config)
        with TestClient(create_live_app(store=store),base_url='https://testserver') as client:
            definitions=client.get('/api/challenges').json();assert definitions['field_ready']
            queued=client.post('/api/evaluations',json=FIXTURES['request']);assert queued.status_code==202
            identifier=queued.json()['evaluation_id'];cookie=queued.cookies.get('lenny_session')
            statuses=[queued.json()['status']]
            deadline=time.monotonic()+420
            while time.monotonic()<deadline:
                job=client.get('/api/evaluations/'+identifier).json()
                if job['status']!=statuses[-1]:statuses.append(job['status'])
                if job['status'] in {'completed','failed'}:break
                time.sleep(.5)
            assert job['status']=='completed'
            assert job['judge_version']==config['judge_version'] and job['pool_version']==artifact['pool_version']
            results=job['result']['challenge_results']
            overall=next(r for r in results if r['challenge_id']=='overall')
            assert overall['placement']['field_size_including_user']==2
            client.cookies.clear();assert client.get('/api/evaluations/'+identifier).status_code==404
        with TestClient(create_live_app(store=Store(engine)),base_url='https://testserver') as restarted:
            restarted.cookies.set('lenny_session',cookie)
            assert restarted.get('/api/evaluations/'+identifier).json()==job
        print(json.dumps({'success':True,'evidence':'LIVE Qwen competitor/user scoring + isolated Neon + actual API worker','synthetic_projects':1,'field_and_user_validated_runs':30,'statuses':statuses,'report_survives_restart':True,'private_404':True,'judge_version':config['judge_version'],'pool_version':artifact['pool_version'],'config_hash':config_hash(config),'actual_overall_field_size_including_user':2,'production_field_activated':False}),flush=True)
    except Exception as exc:
        import traceback
        print(json.dumps({'failure_type':type(exc).__name__,'frames':[{'file':f.filename.rsplit('/',1)[-1],'line':f.lineno,'function':f.name} for f in traceback.extract_tb(exc.__traceback__)][-5:]}))
        raise SystemExit('Isolated live integration failed. No partial report or mock fallback was used.') from None
    finally:
        if engine:engine.dispose()
        with admin.begin() as db:db.exec_driver_sql(f'DROP SCHEMA IF EXISTS {schema} CASCADE')
        admin.dispose();print('Temporary live smoke schema removed.',flush=True)


if __name__=='__main__':main()
