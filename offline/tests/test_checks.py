import copy

from offline import checks, config

SETTINGS = config.settings()
CHALLENGES = config.challenges()
SUBMISSION = {
    "name": "Shuttle Sense",
    "tagline": "Ask why your campus shuttle is late.",
    "inspiration": "Our friends kept missing the night shuttle.",
    "what_it_does": "It answers delay questions from uploaded route logs.",
    "how_we_built_it": "A Flask API loads CSV logs into Databricks and sends aggregates to Gemini.",
    "challenges_we_ran_into": "Live GPS is not connected yet, so the demo uses sample data.",
    "accomplishments": "The upload-to-answer flow runs on our sample file.",
    "what_we_learned": "We learned to keep prompts small.",
    "whats_next": "Connect live GPS feeds.",
    "built_with": ["python", "flask", "databricks", "gemini-api"],
    "challenges": ["gemini", "databricks"],
}
TEAM = {"challenges": ["databricks", "gemini"], "fit": {"databricks": "strong", "gemini": "medium"}}


def test_valid_submission_passes_mechanical_checks():
    assert checks.schema_problems(SUBMISSION) == []
    assert checks.challenge_problems(SUBMISSION, TEAM) == []
    assert checks.length_problems(SUBMISSION, "terse", SETTINGS) == []
    assert checks.sponsor_tech_problems(SUBMISSION, TEAM, CHALLENGES) == []
    assert checks.completion_problems(SUBMISSION, "partial", SETTINGS) == []
    assert checks.leak_problems(SUBMISSION, SETTINGS["leaked_labels"] + ["SwampHacks XI"]) == []


def test_schema_and_challenge_mismatches_are_reported():
    broken = copy.deepcopy(SUBMISSION)
    broken["whats_next"] = ""
    broken["challenges"] = ["gemini", "neon"]
    assert checks.schema_problems(broken)
    assert checks.challenge_problems(dict(SUBMISSION, challenges=["gemini"]), TEAM)


def test_length_bounds_follow_style_with_tolerance():
    long_text = " ".join(f"Sentence number {i} is here." for i in range(7))
    wordy = dict(SUBMISSION, how_we_built_it=long_text)
    assert any("how_we_built_it" in p for p in checks.length_problems(wordy, "terse", SETTINGS))
    assert checks.length_problems(wordy, "detailed", SETTINGS) != []
    assert checks.length_problems(dict(SUBMISSION, name="A Very Long Six Word Name"), "terse", SETTINGS)


def test_sponsor_tech_required_only_for_strong_and_medium_fit():
    untagged = dict(SUBMISSION, built_with=["python", "flask"])
    assert len(checks.sponsor_tech_problems(untagged, TEAM, CHALLENGES)) == 2
    weak = {"challenges": ["gemini", "bny"], "fit": {"gemini": "weak", "bny": "strong"}}
    assert checks.sponsor_tech_problems(untagged, weak, CHALLENGES) == []


def test_leaks_match_whole_terms_only():
    leaked = dict(SUBMISSION, inspiration="As an AI, I adapted this from SwampHacks XI.")
    assert len(checks.leak_problems(leaked, ["as an ai", "SwampHacks XI"])) == 2
    assert checks.leak_problems(dict(SUBMISSION, inspiration="A rescue app."), ["cue"]) == []


def test_unfinished_targets_must_admit_gaps():
    confident = dict(SUBMISSION, challenges_we_ran_into="Everything works end to end.")
    assert checks.completion_problems(confident, "broken", SETTINGS)
    assert checks.completion_problems(confident, "polished", SETTINGS) == []


def test_rename_and_copied_runs_against_seed():
    seed = dict(SUBMISSION, name="shuttle sense!", tagline="Bus delays, explained.",
                what_it_does="Totally different words here.")
    assert checks.rename_problems(SUBMISSION, seed) == ["name unchanged from seed"]
    copied = "A Flask API loads CSV logs into Databricks and sends aggregates to Gemini for answers."
    assert checks.shared_run(copied, SUBMISSION["how_we_built_it"], 12)
    assert checks.shared_run("A Flask API loads logs.", SUBMISSION["how_we_built_it"], 12) is None
    assert checks.copy_problems(SUBMISSION, [dict(seed, how_we_built_it=copied)], 12)
