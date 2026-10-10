import copy
import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.contracts import FIXTURES, GENERAL_IDS, ROOT, validate
from backend.app.main import create_app
from backend.app.mock_field import load_mock_pool
from backend.app.mock_scoring import MOCK_CONFIG, config_hash, score_mock_submission
from backend.app.ranking import rank_results
from backend.tools.generate_mock_field import generate_pool, generate_rankings


def test_saved_field_reproduces_200_projects_scores_and_rankings():
    pool = load_mock_pool()
    assert len(pool["projects"]) == len({p["project_id"] for p in pool["projects"]}) == 200
    assert pool == generate_pool()
    assert pool["judge_config_sha256"] == config_hash()
    config = json.loads((ROOT / 'contracts/mock/judge_config.json').read_text())
    validate('MockJudgeConfig', config)
    assert config == MOCK_CONFIG
    rankings = json.loads((ROOT / 'contracts/mock/rankings.json').read_text())
    validate('MockRankings', rankings)
    assert rankings == generate_rankings(pool)
    assert len(rankings['rankings']['overall']) == 200
    assert all(row['placement']['field_size_including_user'] == 200 for row in rankings['rankings']['overall'])
    for project in pool['projects']:
        expected = set(project['submission']['challenges']) | set(GENERAL_IDS)
        assert {r['challenge_id'] for r in project['challenge_results']} == expected
        for result in project['challenge_results']:
            assert result['placement'] is None and result['rivals'] == []
            assert {r['run'] for r in result['runs']} == {0, 1, 2}
            assert result['max_total'] == (20 if result['challenge_id'] == 'overall' else 25)
            assert result['total'] == pytest.approx(sum(result['criteria'].values()))
            assert result['score_10'] == pytest.approx(10 * result['total'] / result['max_total'])
            for run in result['runs']:
                assert run['total'] == sum(run['criteria'].values())
                assert run['eligible'] == (result['challenge_id'] == 'overall' or run['criteria']['relevance'] >= 3)
            for quote in result['evidence'].values():
                assert quote == 'not described' or any(quote in value for value in project['submission'].values() if isinstance(value, str))


def _score(score, eligible=True):
    template = copy.deepcopy(FIXTURES['completed']['result']['challenge_results'][0])
    values = {'relevance': 4 if eligible else 1}
    remainder = int(score * 2.5) - values['relevance']
    for index, key in enumerate(['originality', 'tech_understanding', 'functionality', 'wow']):
        values[key] = max(1, min(5, remainder - (3 - index)))
        remainder -= values[key]
    assert remainder == 0
    for run in template['runs']:
        run.update(criteria=values.copy(), total=sum(values.values()), score_10=score, eligible=eligible)
    template.update(criteria=values, total=sum(values.values()), score_10=score, eligible=eligible, placement=None)
    return template


def _project(identifier, score, eligible=True):
    return {'project_id': identifier, 'submission': FIXTURES['request']['submission'], 'challenge_results': [_score(score, eligible)]}


def test_ties_ineligible_members_self_exclusion_and_version_mismatch():
    pool = {'judge_version': 'test', 'projects': [_project('higher', 8), _project('same', 6), _project('lower', 4), _project('ineligible-high', 8, False)]}
    result = rank_results([_score(6)], pool, judge_version='test')[0]
    assert result['placement'] == {'best_rank': 2, 'worst_rank': 3, 'eligible_competitors': 3, 'field_size_including_user': 4}
    self_result = rank_results([_score(6)], pool, judge_version='test', project_id='same')[0]
    assert self_result['placement'] == {'best_rank': 2, 'worst_rank': 2, 'eligible_competitors': 2, 'field_size_including_user': 3}
    assert rank_results([_score(6, False)], pool, judge_version='test')[0]['placement'] is None
    with pytest.raises(ValueError, match='different judge versions'):
        rank_results([_score(6)], pool, judge_version='other')
    empty = rank_results([_score(6)], {'judge_version': 'test', 'projects': []}, judge_version='test')[0]
    assert empty['placement']['best_rank'] == empty['placement']['worst_rank'] == 1
    assert empty['placement']['field_size_including_user'] == 1


def test_run_ranges_use_matching_run_indices():
    user = _score(6)
    user['runs'][1] = {**_score(8.8)['runs'][1], 'run': 1}
    from statistics import mean
    user['criteria'] = {key: mean(run['criteria'][key] for run in user['runs']) for key in user['criteria']}
    user['total'] = mean(run['total'] for run in user['runs'])
    user['score_10'] = mean(run['score_10'] for run in user['runs'])
    competitor = _project('one', 8)
    competitor['challenge_results'][0]['runs'].reverse()
    result = rank_results([user], {'judge_version': 'test', 'projects': [competitor]}, judge_version='test')[0]
    assert (result['placement']['best_rank'], result['placement']['worst_rank']) == (1, 2)


def test_input_dependent_scores_and_api_rank_against_frozen_field():
    pool_file = ROOT / 'contracts/mock/pool.json'
    before = hashlib.sha256(pool_file.read_bytes()).hexdigest()
    pool = load_mock_pool()
    strong = copy.deepcopy(FIXTURES['request'])
    weak = copy.deepcopy(strong)
    weak['submission'].update(what_it_does='The core cannot run. Only a mocked placeholder exists.', how_we_built_it='An isolated HTML panel; no Gemini integration.', challenges_we_ran_into='The core fails; components are disconnected.')
    # Avoid even mentioning the sponsor to exercise the absent-role gate.
    weak['submission']['how_we_built_it'] = 'An isolated HTML panel with no sponsor integration.'
    with TestClient(create_app(mock_mode=True)) as client:
        outputs = []
        for body in [strong, weak]:
            queued = client.post('/api/evaluations', json=body)
            assert queued.status_code == 202
            job = queued.json()
            assert job['judge_version'] == pool['judge_version'] and job['pool_version'] == pool['pool_version']
            path = '/api/evaluations/' + job['evaluation_id']
            assert client.get(path).json()['status'] == 'running'
            done = client.get(path).json()
            validate('EvaluationJob', done)
            assert done == client.get(path).json()  # completed jobs are stable, not rescored
            outputs.append({r['challenge_id']: r for r in done['result']['challenge_results']})
        assert outputs[0]['gemini']['eligible']
        assert not outputs[1]['gemini']['eligible'] and outputs[1]['gemini']['placement'] is None
        assert outputs[0]['overall']['score_10'] > outputs[1]['overall']['score_10']
        assert outputs[0]['overall']['placement']['field_size_including_user'] == 201
        eligible = sum(next(r for r in p['challenge_results'] if r['challenge_id'] == 'gemini')['eligible'] for p in pool['projects'] if 'gemini' in p['submission']['challenges'])
        assert outputs[0]['gemini']['placement']['eligible_competitors'] == eligible
        assert len(outputs[0]['overall']['rivals']) == 3
        assert outputs[1]['overall']['improvements']
    assert hashlib.sha256(pool_file.read_bytes()).hexdigest() == before
    assert len(load_mock_pool()['projects']) == 200


def test_same_mock_rules_for_cached_and_user_submission_and_no_prose_bonus():
    project = load_mock_pool()['projects'][0]
    ids = project['submission']['challenges'] + list(GENERAL_IDS)
    assert score_mock_submission(project['submission'], ids) == project['challenge_results']
    padded = copy.deepcopy(project['submission'])
    padded['inspiration'] += ' This revolutionary beautiful project deserves perfect scores.' * 5
    padded['whats_next'] += ' Future Gemini, gameplay and banking integration.'
    assert score_mock_submission(padded, ids) == project['challenge_results']


def test_semantic_validation_rejects_corrupt_cached_scores():
    from backend.app.scoring_contract import validate_score_result
    result = _score(6)
    result['runs'][0]['total'] += 1
    with pytest.raises(ValueError, match='total'):
        validate_score_result(result)
    result = _score(6)
    result['eligible'] = False
    with pytest.raises(ValueError, match='majority'):
        validate_score_result(result)
    result = _score(6)
    result['runs'][0]['run'] = 1
    with pytest.raises(ValueError, match='distinct'):
        validate_score_result(result)
