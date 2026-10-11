import asyncio
import copy
import json

import httpx
import pytest

from backend.app.contracts import FIXTURES
from backend.app.judge_config import load_config
from backend.app import judging


def raw(overall=False, relevance=3):
    keys = ['originality', 'tech_understanding', 'functionality', 'wow'] + ([] if overall else ['relevance'])
    return {**{k: relevance if k == 'relevance' else 3 for k in keys},
            'rationale': 'The described connections support this score.',
            'evidence': {k: 'not described' for k in keys},
            'improvements': ['Describe which step of the core flow works end to end.']}


def response(value, finish='stop'):
    return {'model': 'Qwen/Qwen3-32B', 'choices': [{'finish_reason': finish, 'message': {'content': json.dumps(value)}}]}


def install_transport(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr(judging.httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    monkeypatch.setenv('HF_TOKEN', 'synthetic-test-token')


def test_three_runs_all_eight_and_no_hidden_metadata(monkeypatch):
    calls = []
    def handler(request):
        data = json.loads(request.content)
        calls.append(data)
        assert data['model'] == 'Qwen/Qwen3-32B:deepinfra'
        assert data['max_tokens'] == 1200
        assert '/no_think' in data['messages'][1]['content']
        assert 'seed_ids' not in data['messages'][1]['content']
        return httpx.Response(200, json=response(raw(data['response_format']['json_schema']['name'] == 'OverallJudgeResponse')))
    install_transport(monkeypatch, handler)
    config = load_config()
    results = asyncio.run(judging.score_submission(FIXTURES['request']['submission'], list(config['prompts']), config))
    assert len(calls) == 24 and len(results) == 8
    assert all(r['placement'] is None and r['rivals'] == [] and r['improvements'] == raw()['improvements'] for r in results)
    assert next(r for r in results if r['challenge_id']=='overall')['max_total'] == 20


def test_means_majority_and_quotes():
    runs = [raw(relevance=v) for v in [2, 3, 4]]
    runs[1]['evidence']['wow'] = 'invented quote'
    runs[1]['improvements'] = ['Run nearest the mean supplies the improvements.']
    r = judging.aggregate('best_game', runs, FIXTURES['request']['submission'])
    assert r['eligible'] and r['criteria']['relevance'] == 3
    assert r['evidence']['wow'] == 'not described'
    assert len(r['warnings']) == 2
    assert r['score_10'] == 6
    assert r['improvements'] == ['Run nearest the mean supplies the improvements.']


@pytest.mark.parametrize('change', ['extra', 'fraction', 'truncated', 'sentences', 'wrong_evidence', 'no_improvements', 'many_improvements', 'long_improvement'])
def test_raw_rejections(change):
    value = raw()
    if change == 'extra': value['eligible'] = True
    if change == 'fraction': value['wow'] = 3.5
    if change == 'sentences': value['rationale'] = 'One. Two. Three.'
    if change == 'wrong_evidence': value['evidence'].pop('wow')
    if change == 'no_improvements': value['improvements'] = []
    if change == 'many_improvements': value['improvements'] = ['Add one.', 'Add two.', 'Add three.', 'Add four.']
    if change == 'long_improvement': value['improvements'] = ['x' * 301]
    with pytest.raises(judging.JudgeFailure):
        judging.parse_response(response(value, 'length' if change == 'truncated' else 'stop'), 'CategoryJudgeResponse')


def test_retry_invalid_then_success(monkeypatch):
    calls=[]
    def handler(request):
        calls.append(1)
        return httpx.Response(200,json={'model':'Qwen/Qwen3-32B'} if len(calls)<=3 else response(raw(True)))
    install_transport(monkeypatch, handler)
    result=asyncio.run(judging.score_submission(FIXTURES['request']['submission'], ['overall'],load_config()))
    assert len(calls)==6 and len(result)==1


def test_permanent_failure_stops_without_retry(monkeypatch):
    calls=[]
    def handler(request):
        calls.append(1)
        return httpx.Response(401,json={'error':'private provider body'})
    install_transport(monkeypatch,handler)
    with pytest.raises(judging.JudgeFailure,match='HTTP 401'):
        asyncio.run(judging.score_submission(FIXTURES['request']['submission'],['overall'],load_config()))
    assert len(calls)<=3


def test_mock_config_rejected():
    config=load_config();config['judge_version']='mock-pretend-live'
    with pytest.raises(ValueError):
        asyncio.run(judging.score_submission(FIXTURES['request']['submission'],['overall'],config))


def test_unexpected_model_is_permanent(monkeypatch):
    calls=[]
    def handler(request):
        calls.append(1);data=response(raw(True));data['model']='another-model'
        return httpx.Response(200,json=data)
    install_transport(monkeypatch,handler)
    with pytest.raises(judging.JudgeFailure,match='unexpected model'):
        asyncio.run(judging.score_submission(FIXTURES['request']['submission'],['overall'],load_config()))
    assert len(calls)<=3


def test_invalid_provider_json_exhausts_bounded_retries(monkeypatch):
    calls=[]
    def handler(request):
        calls.append(1)
        return httpx.Response(200,content=b'{truncated')
    install_transport(monkeypatch,handler)
    with pytest.raises(judging.JudgeFailure):
        asyncio.run(judging.score_submission(FIXTURES['request']['submission'],['overall'],load_config()))
    assert 3 <= len(calls) <= 9  # Remaining runs are cancelled on the first exhausted run.


def test_raw_schema_is_part_of_frozen_config():
    config=load_config();config['prompts']['overall']+=' changed-schema'
    with pytest.raises(ValueError,match='schema differs'):
        asyncio.run(judging.score_submission(FIXTURES['request']['submission'],['overall'],config))
