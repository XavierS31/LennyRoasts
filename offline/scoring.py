"""Score accepted projects with the backend's shared score_submission and export the field.

There is deliberately no judge client here: the scorer is imported from the
backend module named on the command line, so offline and live scoring share one path.
"""
import asyncio
import importlib
import inspect
import json
from pathlib import Path

from offline import artifact, config, contract, field
from offline.config import load_json, write_json


def load_scorer(spec):
    module, _, name = spec.partition(":")
    if not name:
        raise SystemExit("--scorer must look like package.module:score_submission")
    return getattr(importlib.import_module(module), name)


def load_judge_config(path):
    judge_config = load_json(path)
    problems = contract.errors("JudgeConfig", judge_config)
    if problems:
        raise SystemExit("Judge config does not match the contract:\n" + "\n".join(problems))
    return judge_config


async def _resolve(value):
    return await value


def call_scorer(scorer, submission, challenge_ids, judge_config):
    results = scorer(submission, challenge_ids, judge_config)
    return asyncio.run(_resolve(results)) if inspect.isawaitable(results) else results


def scores_dir(field_id, judge_version):
    return config.require_local(config.field_dir(field_id) / "scores" / judge_version)


def score_field(field_id, scorer_spec, judge_config_path, limit=None):
    """Score accepted projects not yet scored under this exact judge config; never mix configs."""
    judge_config = load_judge_config(judge_config_path)
    sha = contract.judge_config_sha256(judge_config)
    scorer = load_scorer(scorer_spec)
    folder = scores_dir(field_id, judge_config["judge_version"])
    done, failures = [], []
    todo = []
    for record in field.load_accepted(field_id):
        path = folder / f"{record['team_id']}.json"
        if path.exists():
            saved = load_json(path)
            if saved["judge_config_sha256"] != sha:
                raise SystemExit(f"{path} was scored with a different config under the same judge_version; "
                                 "bump judge_version and rescore the whole field.")
            done.append(record["project_id"])
        else:
            todo.append(record)
    for record in todo[:limit]:
        submission = record["submission"]
        expected = artifact.expected_challenge_ids(submission)
        try:
            results = call_scorer(scorer, submission, expected, judge_config)
            problems = artifact.result_problems(results, expected)
        except Exception as error:  # preserve every provider/validation failure and keep going
            results, problems = None, [f"{type(error).__name__}: {error}"]
        if problems:
            failures.append({"project_id": record["project_id"], "problems": problems})
            continue
        write_json(folder / f"{record['team_id']}.json", {
            "project_id": record["project_id"],
            "judge_version": judge_config["judge_version"],
            "judge_config_sha256": sha,
            "challenge_results": results,
        })
        done.append(record["project_id"])
    if failures:
        write_json(folder / "failures.json", failures)
    return done, failures, len(todo) - len(todo[:limit])


def export(field_id, judge_config_path, pool_version=None):
    """Write a validated PoolArtifact; refuses partial scoring and silent version reuse."""
    judge_config = load_judge_config(judge_config_path)
    sha = contract.judge_config_sha256(judge_config)
    records = field.load_accepted(field_id)
    if not records:
        raise SystemExit("No accepted projects to export.")
    folder = config.field_dir(field_id) / "scores" / judge_config["judge_version"]
    scores, missing = {}, []
    for record in records:
        path = folder / f"{record['team_id']}.json"
        saved = load_json(path) if path.exists() else None
        if saved is None or saved["judge_config_sha256"] != sha:
            missing.append(record["project_id"])
        else:
            scores[record["project_id"]] = saved
    if missing:
        raise SystemExit(f"{len(missing)} accepted projects lack scores for this judge config: {missing}")
    pool_version = pool_version or f"{field_id}-n{len(records)}"
    built = artifact.build(records, scores, judge_config, pool_version)
    problems = artifact.artifact_problems(built, judge_config)
    if problems:
        raise SystemExit("Artifact failed validation:\n" + "\n".join(problems))
    out = config.require_local(config.field_dir(field_id) / "artifacts" /
                               f"{pool_version}__{judge_config['judge_version']}.json")
    if out.exists() and load_json(out)["projects"] != built["projects"]:
        raise SystemExit(f"{out.name} already exists with different projects; pool versions are immutable.")
    write_json(out, built)
    return out, built


def validate_file(artifact_path, judge_config_path):
    return artifact.artifact_problems(json.loads(Path(artifact_path).read_text(encoding="utf-8")),
                                      load_judge_config(judge_config_path))
