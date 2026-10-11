"""Fetch Devpost prize opt-ins and seed write-ups (plan section 4.4), politely throttled.

Seed text is copied project content, so it is written only under .local-tests/.
The committed seed manifest holds provenance (URLs, hackathons, prize opt-ins), not stories.
"""
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

import certifi

from offline import config, devpost, seed_pool

USER_AGENT = "LennyRoasts-offline-seed-collector/0.1 (student hackathon research prototype)"
THROTTLE_SECONDS = 1.5
_last_request = [0.0]


def fetch(url):
    wait = _last_request[0] + THROTTLE_SECONDS - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(request, timeout=30, context=context) as response:
        body = response.read().decode("utf-8", errors="replace")
    _last_request[0] = time.monotonic()
    return body


def prizes(hackathon):
    return devpost.parse_prize_filters(fetch(f"https://{hackathon}.devpost.com/project-gallery"))


def opt_ins(hackathon, prize_id, max_pages=20):
    """Every project submitted to one prize, winners and non-winners."""
    projects = []
    for page in range(1, max_pages + 1):
        query = urllib.parse.urlencode({"utf8": "✓", "prize_filter[prizes][]": prize_id, "page": page})
        found = devpost.parse_search_results(fetch(f"https://{hackathon}.devpost.com/submissions/search?{query}"))
        if not found:
            break
        projects.extend(found)
    return projects


def split_violation(entry, settings):
    split = settings["split"]
    reserved = split["judge_example_hackathons"] + split["holdout_hackathons"]
    if entry["hackathon"] in reserved:
        return f"{entry['seed_id']}: hackathon {entry['hackathon']} is reserved for judge examples or the backtest"
    return None


def page_problem(entry, parsed, settings):
    """Why a fetched project page cannot be a seed, or None."""
    if not parsed["name"] or not parsed["what_it_does"] or not parsed["how_we_built_it"]:
        return f"{entry['seed_id']}: missing name, what_it_does or how_we_built_it; not stored"
    reserved = seed_pool.reserved_listing(parsed["submitted_to"], settings)
    if reserved:
        return f"{entry['seed_id']}: also submitted to reserved hackathon {reserved!r}; not stored"
    return None


def seed_record(entry, parsed, fetched_at):
    submission = {key: parsed[key] for key in ["name", "tagline", *devpost.TEXT_FIELDS, "built_with"]}
    submission["challenges"] = []
    return {
        "seed_id": entry["seed_id"],
        "pool": entry["pool"],
        "skills": entry["skills"],
        "submission": submission,
        "missing_sections": [key for key in devpost.TEXT_FIELDS if not parsed[key]],
        "unmapped_headings": parsed["unmapped_headings"],
        "provenance": {
            "devpost_url": entry["devpost_url"],
            "source_hackathon": entry["hackathon"],
            "hackathon_name": entry["hackathon_name"],
            "year": entry["year"],
            "submitted_to": entry["opted_into"],
            "listed_hackathons": parsed["submitted_to"],
            "prize_won": parsed["prize_won"],
            "fetched_at": fetched_at,
        },
    }


def fetch_seeds(refresh=False):
    """Fetch every manifest seed not yet stored locally; return (stored, problems)."""
    settings = config.settings()
    stored, problems = [], []
    for entry in config.seed_manifest():
        problem = split_violation(entry, settings)
        if problem:
            problems.append(problem)
            continue
        path = config.require_local(config.SEEDS_DIR / f"{entry['seed_id']}.json")
        if path.exists() and not refresh:
            stored.append(entry["seed_id"])
            continue
        parsed = devpost.parse_project(fetch(entry["devpost_url"]))
        problem = page_problem(entry, parsed, settings)
        if problem:
            problems.append(problem)
            continue
        config.write_json(path, seed_record(entry, parsed, fetched_now()))
        stored.append(entry["seed_id"])
    return stored, problems


def fetched_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def scout(refresh=False):
    """Fetch opt-in lists for every configured prize source not yet scouted; return the scout data."""
    path = config.require_local(config.SCOUT_PATH)
    data = config.load_json(path) if path.exists() else {}
    for source in config.seed_sources()["sources"]:
        key = f"{source['hackathon']}:{source['prize_id']}"
        if key in data and not refresh:
            continue
        data[key] = {"pool": source["pool"], "fetched_at": fetched_now(),
                     "projects": opt_ins(source["hackathon"], source["prize_id"])}
        config.write_json(path, data)
    return data


def new_seed(candidate, pool, settings, selection):
    """(manifest entry, local seed record) for one scouted candidate, or (None, problem)."""
    entry = {"seed_id": candidate["seed_id"], "pool": pool,
             **{key: candidate[key] for key in ["devpost_url", "hackathon", "hackathon_name", "year", "opted_into"]}}
    problem = split_violation(entry, settings)
    if problem:
        return None, problem
    try:
        parsed = devpost.parse_project(fetch(entry["devpost_url"]))
    except urllib.error.URLError as error:
        return None, f"{entry['seed_id']}: fetch failed ({error}); not stored"
    problem = page_problem(entry, parsed, settings)
    if problem:
        return None, problem
    entry["skills"] = seed_pool.skills_from_tags(parsed["built_with"], selection["skill_tags"], selection["max_skills"])
    entry["search_winner_badge"] = candidate["winner_badge"]
    return entry, seed_record(entry, parsed, fetched_now())


def grow_manifest():
    """Append seeds to the manifest until each pool reaches its target; return (added, problems).

    Candidates come from `scout` in a fixed shuffled order per pool, winner-badge projects
    first up to the winner share, then the rest. Each accepted page is stored locally and
    the manifest is saved after every addition, so an interrupted run resumes where it stopped.
    """
    settings, selection = config.settings(), config.seed_sources()
    if not config.SCOUT_PATH.exists():
        raise SystemExit("No scout data; run `scout` first.")
    merged = seed_pool.candidates(config.load_json(config.SCOUT_PATH), selection["sources"])
    manifest = config.seed_manifest()
    taken = {s["devpost_url"] for s in manifest}
    added, problems = [], []
    for pool, target in selection["pool_targets"].items():
        need, winners_needed = seed_pool.pool_needs(pool, manifest, merged, target, selection["winner_share"])
        winners, others = seed_pool.ordered_candidates(pool, merged, taken, selection["selection_rng_seed"])
        pool_added = []
        for group, limit in ((winners, winners_needed), (others, need)):
            for candidate in group:
                if len(pool_added) >= limit:
                    break
                taken.add(candidate["devpost_url"])
                entry, outcome = new_seed(candidate, pool, settings, selection)
                if entry is None:
                    problems.append(outcome)
                    continue
                config.write_json(config.require_local(config.SEEDS_DIR / f"{entry['seed_id']}.json"), outcome)
                manifest.append(entry)
                config.write_seed_manifest(manifest, selection["manifest_version"], date.today().isoformat())
                pool_added.append(entry)
        if len(pool_added) < need:
            problems.append(f"{pool}: added {len(pool_added)} of {need} needed; scout more prize sources")
        added.extend(pool_added)
    return added, problems


def load_seeds():
    """Locally stored seeds for manifest entries, keyed by seed id."""
    seeds = {}
    for entry in config.seed_manifest():
        path = config.SEEDS_DIR / f"{entry['seed_id']}.json"
        if path.exists():
            seeds[entry["seed_id"]] = config.load_json(path)
    return seeds
