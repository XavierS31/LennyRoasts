"""Fetch Devpost prize opt-ins and seed write-ups (plan section 4.4), politely throttled.

Seed text is copied project content, so it is written only under .local-tests/.
The committed seed manifest holds provenance (URLs, hackathons, prize opt-ins), not stories.
"""
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import certifi

from offline import config, devpost

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
        record = seed_record(entry, parsed, datetime.now(timezone.utc).isoformat(timespec="seconds"))
        if not record["submission"]["name"] or not parsed["what_it_does"] or not parsed["how_we_built_it"]:
            problems.append(f"{entry['seed_id']}: missing name, what_it_does or how_we_built_it; not stored")
            continue
        config.write_json(path, record)
        stored.append(entry["seed_id"])
    return stored, problems


def load_seeds():
    """Locally stored seeds for manifest entries, keyed by seed id."""
    seeds = {}
    for entry in config.seed_manifest():
        path = config.SEEDS_DIR / f"{entry['seed_id']}.json"
        if path.exists():
            seeds[entry["seed_id"]] = config.load_json(path)
    return seeds
