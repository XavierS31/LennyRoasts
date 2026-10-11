"""Mechanical checks on every rewrite (plan section 4.9). Each returns a list of problems.

Semantic properties (light mutations keep the core concept, weak fit is really
incidental) still need review; schema checks alone missed such issues in the Luna test.
"""
import math
import re

from offline import contract

LONG_FIELDS = ["inspiration", "what_it_does", "how_we_built_it", "challenges_we_ran_into",
               "accomplishments", "what_we_learned", "whats_next"]
TEXT_FIELDS = ["name", "tagline", *LONG_FIELDS]
HONESTY_FIELDS = ["what_it_does", "how_we_built_it", "challenges_we_ran_into", "accomplishments"]


def all_text(submission):
    return "\n".join(submission.get(k, "") for k in TEXT_FIELDS)


def words(text):
    return re.findall(r"[a-z0-9]+(?:'[a-z0-9]+)?", text.lower().replace("’", "'"))


def sentence_count(text):
    return len([s for s in re.split(r"(?<=[.!?])\s+|\n+", text.strip()) if re.search(r"[A-Za-z0-9]", s)])


def schema_problems(submission):
    return [f"schema: {e}" for e in contract.errors("Submission", submission)]


def challenge_problems(submission, team):
    got, want = submission.get("challenges", []), team["challenges"]
    if sorted(got) != sorted(want) or len(got) != len(want):
        return [f"challenges {got} != assigned {want}"]
    return []


def length_problems(submission, style, settings):
    low, high = settings["style_sentences"][style]
    tolerance = settings["length_tolerance"]
    allowed = (max(1, math.floor(low * (1 - tolerance))), math.ceil(high * (1 + tolerance)))
    problems = []
    for field in LONG_FIELDS:
        count = sentence_count(submission.get(field, ""))
        if not allowed[0] <= count <= allowed[1]:
            problems.append(f"{field}: {count} sentences outside {style} bounds {allowed[0]}-{allowed[1]}")
    name_words = len(submission.get("name", "").split())
    if name_words > settings["max_name_words"]:
        problems.append(f"name has {name_words} words (max {settings['max_name_words']})")
    return problems


def sponsor_tech_problems(submission, team, challenges):
    tags = [t.lower() for t in submission.get("built_with", [])]
    problems = []
    for cid, level in team["fit"].items():
        tech = challenges[cid].get("sponsor_tech", [])
        if level in ("strong", "medium") and tech and not any(word in tag for word in tech for tag in tags):
            problems.append(f"{cid} fit is {level} but built_with names none of {tech}")
    return problems


def leak_problems(submission, forbidden):
    """Hidden labels, AI disclosures or seed identifiers (names, hackathons) in generated text."""
    text = all_text(submission).lower()
    return [f"leaked text: {term!r}" for term in forbidden
            if term and re.search(rf"(?<![a-z0-9]){re.escape(term.lower())}(?![a-z0-9])", text)]


def completion_problems(submission, completion, settings):
    if completion == "polished":
        return []
    text = " ".join(submission.get(k, "") for k in HONESTY_FIELDS).lower().replace("’", "'")
    if not any(marker in text for marker in settings["unfinished_markers"]):
        return [f"completion is {completion} but the write-up mentions nothing unfinished or unreliable"]
    return []


def rename_problems(submission, seed_submission):
    problems = []
    for field in ("name", "tagline"):
        if " ".join(words(submission.get(field, ""))) == " ".join(words(seed_submission.get(field, ""))):
            problems.append(f"{field} unchanged from seed")
    return problems


def shared_run(text_a, text_b, length):
    """First run of `length` consecutive words present in both texts, or None."""
    a, b = words(text_a), words(text_b)
    grams = {tuple(b[i:i + length]) for i in range(len(b) - length + 1)}
    for i in range(len(a) - length + 1):
        if tuple(a[i:i + length]) in grams:
            return " ".join(a[i:i + length])
    return None


def copy_problems(submission, seed_submissions, length):
    problems = []
    for seed in seed_submissions:
        run = shared_run(all_text(submission), all_text(seed), length)
        if run:
            problems.append(f"copies a {length}-word run from seed {seed.get('name', '')!r}: {run!r}")
    return problems
