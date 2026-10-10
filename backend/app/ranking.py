"""Rank validated scores against a frozen field without rescoring competitors."""
import copy
from typing import Any

from .contracts import validate
from .scoring_contract import validate_score_result


def rank_results(
    results: list[dict[str, Any]],
    pool: dict[str, Any],
    *,
    judge_version: str,
    project_id: str | None = None,
) -> list[dict[str, Any]]:
    """Exclude project_id for cached competitors; new users compare to the full field."""
    if pool["judge_version"] != judge_version:
        raise ValueError("Cannot rank scores from different judge versions.")
    enriched = copy.deepcopy(results)
    for result in enriched:
        validate_score_result(result)
        if {run["run"] for run in result["runs"]} != {0, 1, 2}:
            raise ValueError("Ranking requires exactly three distinct run indices.")
        members = []
        for project in pool["projects"]:
            if project["project_id"] == project_id:
                continue
            cached = next((score for score in project["challenge_results"] if score["challenge_id"] == result["challenge_id"]), None)
            if cached and cached["eligible"]:
                members.append((project, cached))
        result["placement"] = None
        if result["eligible"]:
            lower, upper = [], []
            for run in result["runs"]:
                values = [next(item for item in score["runs"] if item["run"] == run["run"])["score_10"] for _, score in members]
                best = 1 + sum(value > run["score_10"] for value in values)
                lower.append(best)
                upper.append(best + sum(value == run["score_10"] for value in values))
            result["placement"] = {
                "best_rank": min(lower), "worst_rank": max(upper),
                "eligible_competitors": len(members), "field_size_including_user": len(members) + 1,
            }
        leaders = sorted(members, key=lambda item: (-item[1]["score_10"], item[0]["project_id"]))[:3]
        result["rivals"] = [{
            "project_id": project["project_id"], "name": project["submission"]["name"],
            "summary": project["submission"]["what_it_does"][:500], "score_10": score["score_10"],
        } for project, score in leaders]
        validate_score_result(result)
    return enriched
