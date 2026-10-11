import asyncio
import copy
import threading
import time

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.contracts import FIXTURES, validate
from backend.app.database import Store, metadata
from backend.app.live_api import create_live_app
from backend.tests.live_helpers import replay_field, replay_results


@pytest.fixture
def store(tmp_path):
    engine=create_engine('sqlite:///' + str(tmp_path/'replay.db'),connect_args={'check_same_thread':False})
    metadata.create_all(engine)
    s=Store(engine);a,c=replay_field();s.import_field(a,c)
    yield s
    engine.dispose()


def poll(client,identifier):
    deadline=time.monotonic()+4
    while time.monotonic()<deadline:
        response=client.get('/api/evaluations/'+identifier)
        validate('EvaluationJob',response.json())
        if response.json()['status'] in {'completed','failed'}:return response.json()
        time.sleep(.01)
    raise AssertionError('Job did not finish')


def test_actual_worker_without_get_and_private_restart(store):
    started=threading.Event();release=threading.Event();calls=[]
    async def scorer(submission,ids,config):
        calls.append(config['judge_version']);started.set()
        while not release.is_set():await asyncio.sleep(.01)
        return replay_results(submission,ids)
    app=create_live_app(store=store,scorer=scorer)
    with TestClient(app,base_url='https://testserver') as owner:
        body=owner.get('/api/challenges').json();validate('ChallengeList',body)
        assert body['field_ready'] and '1 projects' in body['challenges'][0]['description']
        assert 'funniest' in next(c for c in body['challenges'] if c['id']=='most_useful')['description']
        response=owner.post('/api/evaluations',json=FIXTURES['request'])
        assert response.status_code==202 and response.json()['status']=='queued'
        assert 'HttpOnly' in response.headers['set-cookie'] and 'Secure' in response.headers['set-cookie']
        identifier=response.json()['evaluation_id']
        assert started.wait(2)  # Inference started without GET.
        assert owner.get('/api/evaluations/'+identifier).json()['status']=='running'
        owner.cookies.clear()
        assert owner.get('/api/evaluations/'+identifier).status_code==404
        cookie=response.cookies.get('lenny_session');owner.cookies.set('lenny_session',cookie)
        release.set();completed=poll(owner,identifier)
        assert completed['status']=='completed' and len(calls)==1
        results=completed['result']['challenge_results']
        assert results[0]['placement']['field_size_including_user']==2
        assert len(results[0]['rivals'])==1 and len(results[0]['improvements'])==3
        assert owner.get('/api/evaluations/'+identifier).json()==completed
    with TestClient(create_live_app(store=Store(store.engine),scorer=scorer),base_url='https://testserver') as restarted:
        restarted.cookies.set('lenny_session',cookie)
        assert restarted.get('/api/evaluations/'+identifier).json()==completed
        assert len(calls)==1


def test_failed_provider_no_partial_results(store):
    async def failed(*args):raise RuntimeError('sensitive provider body')
    with TestClient(create_live_app(store=store,scorer=failed)) as client:
        response=client.post('/api/evaluations',json=FIXTURES['request']);identifier=response.json()['evaluation_id']
        result=poll(client,identifier)
        assert result['status']=='failed' and result['result'] is None
        assert 'sensitive' not in str(result)


def test_field_unavailable_limits_and_validation(store):
    async def slow(*args):await asyncio.sleep(10)
    with TestClient(create_live_app(store=store,scorer=slow)) as client:
        assert client.post('/api/evaluations',content=b'{').status_code==422
        assert client.post('/api/evaluations',content=b'x'*128001).status_code==422
        assert client.post('/api/evaluations',json=FIXTURES['request'],headers={'Origin':'https://evil.example'}).status_code==422
        response=client.post('/api/evaluations',json=FIXTURES['request']);assert response.status_code==202
        assert client.post('/api/evaluations',json=FIXTURES['request']).status_code==503
        identifier=response.json()['evaluation_id'];cookie=response.cookies.get('lenny_session')
    with TestClient(create_live_app(store=store,scorer=slow)) as restarted:
        restarted.cookies.set('lenny_session',cookie)
        assert restarted.get('/api/evaluations/'+identifier).json()['status']=='failed'
