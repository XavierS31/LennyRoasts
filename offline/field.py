"""Field state on disk: team plans, generator batches, ingest with retries, review and report.

Everything here is written under .local-tests/offline/fields/<field_id>/ because it
holds seed-derived text. Team statuses: unseeded (waiting for a seed under the use
cap) -> pending -> in_batch -> accepted | pending (retry) | skipped (retry budget spent).
"""
import json
from collections import Counter
from datetime import datetime, timezone

import numpy as np

from offline import checks, collect, config, contract, prompts, sampler
from offline.config import GENERAL_IDS, load_json, write_json
from offline.similarity import Embedder, cosine_to_each, nearest_neighbors


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def state_path(field_id):
    return config.require_local(config.field_dir(field_id) / "field.json")


def load_state(field_id):
    path = state_path(field_id)
    if not path.exists():
        raise SystemExit(f"Unknown field {field_id!r}; run `sample` first.")
    return load_json(path)


def save_state(state):
    write_json(state_path(state["field_id"]), state)


def accepted_path(field_id, team_id):
    return config.require_local(config.field_dir(field_id) / "accepted" / f"{team_id}.json")


def load_accepted(field_id):
    folder = config.field_dir(field_id) / "accepted"
    return [load_json(p) for p in sorted(folder.glob("*.json"))] if folder.exists() else []


def sample(field_id, size):
    """Create or extend a field to `size` teams; existing teams never change."""
    settings, challenges = config.settings(), config.challenges()
    seeds = collect.load_seeds()
    path = state_path(field_id)
    state = load_json(path) if path.exists() else {
        "field_id": field_id,
        "created_at": now(),
        "settings_version": settings["settings_version"],
        "prompt_version": settings["prompt_version"],
        "challenges_config_version": load_json(config.CONFIG_DIR / "kh9_challenges.json")["config_version"],
        "seed_manifest_version": load_json(config.CONFIG_DIR / "seed_manifest.json")["manifest_version"],
        "teams": [],
    }
    if state["settings_version"] != settings["settings_version"] or state["prompt_version"] != settings["prompt_version"]:
        raise SystemExit("Field settings or prompt version changed; start a new field id instead of extending this one.")
    if size > settings["target_field_size"]:
        raise SystemExit(f"Field size is capped at {settings['target_field_size']} teams.")
    missing = sorted({s for t in state["teams"] for s in t["seed_ids"] or [] if s not in seeds})
    if missing:
        raise SystemExit(f"Seeds used by existing teams are not stored locally: {missing}; run `fetch-seeds`.")
    # The manifest only grows, so extending a field records the newest version it drew from.
    state["seed_manifest_version"] = load_json(config.CONFIG_DIR / "seed_manifest.json")["manifest_version"]
    teams = sampler.extend_field(state["teams"], size, seeds, settings, challenges)
    for team in teams:
        team.setdefault("attempts", [])
        team.setdefault("skip_reason", None)
        if team.get("status") in (None, "unseeded"):
            team["status"] = "pending" if team["seed_ids"] else "unseeded"
    state["teams"] = teams
    save_state(state)
    return state


def already_in_field(team, accepted, limit=20):
    """Earlier rewrites of the same primary seed first, then others in the primary challenge."""
    same_seed = [a for a in accepted if a["seed_ids"][0] == team["seed_ids"][0]]
    same_pool = [a for a in accepted if a not in same_seed and a["primary_pool"] == team["primary_pool"]]
    return [{"name": a["submission"]["name"], "tagline": a["submission"]["tagline"]}
            for a in (same_seed + same_pool)[:limit]]


def prepare_batch(field_id, size):
    """Write the next generator batch for pending teams; returns the batch directory."""
    state = load_state(field_id)
    pending = [t for t in state["teams"] if t["status"] == "pending"][:size]
    if not pending:
        raise SystemExit("No pending teams. Extend the field with `sample` or check `report`.")
    batches = config.field_dir(field_id) / "batches"
    batch_id = f"b{len(list(batches.glob('b*'))) + 1 if batches.exists() else 1:03d}"
    seeds, challenges, accepted = collect.load_seeds(), config.challenges(), load_accepted(field_id)
    team_prompts = [(t["team_id"], prompts.team_prompt(t, seeds, challenges, already_in_field(t, accepted)))
                    for t in pending]
    folder = config.require_local(batches / batch_id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "prompt.md").write_text(prompts.batch_prompt(team_prompts) + "\n", encoding="utf-8")
    write_json(folder / "output_schema.json", prompts.output_schema(contract.schema("Submission")))
    write_json(folder / "request.json", {
        "batch_id": batch_id,
        "field_id": field_id,
        "prompt_version": state["prompt_version"],
        "created_at": now(),
        "teams": [{"team_id": t["team_id"], "attempt": len(t["attempts"]) + 1} for t in pending],
    })
    for team in pending:
        team["status"] = "in_batch"
        team["batch_id"] = batch_id
    save_state(state)
    return folder


def forbidden_terms(team, seeds, settings):
    hackathons = {seeds[s]["provenance"]["hackathon_name"] for s in team["seed_ids"]}
    return settings["leaked_labels"] + sorted(hackathons)


def candidate_problems(submission, team, seeds, settings, challenges):
    seed_subs = [seeds[s]["submission"] for s in team["seed_ids"]]
    problems = checks.schema_problems(submission)
    if problems:
        return problems
    return (checks.challenge_problems(submission, team)
            + checks.length_problems(submission, team["persona"]["writing_style"], settings)
            + checks.sponsor_tech_problems(submission, team, challenges)
            + checks.leak_problems(submission, forbidden_terms(team, seeds, settings))
            + checks.completion_problems(submission, team["persona"]["completion"], settings)
            + checks.rename_problems(submission, seed_subs[0])
            + checks.copy_problems(submission, seed_subs, settings["copy_run_words"]))


def _record_failure(team, attempt, max_attempts):
    team["attempts"].append(attempt)
    if len(team["attempts"]) >= max_attempts:
        team["status"] = "skipped"
        team["skip_reason"] = f"failed {len(team['attempts'])} attempts"
    else:
        team["status"] = "pending"


def ingest(field_id, batch_id, output_path, model):
    """Validate a generator's batch output; accept passing teams and spend retries on the rest."""
    state = load_state(field_id)
    settings, challenges, seeds = config.settings(), config.challenges(), collect.load_seeds()
    request = load_json(config.field_dir(field_id) / "batches" / batch_id / "request.json")
    output = json.loads(open(output_path, encoding="utf-8").read())
    by_team = {p["team_id"]: p["submission"] for p in output["projects"]}
    teams = {t["team_id"]: t for t in state["teams"]}
    embedder = Embedder(settings["embedding"])
    accepted = load_accepted(field_id)
    field_vectors = list(embedder.embed([a["submission"] for a in accepted])) if accepted else []
    outcomes = []
    for entry in request["teams"]:
        team = teams[entry["team_id"]]
        if team["status"] != "in_batch" or team.get("batch_id") != batch_id:
            raise SystemExit(f"{team['team_id']} is not awaiting batch {batch_id}; refusing to re-ingest.")
        submission = by_team.get(team["team_id"])
        attempt = {"batch_id": batch_id, "model": model, "ingested_at": now()}
        problems = ["missing from generator output"] if submission is None else candidate_problems(
            submission, team, seeds, settings, challenges)
        similarity = {}
        if not problems:
            vector = embedder.embed([submission])[0]
            seed_vectors = embedder.embed([seeds[s]["submission"] for s in team["seed_ids"]])
            similarity["seed"] = float(cosine_to_each(vector, seed_vectors).max())
            similarity["field"] = float(cosine_to_each(vector, np.array(field_vectors)).max()) if field_vectors else None
            threshold = settings["similarity_threshold"]
            if similarity["seed"] > threshold:
                problems.append(f"cosine {similarity['seed']:.3f} to a source seed exceeds {threshold}")
            if similarity["field"] is not None and similarity["field"] > threshold:
                problems.append(f"cosine {similarity['field']:.3f} to an accepted project exceeds {threshold}")
        if problems:
            _record_failure(team, {**attempt, "outcome": "rejected", "problems": problems}, settings["max_attempts"])
        else:
            record = {
                "project_id": f"{field_id}-{team['team_id']}",
                "team_id": team["team_id"],
                "submission": submission,
                "seed_ids": team["seed_ids"],
                "source_urls": [seeds[s]["provenance"]["devpost_url"] for s in team["seed_ids"]],
                "primary_pool": team["primary_pool"],
                "mutation": team["mutation"],
                "persona": team["persona"],
                "fit": team["fit"],
                "model": model,
                "prompt_version": state["prompt_version"],
                "rng_seed": team["rng_seed"],
                "batch_id": batch_id,
                "attempt": len(team["attempts"]) + 1,
                "similarity": similarity,
                "created_at": now(),
            }
            write_json(accepted_path(field_id, team["team_id"]), record)
            accepted.append(record)
            field_vectors.append(vector)
            team["attempts"].append({**attempt, "outcome": "accepted", "problems": []})
            team["status"] = "accepted"
        team.pop("batch_id", None)
        outcomes.append((team["team_id"], team["status"], problems))
    save_state(state)
    return outcomes


def reject(field_id, team_id, reason):
    """Undo acceptance after semantic review; the rejection spends one retry."""
    state = load_state(field_id)
    team = next(t for t in state["teams"] if t["team_id"] == team_id)
    path = accepted_path(field_id, team_id)
    if team["status"] != "accepted" or not path.exists():
        raise SystemExit(f"{team_id} is not accepted.")
    path.unlink()
    attempt = team["attempts"].pop()
    attempt.update(outcome="rejected", problems=[f"review: {reason}"], reviewed_at=now())
    _record_failure(team, attempt, config.settings()["max_attempts"])
    save_state(state)
    return team["status"]


def review_sheet(field_id):
    """Markdown digest of accepted projects beside their seeds for semantic review."""
    seeds = collect.load_seeds()
    lines = [f"# Review sheet: {field_id}", "",
             "Check: light keeps the core concept; heavy visibly borrows from the second seed; weak fit is a real "
             "but incidental role; completion honesty matches the target.", ""]
    for record in load_accepted(field_id):
        s = record["submission"]
        lines += [f"## {record['team_id']}: {s['name']}",
                  f"- mutation **{record['mutation']}**, completion **{record['persona']['completion']}**, "
                  f"style **{record['persona']['writing_style']}**, skill **{record['persona']['skill_focus']}**",
                  f"- fit: {json.dumps(record['fit'])} | primary pool: {record['primary_pool']}",
                  f"- similarity: {json.dumps(record['similarity'])}"]
        for seed_id in record["seed_ids"]:
            seed = seeds[seed_id]["submission"]
            lines.append(f"- seed `{seed_id}`: **{seed['name']}**: {seed['tagline']}")
        lines += [f"- tagline: {s['tagline']}", f"- what it does: {s['what_it_does']}",
                  f"- how built: {s['how_we_built_it']}", f"- challenges: {s['challenges_we_ran_into']}",
                  f"- built with: {', '.join(s['built_with'])}", ""]
    path = config.require_local(config.field_dir(field_id) / "review.md")
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def report(field_id):
    """Pool report: diagnostic counts and nearest-neighbor similarity, not a realism claim."""
    state, accepted = load_state(field_id), load_accepted(field_id)
    settings = config.settings()
    seeds = collect.load_seeds()
    teams = state["teams"]
    per_challenge = Counter()
    for record in accepted:
        per_challenge.update(record["submission"]["challenges"] + GENERAL_IDS)
    seeds_used = {}
    for record in accepted:
        for seed_id in record["seed_ids"]:
            seeds_used.setdefault(seeds[seed_id]["pool"], set()).add(seed_id)
    histogram = {}
    if len(accepted) > 1:
        vectors = Embedder(settings["embedding"]).embed([r["submission"] for r in accepted])
        nn = nearest_neighbors(vectors)
        bins = np.round(np.floor(nn / 0.05) * 0.05, 2)
        histogram = {f"{b:.2f}-{b + 0.05:.2f}": int(n) for b, n in sorted(Counter(bins.tolist()).items())}
    result = {
        "field_id": field_id,
        "generated_at": now(),
        "teams_sampled": len(teams),
        "status": dict(Counter(t["status"] for t in teams)),
        "accepted_field_size": len(accepted),
        "skipped": [{"team_id": t["team_id"], "reason": t["skip_reason"]} for t in teams if t["status"] == "skipped"],
        "teams_per_challenge": dict(per_challenge),
        "seeds_used_per_pool": {pool: len(ids) for pool, ids in sorted(seeds_used.items())},
        "seed_uses": dict(Counter(s for r in accepted for s in r["seed_ids"])),
        "mutation_mix": dict(Counter(r["mutation"] for r in accepted)),
        "completion_mix": dict(Counter(r["persona"]["completion"] for r in accepted)),
        "writing_style_mix": dict(Counter(r["persona"]["writing_style"] for r in accepted)),
        "skill_focus_mix": dict(Counter(r["persona"]["skill_focus"] for r in accepted)),
        "fit_mix": dict(Counter(level for r in accepted for level in r["fit"].values())),
        "attempts_used_by_accepted": dict(Counter(r["attempt"] for r in accepted)),
        "rejections": [{"team_id": t["team_id"], "batch_id": a["batch_id"], "problems": a["problems"]}
                       for t in teams for a in t["attempts"] if a["outcome"] == "rejected"],
        "max_seed_similarity": max((r["similarity"]["seed"] for r in accepted), default=None),
        "nearest_neighbor_similarity_histogram": histogram,
    }
    write_json(config.require_local(config.field_dir(field_id) / "pool_report.json"), result)
    return result
