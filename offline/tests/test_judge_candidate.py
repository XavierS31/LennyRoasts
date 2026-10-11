from offline import config, contract

CANDIDATE = config.load_json(config.CONFIG_DIR / "judge_config_candidate.json")
BACKEND = config.load_json(config.ROOT / "backend" / "config" / "judge_config.json")
VERSION_KEYS = {"judge_version", "prompt_version"}


def test_candidate_is_a_contract_valid_judge_config():
    assert contract.errors("JudgeConfig", CANDIDATE) == []


def test_candidate_changes_only_prompts_and_version_labels():
    protocol = set(BACKEND) - VERSION_KEYS - {"prompts"}
    assert {k: CANDIDATE[k] for k in protocol} == {k: BACKEND[k] for k in protocol}
    assert set(CANDIDATE) == set(BACKEND)
    assert set(CANDIDATE["prompts"]) == set(BACKEND["prompts"])
    assert all(CANDIDATE[k] != BACKEND[k] for k in VERSION_KEYS)
    assert CANDIDATE["judge_version"].endswith("-candidate")


def test_candidate_keeps_each_brief_and_schema_verbatim():
    for cid, challenge in config.challenges().items():
        prompt = CANDIDATE["prompts"][cid]
        assert challenge["description"] in prompt
        assert prompt.split("Response schema: ")[1] == BACKEND["prompts"][cid].split("Response schema: ")[1]
