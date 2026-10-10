"""Deterministic synthetic scoring for development only; never a Qwen fallback."""
import hashlib
import json
import re
from statistics import mean
from typing import Any

from .contracts import GENERAL_IDS, validate
from .scoring_contract import validate_score_result

MOCK_CONFIG = {"judge_version": "mock-heuristic-v1", "kind": "deterministic-mock", "runs": 3, "seed": 109200, "rules_version": "1"}
MOCK_POOL_VERSION = "mock-200-v1"
MOCK_WARNING = "Mock heuristic scores against 200 synthetic projects; no LLM judgment or execution verification."
CORE_CRITERIA = ("originality", "tech_understanding", "functionality", "wow")


def config_hash(config=MOCK_CONFIG) -> str:
    return hashlib.sha256(json.dumps(config, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def _relevance(track: str, core: str) -> int:
    if track in ("gemini", "elevenlabs", "databricks"):
        if track not in core:
            return 1
        if f"optional {track}" in core or f"incidental {track}" in core:
            return 2
        if f"secondary {track}" in core:
            return 3
        return 4
    if track == "bny":
        if not re.search(r"\b(fraud|financial|finance|transactions?|payments?|budget|banking)\b", core):
            return 1
        return 2 if "optional financial" in core else 4
    if track == "best_ai":
        return 4 if re.search(r"\b(gemini|ai|machine learning|model inference|classifier)\b", core) else 1
    if track == "best_game":
        return 4 if re.search(r"\b(gameplay|players?|puzzles?|game mechanics|game loop)\b", core) else 1
    if track == "most_useful":
        return 4 if re.search(r"\b(students?|commuters?|users?|families|teams?|patients?|residents?|routes?|shuttles?|recipes?|budgets?|appointments?|schedules?|supplies)\b", core) else 2
    raise ValueError(f"Unknown scored category: {track}")


def score_mock_submission(submission: dict[str, Any], challenge_ids: list[str]) -> list[dict[str, Any]]:
    validate("Submission", submission)
    if len(challenge_ids) != len(set(challenge_ids)):
        raise ValueError("Duplicate challenge ids.")
    allowed = set(submission["challenges"]) | set(GENERAL_IDS)
    if set(challenge_ids) != allowed:
        raise ValueError("Score exactly the entered sponsor tracks and four general categories.")
    # Deliberately ignore decoration, future plans and hidden generation labels.
    core = (submission["what_it_does"] + " " + submission["how_we_built_it"]).lower()
    status = (submission["what_it_does"] + " " + submission["challenges_we_ran_into"]).lower()
    if "core fails" in status or "core cannot run" in status:
        functionality = 1
    elif re.search(r"\b(disconnected|mocked|not connected)\b", status):
        functionality = 2
    elif re.search(r"\b(intermittent|unreliable)\b", status):
        functionality = 3
    elif "end-to-end" in status or "flow works" in status:
        functionality = 4
    else:
        functionality = 3
    connections = len(re.findall(r"\b(sends?|queries|passes|receives|renders|stores|cleans|returns|calls|reads|writes|aggregates)\b", core))
    technical = 4 if connections >= 4 else 3 if connections >= 2 else 2
    fingerprint = hashlib.sha256(core.encode()).digest()
    base = {"originality": 2 + fingerprint[0] % 3, "tech_understanding": technical,
            "functionality": functionality, "wow": 3 if functionality == 4 and technical == 4 else 2}
    results = []
    for track in challenge_ids:
        criteria = dict(base)
        if track != "overall":
            criteria["relevance"] = _relevance(track, core)
        maximum = 20 if track == "overall" else 25
        runs = []
        for run in range(3):
            values = dict(criteria)
            # Stable small run spread exercises tie/range behavior without random API results.
            noise = hashlib.sha256(f"{core}|{track}|{run}|{MOCK_CONFIG['seed']}".encode()).digest()[0] % 3 - 1
            values["originality"] = max(1, min(5, values["originality"] + noise))
            total = sum(values.values())
            runs.append({"run": run, "criteria": values, "total": total, "max_total": maximum,
                         "score_10": 10 * total / maximum, "eligible": track == "overall" or values["relevance"] >= 3})
        evidence = {key: "not described" for key in criteria}
        evidence["tech_understanding"] = submission["how_we_built_it"][:120]
        evidence["functionality"] = submission["challenges_we_ran_into"][:120]
        if track != "overall" and criteria["relevance"] >= 3:
            evidence["relevance"] = submission["what_it_does"][:120]
        eligible = sum(run["eligible"] for run in runs) >= 2
        improvements = []
        if not eligible:
            improvements.append("Describe a meaningful implemented role for this challenge or category; tags alone do not establish fit.")
        if functionality < 4:
            improvements.append("Connect the scoped core flow and describe which steps work end-to-end.")
        if technical < 4:
            improvements.append("Explain component connections and data flow rather than only naming tools.")
        result = {
            "challenge_id": track, "eligible": eligible,
            "criteria": {key: mean(run["criteria"][key] for run in runs) for key in criteria},
            "total": mean(run["total"] for run in runs), "max_total": maximum,
            "score_10": mean(run["score_10"] for run in runs), "runs": runs,
            "rationale": "Development-only mock rules use described connections, completion and category keywords. Originality and run variation are synthetic, not measured quality.",
            "evidence": evidence, "warnings": [MOCK_WARNING], "placement": None, "rivals": [], "improvements": improvements[:3],
        }
        validate_score_result(result, submission)
        results.append(result)
    return results
