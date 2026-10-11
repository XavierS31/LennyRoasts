"""Check shared-module scoring results and build/validate the PoolArtifact export.

Score arithmetic, eligibility and evidence quotes are checked by the backend's
validate_score_result; this module adds only offline-specific rules and never
produces scores itself.
"""
from collections import Counter

from jsonschema import ValidationError

from backend.app.scoring_contract import validate_score_result
from offline import contract
from offline.config import GENERAL_IDS, SPONSOR_IDS


def result_problems(results, submission):
    """Problems with one project's offline results, empty when they are importable."""
    ids = [r.get("challenge_id") for r in results]
    expected = expected_challenge_ids(submission)
    problems = [] if Counter(ids) == Counter(expected) else [f"challenge ids {sorted(ids)} != expected {sorted(expected)}"]
    for result in results:
        cid = result.get("challenge_id")
        try:
            validate_score_result(result, submission)
        except (ValueError, ValidationError) as error:
            problems.append(f"{cid}: {getattr(error, 'message', error)}")
            continue
        if result["placement"] is not None or result["rivals"] or result["improvements"]:
            problems.append(f"{cid}: offline results need null placement and empty rivals/improvements")
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
        problems += [f"{pid}: {p}" for p in result_problems(project["challenge_results"], submission)]
    return problems
