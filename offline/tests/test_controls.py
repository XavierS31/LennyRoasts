import copy
import json

from offline import config, controls

FIXTURES = json.loads((config.ROOT / "contracts" / "fixtures.json").read_text(encoding="utf-8"))
RESULTS = FIXTURES["completed"]["result"]["challenge_results"]
CONTROL = {
    "id": "fixture-control",
    "submission": FIXTURES["request"]["submission"],
    "expect": {
        "gemini": {"eligible": True, "min": {"relevance": 3.5}, "max": {"functionality": 4}},
        "best_game": {"eligible": False},
    },
}


def test_committed_controls_are_valid_and_unique():
    committed = controls.controls()
    assert len({c["id"] for c in committed}) == len(committed)
    assert [p for c in committed for p in controls.definition_problems(c)] == []


def test_committed_controls_cover_the_issue_pairs():
    outcomes = {(category, e.get("eligible")) for c in controls.controls() for category, e in c["expect"].items()}
    assert {("best_game", True), ("best_game", False), ("best_ai", True), ("best_ai", False),
            ("most_useful", True), ("most_useful", False), ("bny", True)} <= outcomes
    incomplete = {category for c in controls.controls() for category, e in c["expect"].items()
                  if e.get("eligible") and "functionality" in e.get("max", {})}
    assert {"elevenlabs", "databricks"} <= incomplete


def test_definition_problems_reject_unusable_expectations():
    broken = copy.deepcopy(CONTROL)
    broken["submission"]["challenges"] = []
    broken["expect"] = {"gemini": {"eligible": True}, "neon": {"eligible": False},
                        "overall": {"min": {"relevance": 3}}}
    problems = controls.definition_problems(broken)
    assert any("without opting into it" in p for p in problems)
    assert any("unknown category neon" in p for p in problems)
    assert any("overall has no criterion relevance" in p for p in problems)
    assert controls.definition_problems(dict(CONTROL, expect={}))


def test_matching_results_pass():
    assert controls.definition_problems(CONTROL) == []
    assert controls.outcome_problems(CONTROL, RESULTS) == []


def test_eligibility_and_bound_mismatches_are_reported():
    strict = copy.deepcopy(CONTROL)
    strict["expect"] = {
        "gemini": {"eligible": False, "min": {"relevance": 5}, "max": {"functionality": 2}},
        "best_game": {"eligible": True},
    }
    problems = controls.outcome_problems(strict, RESULTS)
    assert len(problems) == 4
    assert "gemini: eligible=True, expected False" in problems
    assert "gemini: mean relevance 4.00 < 5" in problems
    assert "gemini: mean functionality 4.00 > 2" in problems
    assert "best_game: eligible=False, expected True" in problems
