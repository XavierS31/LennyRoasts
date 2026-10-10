"""Build committed synthetic fixtures, never copied stories or live judge scores."""
import argparse
import json
import random
from pathlib import Path

from backend.app.contracts import GENERAL_IDS, ROOT, validate
from backend.app.mock_scoring import MOCK_CONFIG, MOCK_POOL_VERSION, config_hash, score_mock_submission
from backend.app.ranking import rank_results

DOMAINS = [
    ("Shuttle", "commuters", "track shuttle delays and find a route", "web"),
    ("Recipe", "families", "plan recipes from available ingredients", "mobile"),
    ("Study", "students", "organize study sessions and practice questions", "ai_ml"),
    ("Budget", "students", "review financial transactions and flag budget changes", "data"),
    ("Garden", "residents", "coordinate watering schedules", "web"),
    ("Puzzle", "players", "solve puzzles through a gameplay loop with timed objectives", "game_dev"),
    ("Event", "teams", "coordinate event shifts and tasks", "web"),
    ("Care", "users", "organize appointment reminders", "mobile"),
    ("Reuse", "residents", "exchange useful household supplies", "web"),
    ("Quest", "players", "choose routes and earn points in a cooperative gameplay loop", "game_dev"),
]
TECHNIQUES = {
    "gemini": "Gemini API reads structured inputs and returns grounded suggestions",
    "elevenlabs": "ElevenLabs API receives text and returns spoken guidance",
    "databricks": "Databricks stores rows in Delta tables and queries notebook aggregates",
    "bny": "the financial fraud classifier reads transactions and flags suspicious payments",
}


def generate_pool(count: int = 200, seed: int = MOCK_CONFIG["seed"]):
    if not 1 <= count <= 200:
        raise ValueError("Mock field count must be between 1 and 200.")
    if seed != MOCK_CONFIG["seed"]:
        raise ValueError("Changing the frozen seed requires a new mock config/version.")
    rng = random.Random(seed)
    projects = []
    sponsors = list(TECHNIQUES)
    completions = ["broken", "partial", "shaky", "polished", "polished"]
    for index in range(count):
        domain, audience, task, focus = DOMAINS[index % len(DOMAINS)]
        opt_ins = rng.sample(sponsors, rng.choices([0, 1, 2, 3], [10, 55, 30, 5])[0])
        fit = {track: rng.choices(["strong", "medium", "weak"], [50, 30, 20])[0] for track in opt_ins}
        completion = rng.choice(completions)
        features = []
        for track in opt_ins:
            role = "optional" if fit[track] == "weak" else "secondary" if fit[track] == "medium" else "central"
            label = "financial" if track == "bny" else track
            features.append(f"A {role} {label} feature uses {TECHNIQUES[track]}.")
        what = f"{audience.capitalize()} use a {domain.lower()} dashboard to {task}. " + " ".join(features)
        how = "React sends form inputs to FastAPI. The backend reads records, stores sample data in PostgreSQL and passes results to React, which renders the dashboard. " + " ".join(features)
        if completion == "broken":
            gaps = "The core fails at backend authentication; only an isolated UI component runs."
            what += " The core cannot run because its backend connection fails."
            accomplishment = "Built the UI shell; the complete core flow does not run."
        elif completion == "partial":
            gaps = "Core components are disconnected and the response panel is mocked."
            what += " The core components are not connected yet."
            accomplishment = "Prepared isolated scripts and a mocked panel, without an integrated workflow."
        elif completion == "shaky":
            gaps = "The flow works intermittently; repeated requests can lose state and need a restart."
            what += " The working core is unreliable under repeated requests."
            accomplishment = "Connected a narrow core flow with known reliability gaps."
        else:
            gaps = "The scoped sample-data flow works end-to-end; large uploads remain slow."
            what += " The scoped sample-data flow works end-to-end."
            accomplishment = "Connected the scoped input-to-output path without claiming real-world adoption."
        submission = {
            "name": f"{domain} Workshop {index + 1:03d}",
            "tagline": f"A synthetic weekend tool for {audience} to {task}.",
            "inspiration": f"A fictional team wanted clearer support for {audience}.",
            "what_it_does": what.strip(), "how_we_built_it": how.strip(),
            "challenges_we_ran_into": gaps, "accomplishments": accomplishment,
            "what_we_learned": "We learned to describe data flow and make scope limits explicit.",
            "whats_next": "Future work: broader testing, live integrations and accessibility improvements.",
            "built_with": ["react", "python", "postgresql"] + [track for track in opt_ins if track != "bny"],
            "challenges": opt_ins,
        }
        validate("Submission", submission)
        project = {
            "project_id": f"mock-project-{index + 1:03d}", "submission": submission,
            "meta": {"seed_ids": [f"mock-template-{domain.lower()}"], "source_urls": [f"mock://synthetic/{domain.lower()}"],
                     "mutation": rng.choice(["light", "medium", "heavy"]),
                     "persona": {"skill_focus": focus, "completion": completion, "writing_style": "average"},
                     "fit": fit, "pool_version": MOCK_POOL_VERSION, "prompt_version": "mock-template-v1",
                     "model": "synthetic-template-generator-v1", "rng_seed": seed,
                     "created_at": "2026-10-10T00:00:00Z"},
            "challenge_results": score_mock_submission(submission, opt_ins + list(GENERAL_IDS)),
        }
        projects.append(project)
    pool = {"contract_version": "1.0.0", "judge_version": MOCK_CONFIG["judge_version"],
            "pool_version": MOCK_POOL_VERSION, "judge_config_sha256": config_hash(), "projects": projects}
    validate("PoolArtifact", pool)
    return pool


def generate_rankings(pool):
    rankings = {track: [] for track in list(TECHNIQUES) + list(GENERAL_IDS)}
    for project in pool["projects"]:
        results = rank_results(project["challenge_results"], pool, judge_version=pool["judge_version"], project_id=project["project_id"])
        for result in results:
            rankings[result["challenge_id"]].append({"project_id": project["project_id"], "name": project["submission"]["name"],
                                                     "score_10": result["score_10"], "eligible": result["eligible"], "placement": result["placement"]})
    for rows in rankings.values():
        rows.sort(key=lambda row: (not row["eligible"], -row["score_10"], row["project_id"]))
    output = {"contract_version": pool["contract_version"], "judge_version": pool["judge_version"], "pool_version": pool["pool_version"], "rankings": rankings}
    validate("MockRankings", output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "contracts/mock")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    pool = generate_pool()
    # One compact line per project keeps the generated fixture diff inspectable.
    header = {key: value for key, value in pool.items() if key != "projects"}
    content = json.dumps(header, indent=2)[:-2] + ',\n  "projects": [\n'
    content += ',\n'.join('    ' + json.dumps(project, separators=(',', ':'), ensure_ascii=False) for project in pool['projects'])
    (args.output / "pool.json").write_text(content + '\n  ]\n}\n')
    (args.output / "judge_config.json").write_text(json.dumps(MOCK_CONFIG, indent=2) + '\n')
    (args.output / "rankings.json").write_text(json.dumps(generate_rankings(pool), indent=2) + '\n')
    print(f"Wrote {len(pool['projects'])} synthetic projects, three-run scores and category rankings. No LLM calls.")


if __name__ == "__main__":
    main()
