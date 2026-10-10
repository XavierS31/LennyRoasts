"""Plain-code challenge assigner, persona sampler and seed picker (plan sections 4.6, 4.7, 4.9).

Each team draws from its own RNG seeded by master_rng_seed and team index, so
extending a field from 10 to 109 teams leaves the existing team plans unchanged.
"""
import random

from offline.config import GENERAL_POOL


def team_rng_seed(master_seed, index):
    return master_seed * 1000 + index


def _weighted(rng, shares):
    keys = list(shares)
    return rng.choices(keys, weights=[shares[k] for k in keys])[0]


def _weighted_without_replacement(rng, weights, count):
    remaining = dict(weights)
    picked = []
    for _ in range(min(count, len(remaining))):
        choice = _weighted(rng, remaining)
        picked.append(choice)
        del remaining[choice]
    return picked


def sample_team(index, settings, challenges):
    """One team's challenges, fit levels, persona and mutation strength; no seed yet."""
    rng_seed = team_rng_seed(settings["master_rng_seed"], index)
    rng = random.Random(rng_seed)
    shares = settings["persona_shares"]
    persona = {
        "skill_focus": _weighted(rng, shares["skill_focus"]),
        "completion": _weighted(rng, shares["completion"]),
        "writing_style": _weighted(rng, shares["writing_style"]),
    }
    mutation = _weighted(rng, shares["mutation"])
    opt_in_count = int(_weighted(rng, settings["opt_in_count_shares"]))
    # Every active sponsor challenge is software-only, so hardware-focus teams need no exclusion here.
    weights = {cid: c["popularity_weight"] for cid, c in challenges.items() if c["kind"] == "sponsor"}
    picked = _weighted_without_replacement(rng, weights, opt_in_count)
    fit = {cid: _weighted(rng, settings["fit_shares"]) for cid in picked}
    primary = next((cid for cid in picked if fit[cid] == "strong"), GENERAL_POOL)
    return {
        "team_id": f"t{index:03d}",
        "index": index,
        "rng_seed": rng_seed,
        "challenges": picked,
        "fit": fit,
        "primary_pool": primary,
        "persona": persona,
        "mutation": mutation,
    }


def _least_used(rng, candidates, usage):
    fewest = min(usage.get(s["seed_id"], 0) for s in candidates)
    tied = sorted(s["seed_id"] for s in candidates if usage.get(s["seed_id"], 0) == fewest)
    return rng.choice(tied)


def pick_seeds(team, seeds, usage, cap):
    """Seed ids for a team, or None when its primary pool has no seed under the usage cap.

    The primary seed comes from the primary pool, matching skill focus when possible.
    Heavy mutations add a second seed from a different pool.
    """
    rng = random.Random(team["rng_seed"] + 1)
    available = [s for s in seeds.values() if usage.get(s["seed_id"], 0) < cap]
    pool = [s for s in available if s["pool"] == team["primary_pool"]]
    if not pool:
        return None
    skilled = [s for s in pool if team["persona"]["skill_focus"] in s["skills"]]
    chosen = [_least_used(rng, skilled or pool, usage)]
    if team["mutation"] == "heavy":
        others = [s for s in available if s["pool"] != team["primary_pool"]]
        if not others:
            return None
        chosen.append(_least_used(rng, others, usage))
    return chosen


def extend_field(teams, size, seeds, settings, challenges):
    """Return teams extended to `size`, keeping existing plans and seed assignments intact.

    Earlier teams still lacking a seed (seed_ids None) get one first, in index order,
    so adding seeds to the manifest later fills them before new teams are drawn.
    """
    teams = [dict(t) for t in teams]
    usage = {}
    for team in teams:
        for seed_id in team["seed_ids"] or []:
            usage[seed_id] = usage.get(seed_id, 0) + 1
    for team in teams:
        if team["seed_ids"] is None:
            team["seed_ids"] = pick_seeds(team, seeds, usage, settings["seed_use_cap"])
            for seed_id in team["seed_ids"] or []:
                usage[seed_id] = usage.get(seed_id, 0) + 1
    for index in range(len(teams) + 1, size + 1):
        team = sample_team(index, settings, challenges)
        team["seed_ids"] = pick_seeds(team, seeds, usage, settings["seed_use_cap"])
        for seed_id in team["seed_ids"] or []:
            usage[seed_id] = usage.get(seed_id, 0) + 1
        teams.append(team)
    return teams
