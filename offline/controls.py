"""Synthetic category controls: hand-written submissions with expected judge outcomes.

They smoke-test a JudgeConfig's category gates through the shared score_submission
before the field is scored. Controls are never part of a field or PoolArtifact, and
only the categories a control expects are scored.
"""
import asyncio

from backend.app.judging import score_submission
from offline import config, contract, scoring
from offline.config import GENERAL_IDS, SPONSOR_IDS, write_json

CONTROLS_PATH = config.CONFIG_DIR / "judge_controls.json"
CRITERIA = ["originality", "tech_understanding", "functionality", "wow", "relevance"]


def controls():
    return config.load_json(CONTROLS_PATH)["controls"]


def definition_problems(control):
    """Problems with one committed control definition, empty when it is usable."""
    cid = control["id"]
    problems = [f"{cid}: submission {p}" for p in contract.errors("Submission", control["submission"])]
    if not control["expect"]:
        problems.append(f"{cid}: expects no category")
    for category, expectation in control["expect"].items():
        if category not in SPONSOR_IDS + GENERAL_IDS:
            problems.append(f"{cid}: unknown category {category}")
        elif category in SPONSOR_IDS and category not in control["submission"]["challenges"]:
            problems.append(f"{cid}: expects sponsor category {category} without opting into it")
        criteria = [c for c in CRITERIA if category != "overall" or c != "relevance"]
        for bound in ("min", "max"):
            for criterion in set(expectation.get(bound, {})) - set(criteria):
                problems.append(f"{cid}: {category} has no criterion {criterion}")
    return problems


def outcome_problems(control, results):
    """Differences between scored results and the control's expectations; empty when it passes."""
    by_id = {r["challenge_id"]: r for r in results}
    problems = []
    for category, expectation in control["expect"].items():
        result = by_id[category]
        if "eligible" in expectation and result["eligible"] != expectation["eligible"]:
            problems.append(f"{category}: eligible={result['eligible']}, expected {expectation['eligible']}")
        for criterion, low in expectation.get("min", {}).items():
            if result["criteria"][criterion] < low:
                problems.append(f"{category}: mean {criterion} {result['criteria'][criterion]:.2f} < {low}")
        for criterion, high in expectation.get("max", {}).items():
            if result["criteria"][criterion] > high:
                problems.append(f"{category}: mean {criterion} {result['criteria'][criterion]:.2f} > {high}")
    return problems


def run(judge_config_path, control_ids=None):
    """Score the selected controls with the shared scorer and save each outcome locally."""
    judge_config = scoring.load_judge_config(judge_config_path)
    sha = contract.judge_config_sha256(judge_config)
    selected = [c for c in controls() if not control_ids or c["id"] in control_ids]
    unknown = set(control_ids or []) - {c["id"] for c in selected}
    if unknown:
        raise SystemExit(f"Unknown control ids: {sorted(unknown)}")
    folder = config.require_local(config.LOCAL_DIR / "controls" / judge_config["judge_version"])
    outcomes = []
    for control in selected:
        try:
            results = asyncio.run(score_submission(control["submission"], list(control["expect"]), judge_config))
            problems = outcome_problems(control, results)
        except Exception as error:  # report provider/validation failures per control and keep going
            results, problems = None, [f"{type(error).__name__}: {error}"]
        write_json(folder / f"{control['id']}.json", {
            "control_id": control["id"],
            "judge_version": judge_config["judge_version"],
            "judge_config_sha256": sha,
            "challenge_results": results,
            "problems": problems,
        })
        outcomes.append((control, results, problems))
    return outcomes
