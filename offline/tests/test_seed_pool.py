from offline import config, seed_pool

SETTINGS = config.settings()
SELECTION = config.seed_sources()
SOURCES = [
    {"pool": "gemini", "hackathon": "hack-a", "hackathon_name": "Hack A", "year": 2026, "prize_id": 1,
     "prize_name": "Best Use of Gemini API"},
    {"pool": "elevenlabs", "hackathon": "hack-a", "hackathon_name": "Hack A", "year": 2026, "prize_id": 2,
     "prize_name": "Best Use of ElevenLabs"},
]
SCOUT = {
    "hack-a:1": {"pool": "gemini", "projects": [
        {"url": "https://devpost.com/software/alpha", "name": "Alpha", "tagline": "", "winner_badge": False},
        {"url": "https://devpost.com/software/beta", "name": "Beta", "tagline": "", "winner_badge": True},
        {"url": "https://devpost.com/software/gamma", "name": "Gamma", "tagline": "", "winner_badge": False},
    ]},
    "hack-a:2": {"pool": "elevenlabs", "projects": [
        {"url": "https://devpost.com/software/alpha", "name": "Alpha", "tagline": "", "winner_badge": False},
        {"url": "https://devpost.com/software/delta", "name": "Delta", "tagline": "", "winner_badge": False},
    ]},
}


def test_candidates_merge_opt_ins_across_scouted_prizes():
    merged = seed_pool.candidates(SCOUT, SOURCES)
    alpha = merged["https://devpost.com/software/alpha"]
    assert alpha["seed_id"] == "hack-a--alpha"
    assert alpha["opted_into"] == ["Best Use of Gemini API", "Best Use of ElevenLabs"]
    assert alpha["pools"] == ["gemini", "elevenlabs"]
    assert merged["https://devpost.com/software/beta"]["winner_badge"] is True
    assert len(merged) == 4


def test_candidate_order_is_reproducible_and_skips_taken_urls():
    merged = seed_pool.candidates(SCOUT, SOURCES)
    first = seed_pool.ordered_candidates("gemini", merged, set(), 7)
    assert first == seed_pool.ordered_candidates("gemini", merged, set(), 7)
    winners, others = first
    assert [c["seed_id"] for c in winners] == ["hack-a--beta"]
    assert {c["seed_id"] for c in others} == {"hack-a--alpha", "hack-a--gamma"}
    _, others = seed_pool.ordered_candidates("gemini", merged, {"https://devpost.com/software/alpha"}, 7)
    assert [c["seed_id"] for c in others] == ["hack-a--gamma"]


def test_pool_needs_count_existing_seeds_and_winner_badges():
    merged = seed_pool.candidates(SCOUT, SOURCES)
    manifest = [{"pool": "gemini", "devpost_url": "https://devpost.com/software/beta"},
                {"pool": "elevenlabs", "devpost_url": "https://devpost.com/software/delta"}]
    assert seed_pool.pool_needs("gemini", manifest, merged, 10, 0.1) == (9, 0)
    assert seed_pool.pool_needs("elevenlabs", manifest, merged, 20, 0.1) == (19, 2)
    assert seed_pool.pool_needs("gemini", manifest, merged, 1, 0.1) == (0, 0)


def test_skills_follow_built_with_tag_counts():
    tags = ["React", "next.js", "Python", "gemini-api", "Firebase"]
    assert seed_pool.skills_from_tags(tags, SELECTION["skill_tags"], 2) == ["web", "ai_ml"]
    assert seed_pool.skills_from_tags(["unity", "c#"], SELECTION["skill_tags"], 2) == ["game_dev"]
    assert seed_pool.skills_from_tags(["cobol"], SELECTION["skill_tags"], 2) == []


def test_reserved_hackathon_listing_is_detected_by_normalized_name():
    assert seed_pool.reserved_listing(["SwampHacks XI", "Knight Hacks VII"], SETTINGS) == "Knight Hacks VII"
    assert seed_pool.reserved_listing(["KnightHacks VIII"], SETTINGS) == "KnightHacks VIII"
    assert seed_pool.reserved_listing(["Knight Hacks VI", "HackUSF 2026"], SETTINGS) is None


def test_configured_sources_avoid_reserved_hackathons_and_cover_every_pool():
    reserved = SETTINGS["split"]["judge_example_hackathons"] + SETTINGS["split"]["holdout_hackathons"]
    assert not [s for s in SELECTION["sources"] if s["hackathon"] in reserved]
    assert {s["pool"] for s in SELECTION["sources"]} == set(SELECTION["pool_targets"])
    assert set(SELECTION["pool_targets"]) == set(config.SPONSOR_IDS) | {config.GENERAL_POOL}
    assert set(SELECTION["skill_tags"]) == set(SETTINGS["persona_shares"]["skill_focus"])
