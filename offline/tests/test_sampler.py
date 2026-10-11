from offline import config, sampler

SETTINGS = config.settings()
CHALLENGES = config.challenges()
SEEDS = {
    "g1": {"seed_id": "g1", "pool": "gemini", "skills": ["web", "ai_ml"]},
    "g2": {"seed_id": "g2", "pool": "gemini", "skills": ["mobile"]},
    "e1": {"seed_id": "e1", "pool": "elevenlabs", "skills": ["ai_ml"]},
    "d1": {"seed_id": "d1", "pool": "databricks", "skills": ["data"]},
    "b1": {"seed_id": "b1", "pool": "bny", "skills": ["web"]},
    "n1": {"seed_id": "n1", "pool": "general", "skills": ["game_dev"]},
    "n2": {"seed_id": "n2", "pool": "general", "skills": ["hardware", "web"]},
}


def test_team_sampling_is_reproducible_per_index():
    assert sampler.sample_team(7, SETTINGS, CHALLENGES) == sampler.sample_team(7, SETTINGS, CHALLENGES)
    assert sampler.sample_team(7, SETTINGS, CHALLENGES) != sampler.sample_team(8, SETTINGS, CHALLENGES)


def test_sampled_teams_respect_config_values():
    for index in range(1, 200):
        team = sampler.sample_team(index, SETTINGS, CHALLENGES)
        assert len(team["challenges"]) == len(set(team["challenges"])) <= 4
        assert set(team["challenges"]) <= set(config.SPONSOR_IDS)
        assert list(team["fit"]) == team["challenges"]
        assert set(team["fit"].values()) <= {"strong", "medium", "weak"}
        strong = [c for c in team["challenges"] if team["fit"][c] == "strong"]
        assert team["primary_pool"] == (strong[0] if strong else "general")
        for attribute, shares in SETTINGS["persona_shares"].items():
            value = team["mutation"] if attribute == "mutation" else team["persona"][attribute]
            assert value in shares


def test_extending_a_field_keeps_existing_teams():
    small = sampler.extend_field([], 5, SEEDS, SETTINGS, CHALLENGES)
    large = sampler.extend_field(small, 12, SEEDS, SETTINGS, CHALLENGES)
    assert large[:5] == small
    assert [t["team_id"] for t in large] == [f"t{i:03d}" for i in range(1, 13)]


def test_seed_use_cap_and_heavy_second_seed_pool():
    teams = sampler.extend_field([], 60, SEEDS, SETTINGS, CHALLENGES)
    uses = {}
    for team in teams:
        for seed_id in team["seed_ids"] or []:
            uses[seed_id] = uses.get(seed_id, 0) + 1
        if team["seed_ids"] is None:
            continue
        assert SEEDS[team["seed_ids"][0]]["pool"] == team["primary_pool"]
        if team["mutation"] == "heavy":
            assert len(team["seed_ids"]) == 2
            assert SEEDS[team["seed_ids"][1]]["pool"] != team["primary_pool"]
        else:
            assert len(team["seed_ids"]) == 1
    assert max(uses.values()) <= SETTINGS["seed_use_cap"]
    assert any(t["seed_ids"] is None for t in teams)


def test_unseeded_teams_get_seeds_when_the_pool_grows():
    teams = sampler.extend_field([], 60, SEEDS, SETTINGS, CHALLENGES)
    waiting = [t["team_id"] for t in teams if t["seed_ids"] is None]
    more = {**SEEDS, **{f"x{i}": {"seed_id": f"x{i}", "pool": pool, "skills": ["web"]}
                        for i, pool in enumerate(["gemini", "elevenlabs", "databricks", "bny", "general"] * 6)}}
    regrown = sampler.extend_field(teams, 60, more, SETTINGS, CHALLENGES)
    assert [t for t in regrown if t["team_id"] not in waiting] == [t for t in teams if t["team_id"] not in waiting]
    assert sum(t["seed_ids"] is None for t in regrown) < len(waiting)
