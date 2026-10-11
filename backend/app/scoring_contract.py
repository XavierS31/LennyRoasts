"""Semantic score checks beyond JSON shape, shared by cached and live paths."""
from math import isclose
from statistics import mean

from .contracts import validate


def validate_score_result(result, submission=None):
    validate('ChallengeResult', result)
    overall = result['challenge_id'] == 'overall'
    expected_keys = {'originality', 'tech_understanding', 'functionality', 'wow'}
    if not overall:
        expected_keys.add('relevance')
    maximum = 20 if overall else 25
    runs = result['runs']
    if {run['run'] for run in runs} != {0, 1, 2}:
        raise ValueError('Scores require three distinct run indices.')
    for run in runs:
        if type(run['run']) is not int or any(type(value) is not int for value in run['criteria'].values()):
            raise ValueError('Run indices and criterion scores must be JSON integers.')
        if set(run['criteria']) != expected_keys or run['max_total'] != maximum:
            raise ValueError('Run criteria/denominator do not match the category.')
        if run['total'] != sum(run['criteria'].values()):
            raise ValueError('Run total is inconsistent with criterion scores.')
        if not isclose(run['score_10'], 10 * run['total'] / maximum, abs_tol=1e-9):
            raise ValueError('Run normalized score is inconsistent.')
        if run['eligible'] != (overall or run['criteria']['relevance'] >= 3):
            raise ValueError('Run eligibility does not match the relevance gate.')
    if set(result['criteria']) != expected_keys or result['max_total'] != maximum:
        raise ValueError('Aggregate criteria/denominator do not match the category.')
    for key in expected_keys:
        if not isclose(result['criteria'][key], mean(run['criteria'][key] for run in runs), abs_tol=1e-9):
            raise ValueError('Aggregate criteria must average all three runs.')
    for key in ['total', 'score_10']:
        if not isclose(result[key], mean(run[key] for run in runs), abs_tol=1e-9):
            raise ValueError('Aggregate total/score must average all three runs.')
    if result['eligible'] != (sum(run['eligible'] for run in runs) >= 2):
        raise ValueError('Aggregate eligibility must use the majority rule.')
    if set(result['evidence']) != expected_keys:
        raise ValueError('Evidence criteria must exactly match the category.')
    if len({run['eligible'] for run in runs}) > 1 and not any('disagree' in warning.lower() for warning in result['warnings']):
        raise ValueError('Eligibility disagreement requires a warning.')
    if submission is not None:
        strings = [value for value in submission.values() if isinstance(value, str)] + submission['built_with']
        for quote in result['evidence'].values():
            if quote != 'not described' and not any(quote in value for value in strings):
                raise ValueError('Displayed evidence must be an exact submission excerpt.')
