import copy
import json

from offline import artifact, config, contract

FIXTURES = json.loads((config.ROOT / "contracts" / "fixtures.json").read_text(encoding="utf-8"))
SUBMISSION = FIXTURES["request"]["submission"]
RESULTS = [dict(r, placement=None, rivals=[], improvements=[])
           for r in FIXTURES["completed"]["result"]["challenge_results"]]
JUDGE_CONFIG = {
    "judge_version": "test-judge-v1",
    "model": "Qwen/Qwen3-32B",
    "provider": "deepinfra",
    "temperature": 0.2,
    "output_mode": "schema",
    "non_thinking": True,
    "max_output_tokens": 1200,
    "runs": 3,
    "eligible_run_min": 2,
    "prompt_version": "test-prompt-v1",
    "rubric_version": "test-rubric-v1",
    "prompts": {cid: f"Judge prompt for {cid} — test" for cid in config.SPONSOR_IDS + config.GENERAL_IDS},
    "reference_example_ids": {cid: [] for cid in config.SPONSOR_IDS + config.GENERAL_IDS},
}
RECORD = {
    "project_id": "kh9-test-t001",
    "submission": SUBMISSION,
    "seed_ids": ["hackusf-2026--preqly"],
    "source_urls": ["https://devpost.com/software/preqly"],
    "mutation": "light",
    "persona": {"skill_focus": "web", "completion": "shaky", "writing_style": "terse"},
    "fit": {"gemini": "strong"},
    "prompt_version": "luna-mutation-v1",
    "model": "test-generator",
    "rng_seed": 20261009001,
    "created_at": "2026-10-10T20:00:00+00:00",
}
SCORES = {"kh9-test-t001": {"challenge_results": RESULTS}}


def test_fixture_results_pass_offline_result_checks():
    assert artifact.result_problems(RESULTS, SUBMISSION) == []


def test_built_artifact_is_contract_valid():
    built = artifact.build([RECORD], SCORES, JUDGE_CONFIG, "kh9-test-n1")
    assert artifact.artifact_problems(built, JUDGE_CONFIG) == []
    assert built["projects"][0]["meta"]["pool_version"] == "kh9-test-n1"
    assert built["judge_config_sha256"] == contract.judge_config_sha256(JUDGE_CONFIG)


def test_artifact_rejects_mismatches():
    built = artifact.build([RECORD], SCORES, JUDGE_CONFIG, "kh9-test-n1")
    tampered = copy.deepcopy(built)
    tampered["projects"][0]["meta"]["fit"] = {"bny": "weak"}
    tampered["projects"][0]["challenge_results"][0]["runs"][0]["total"] = 3 + 4 + 4 + 2 + 5
    tampered["projects"][0]["challenge_results"] = tampered["projects"][0]["challenge_results"][:-1]
    tampered["judge_config_sha256"] = "0" * 64
    problems = "\n".join(artifact.artifact_problems(tampered, JUDGE_CONFIG))
    assert "fit keys" in problems
    assert "Run total is inconsistent with criterion scores" in problems
    assert "challenge ids" in problems
    assert "judge_config_sha256" in problems


def test_placement_or_rivals_are_not_allowed_offline():
    ranked = [dict(r, placement=FIXTURES["completed"]["result"]["challenge_results"][0]["placement"])
              if r["challenge_id"] == "gemini" else r for r in RESULTS]
    assert any("null placement" in p for p in artifact.result_problems(ranked, SUBMISSION))


def test_judge_config_hash_is_canonical():
    reordered = dict(reversed(list(JUDGE_CONFIG.items())))
    assert contract.judge_config_sha256(reordered) == contract.judge_config_sha256(JUDGE_CONFIG)
    encoded = json.dumps(JUDGE_CONFIG, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert "—" in encoded
    assert contract.judge_config_sha256(dict(JUDGE_CONFIG, runs=2)) != contract.judge_config_sha256(JUDGE_CONFIG)
