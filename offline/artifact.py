"""Validate shared-module scoring results and build/validate the PoolArtifact export.

These checks verify contract rules on results produced by the backend's
score_submission; they never produce scores themselves.
"""
import math
from collections import Counter

from offline import contract
from offline.config import GENERAL_IDS, SPONSOR_IDS

TOLERANCE = 1e-6


def _close(a, b):
    return math.isclose(a, b, abs_tol=TOLERANCE)


def run_problems(challenge_id, run):
    criteria = run["criteria"]
    expected_max = 20 if challenge_id == "overall" else 25
    problems = []
    if run["max_total"] != expected_max:
        problems.append(f"{challenge_id} run {run['run']}: max_total {run['max_total']} != {expected_max}")
    if run["total"] != sum(criteria.values()):
        problems.append(f"{challenge_id} run {run['run']}: total {run['total']} != sum of criteria")
    if not _close(run["score_10"], 10 * run["total"] / run["max_total"]):
        problems.append(f"{challenge_id} run {run['run']}: score_10 does not equal 10 * total / max_total")
    eligible = challenge_id == "overall" or criteria.get("relevance", 0) >= 3
    if run["eligible"] != eligible:
        problems.append(f"{challenge_id} run {run['run']}: eligible flag contradicts the relevance rule")
    return problems


def result_problems(results, expected_ids):
    """Contract and aggregation checks for one project's offline results."""
    problems = []
    ids = [r.get("challenge_id") for r in results]
    if Counter(ids) != Counter(expected_ids):
        problems.append(f"challenge ids {sorted(ids)} != expected {sorted(expected_ids)}")
    for result in results:
        schema_errors = contract.errors("ChallengeResult", result)
        cid = result.get("challenge_id")
        if schema_errors:
            problems += [f"{cid}: {e}" for e in schema_errors]
            continue
        if result["placement"] is not None or result["rivals"] or result["improvements"]:
            problems.append(f"{cid}: offline results need null placement and empty rivals/improvements")
        runs = result["runs"]
        if [r["run"] for r in runs] != [0, 1, 2]:
            problems.append(f"{cid}: run indices must be 0, 1, 2")
        for run in runs:
            problems += run_problems(cid, run)
        for name, mean in result["criteria"].items():
            if not _close(mean, sum(r["criteria"][name] for r in runs) / len(runs)):
                problems.append(f"{cid}: criterion mean {name} is not the run mean")
        if not _close(result["total"], sum(r["total"] for r in runs) / len(runs)):
            problems.append(f"{cid}: total is not the run mean")
        if not _close(result["score_10"], sum(r["score_10"] for r in runs) / len(runs)):
            problems.append(f"{cid}: score_10 is not the run mean")
        eligible = cid == "overall" or sum(r["eligible"] for r in runs) >= 2
        if result["eligible"] != eligible:
            problems.append(f"{cid}: aggregate eligibility contradicts the two-of-three run rule")
    return problems


def expected_challenge_ids(submission):
    return list(submission["challenges"]) + GENERAL_IDS


def project_meta(record, pool_version):
    return {
        "seed_ids": record["seed_ids"],
        "source_urls": record["source_urls"],
        "mutation": record["mutation"],
        "persona": record["persona"],
        "fit": record["fit"],
        "pool_version": pool_version,
        "prompt_version": record["prompt_version"],
        "model": record["model"],
        "rng_seed": record["rng_seed"],
        "created_at": record["created_at"],
    }


def build(records, scores, judge_config, pool_version):
    """PoolArtifact from accepted records and their saved shared-module results."""
    return {
        "contract_version": contract.contract_version(),
        "judge_version": judge_config["judge_version"],
        "pool_version": pool_version,
        "judge_config_sha256": contract.judge_config_sha256(judge_config),
        "projects": [{
            "project_id": record["project_id"],
            "submission": record["submission"],
            "meta": project_meta(record, pool_version),
            "challenge_results": scores[record["project_id"]]["challenge_results"],
        } for record in records],
    }


def artifact_problems(artifact, judge_config):
    """Everything the backend import will reject, checked before handoff."""
    problems = [f"artifact: {e}" for e in contract.errors("PoolArtifact", artifact)]
    problems += [f"judge config: {e}" for e in contract.errors("JudgeConfig", judge_config)]
    if problems:
        return problems
    if artifact["contract_version"] != contract.contract_version():
        problems.append("contract_version does not match contracts/openapi.json")
    if artifact["judge_version"] != judge_config["judge_version"]:
        problems.append("judge_version does not match the judge config")
    if artifact["judge_config_sha256"] != contract.judge_config_sha256(judge_config):
        problems.append("judge_config_sha256 does not match the judge config")
    ids = Counter(p["project_id"] for p in artifact["projects"])
    problems += [f"duplicate project_id {pid}" for pid, n in ids.items() if n > 1]
    for project in artifact["projects"]:
        pid, submission, meta = project["project_id"], project["submission"], project["meta"]
        if meta["pool_version"] != artifact["pool_version"]:
            problems.append(f"{pid}: meta.pool_version != artifact pool_version")
        if sorted(meta["fit"]) != sorted(submission["challenges"]):
            problems.append(f"{pid}: fit keys {sorted(meta['fit'])} != submission.challenges")
        if set(submission["challenges"]) - set(SPONSOR_IDS):
            problems.append(f"{pid}: submission.challenges holds non-sponsor ids")
        if len(meta["seed_ids"]) != (2 if meta["mutation"] == "heavy" else 1):
            problems.append(f"{pid}: seed_ids count does not match mutation {meta['mutation']}")
        problems += [f"{pid}: {p}" for p in result_problems(project["challenge_results"],
                                                            expected_challenge_ids(submission))]
    return problems
