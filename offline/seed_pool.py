"""Deterministic seed selection from scouted prize opt-ins (plan sections 4.3-4.5).

Pure functions over scout lists and the manifest; fetching and writing live in collect.py.
"""
import random
import re


def seed_id(hackathon, url):
    return f"{hackathon}--{url.rstrip('/').rsplit('/', 1)[-1]}"


def normalized(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())


def reserved_listing(listed_hackathons, settings):
    """A reserved judge-example or holdout hackathon the project page also lists, else None.

    Devpost names like "Knight Hacks VII" normalize to the reserved slug "knight-hacks-vii".
    """
    split = settings["split"]
    reserved = {normalized(slug) for slug in split["judge_example_hackathons"] + split["holdout_hackathons"]}
    return next((name for name in listed_hackathons if normalized(name) in reserved), None)


def skills_from_tags(built_with, skill_tags, limit):
    """Up to `limit` skill focuses with the most matching "Built with" tags, ties in config order."""
    tags = {tag.lower() for tag in built_with}
    counts = {skill: len(tags & set(names)) for skill, names in skill_tags.items()}
    ranked = sorted((skill for skill in skill_tags if counts[skill]), key=lambda skill: -counts[skill])
    return ranked[:limit]


def candidates(scout, sources):
    """Scouted projects keyed by URL, merging every scouted prize each one opted into."""
    merged = {}
    for source in sources:
        for project in scout.get(f"{source['hackathon']}:{source['prize_id']}", {}).get("projects", []):
            entry = merged.setdefault(project["url"], {
                "seed_id": seed_id(source["hackathon"], project["url"]),
                "devpost_url": project["url"],
                "hackathon": source["hackathon"],
                "hackathon_name": source["hackathon_name"],
                "year": source["year"],
                "opted_into": [],
                "pools": [],
                "winner_badge": False,
            })
            if source["prize_name"] not in entry["opted_into"]:
                entry["opted_into"].append(source["prize_name"])
            if source["pool"] not in entry["pools"]:
                entry["pools"].append(source["pool"])
            entry["winner_badge"] = entry["winner_badge"] or project["winner_badge"]
    return merged


def ordered_candidates(pool, merged, taken_urls, rng_seed):
    """(winners, others) for a pool in a reproducible shuffled order, excluding taken URLs."""
    eligible = sorted(url for url, c in merged.items() if pool in c["pools"] and url not in taken_urls)
    random.Random(f"{rng_seed}:{pool}").shuffle(eligible)
    return ([merged[url] for url in eligible if merged[url]["winner_badge"]],
            [merged[url] for url in eligible if not merged[url]["winner_badge"]])


def pool_needs(pool, manifest, merged, target, winner_share):
    """(seeds still needed, winner-badge seeds still needed) for one pool."""
    existing = [s for s in manifest if s["pool"] == pool]
    winners = sum(1 for s in existing if merged.get(s["devpost_url"], {}).get("winner_badge"))
    need = max(0, target - len(existing))
    return need, min(need, max(0, round(winner_share * target) - winners))
