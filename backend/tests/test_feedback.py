import copy

from backend.app.contracts import FIXTURES
from backend.app.feedback import add_feedback

RESULT = dict(FIXTURES['completed']['result']['challenge_results'][0], placement=None, rivals=[], improvements=[])


def test_judge_improvements_are_kept():
    judged = dict(copy.deepcopy(RESULT), improvements=['Connect the live GPS feed to the route summary.'])
    assert add_feedback([judged])[0]['improvements'] == ['Connect the live GPS feed to the route summary.']


def test_templates_fill_results_without_judge_improvements():
    improvements = add_feedback([copy.deepcopy(RESULT)])[0]['improvements']
    assert 1 <= len(improvements) <= 3
    assert all('averaged' in text and '/5 in the three runs.' in text for text in improvements)
