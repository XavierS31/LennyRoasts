from jsonschema import Draft202012Validator

from offline import config, contract, prompts

CHALLENGES = config.challenges()
SEEDS = {
    "s1": {"submission": {"name": "Seed One", "tagline": "Old tagline", "what_it_does": "Does a thing.",
                          "how_we_built_it": "React.", "inspiration": "", "built_with": ["react"], "challenges": []},
           "provenance": {"hackathon_name": "SwampHacks XI", "prize_won": ["Best Hack"]}},
    "s2": {"submission": {"name": "Seed Two", "tagline": "Other", "what_it_does": "Talks.", "how_we_built_it": "x",
                          "built_with": [], "challenges": []},
           "provenance": {"hackathon_name": "HackUSF 2026", "prize_won": []}},
}
TEAM = {"team_id": "t001", "seed_ids": ["s1", "s2"], "challenges": ["gemini", "bny"],
        "fit": {"gemini": "strong", "bny": "weak"}, "mutation": "heavy",
        "persona": {"skill_focus": "ai_ml", "completion": "partial", "writing_style": "terse"}}


def test_team_prompt_carries_instructions_but_no_provenance():
    text = prompts.team_prompt(TEAM, SEEDS, CHALLENGES, [{"name": "Rival", "tagline": "Rival line"}])
    assert '`challenges` must list exactly these ids: ["gemini", "bny"]' in text
    assert prompts.MUTATION["heavy"] in text and prompts.COMPLETION["partial"] in text
    assert prompts.FIT["weak"] in text and "SECOND SEED" in text and "- Rival: Rival line" in text
    assert "SwampHacks" not in text and "Best Hack" not in text and '"inspiration"' not in text
    assert "Skill focus: AI/ML" in text


def test_output_schema_accepts_generator_shape():
    schema = prompts.output_schema(contract.schema("Submission"))
    Draft202012Validator.check_schema(schema)
    answer = {"projects": [{"team_id": "t001", "submission": {
        **{k: "text" for k in contract.schema("Submission")["required"] if k not in ("built_with", "challenges")},
        "built_with": ["python"], "challenges": ["gemini"]}}]}
    assert list(Draft202012Validator(schema).iter_errors(answer)) == []
