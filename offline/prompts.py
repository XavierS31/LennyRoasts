"""Mutation prompts from plan section 4.8, assembled into one batch per generator call.

Only seed `submission` fields reach the generator; seed provenance, awards and
persona labels stay out of the generated text by construction and by checks.
"""
import json

SYSTEM_PROMPT = """You rewrite a real past hackathon submission into a NEW team's submission for
Knight Hacks IX, a 36-hour student hackathon at the University of Central Florida
(October 9-11, 2026).

The result must read like a different team built a related but distinct project
this weekend. Keep the seed's realism: its scope, its level of detail, its rough
edges. Change only what the instructions ask for.

Rules:
- Never copy sentences from the seed; rewrite every section in new words.
- Always change the project name and tagline.
- Keep the scope buildable in 36 hours.
- Do not make the project more polished or impressive than instructed.
- Do not invent results a weekend team could not have (user studies, accuracy
  numbers, "used by 500 students").
- Do not mention the seed, its hackathon, these instructions, or that you are an AI.

Return only JSON matching the schema."""

MUTATION = {
    "light": "Keep the core concept and stack. Change the target users or setting and swap one feature. It should look like the same kind of project, not a copy.",
    "medium": "Keep the seed's technical approach, but apply it to a different problem or audience.",
    "heavy": "Use the seed as inspiration only. Combine its main technique with one idea from the second seed into a new project.",
}
FIT = {
    "strong": "This challenge's technology or theme is central. If the seed does not use it, rebuild the core around it.",
    "medium": "Add this challenge's technology as a meaningful but secondary part.",
    "weak": "The team entered this track opportunistically; its technology plays only a small role.",
}
COMPLETION = {
    "broken": "The demo does not work end-to-end; only isolated parts run. Mention what failed.",
    "partial": "Parts work separately but are not connected, or key features are mocked.",
    "shaky": "Works end-to-end but is unreliable; mention at least one known issue.",
    "polished": "Nearly everything described works end-to-end. Future ideas go in What's next only.",
}
STYLE = {
    "terse": "Write 1-2 sentences per section.",
    "average": "Write 2-4 sentences per section.",
    "detailed": "Write 4-8 sentences per section. Also explain how components connect and why.",
}
SKILL_LABELS = {"web": "web", "ai_ml": "AI/ML", "mobile": "mobile", "hardware": "hardware",
                "game_dev": "game dev", "data": "data"}
FIELD_GUIDE = """SCHEMA FIELDS
- name: project title, 1-5 words
- tagline: one line, under 140 characters
- inspiration: why the team built it
- what_it_does: core features as the team describes them
- how_we_built_it: stack and how the parts connect
- challenges_we_ran_into: what was hard; honest about gaps
- accomplishments: what they are proud of
- what_we_learned: learning, including any AI-tool help
- whats_next: future work, not counted as built
- built_with: technologies as lowercase Devpost-style tags (python, react, databricks)
- challenges: exactly the challenge ids listed for the team"""


def seed_for_prompt(seed):
    return {k: v for k, v in seed["submission"].items() if k != "challenges" and v}


def team_prompt(team, seeds, challenges, already_in_field):
    primary = seeds[team["seed_ids"][0]]
    lines = ["SEED SUBMISSION (from a past hackathon; reuse ideas, never wording)",
             json.dumps(seed_for_prompt(primary), indent=2, ensure_ascii=False), ""]
    if team["mutation"] == "heavy":
        second = seeds[team["seed_ids"][1]]["submission"]
        lines += ["SECOND SEED (borrow one key technique or idea from it)",
                  json.dumps({k: second[k] for k in ["name", "tagline", "what_it_does"]}, indent=2, ensure_ascii=False), ""]
    lines.append("KNIGHT HACKS IX CHALLENGES THIS TEAM IS ENTERING")
    if not team["challenges"]:
        lines.append("- No sponsor challenges; the project competes only in the automatic general categories.")
    for cid in team["challenges"]:
        challenge = challenges[cid]
        lines.append(f"- {challenge['name']} ({challenge['sponsor']}): {challenge['description']}")
        lines.append(f"  Fit: {FIT[team['fit'][cid]]}")
    persona = team["persona"]
    lines += ["", "HOW MUCH TO CHANGE", MUTATION[team["mutation"]], "",
              "TEAM PROFILE",
              f"- Skill focus: {SKILL_LABELS[persona['skill_focus']]}",
              f"- Completion: {COMPLETION[persona['completion']]}",
              f"- Writing style: {STYLE[persona['writing_style']]}", "",
              "ALREADY IN THE FIELD (stay clearly different from these)"]
    lines += [f"- {p['name']}: {p['tagline']}" for p in already_in_field] or ["- (none yet)"]
    lines += ["", "Write this team's Devpost submission. Fill every field of the schema.",
              f"`challenges` must list exactly these ids: {json.dumps(team['challenges'])}."]
    return "\n".join(lines)


def batch_prompt(team_prompts):
    """System rules plus one TEAM block per team; the answer is {"projects": [...]}."""
    blocks = [SYSTEM_PROMPT, "", FIELD_GUIDE, "",
              f"This batch has {len(team_prompts)} independent teams. Write one submission per team.",
              'Return only JSON: {"projects": [{"team_id": "<id>", "submission": {...}}, ...]} '
              "with one entry per team, in the order given.", ""]
    for team_id, prompt in team_prompts:
        blocks += [f"===== TEAM {team_id} =====", prompt, ""]
    return "\n".join(blocks)


def output_schema(contract_submission_schema):
    """Batch response schema derived from the contract Submission schema, without length limits
    that strict structured-output modes reject; ingest validates the full contract schema."""
    text = {"type": "string"}
    props = {k: text for k in contract_submission_schema["properties"] if k not in ("built_with", "challenges")}
    props["built_with"] = {"type": "array", "items": text}
    props["challenges"] = {"type": "array", "items": contract_submission_schema["properties"]["challenges"]["items"]}
    submission = {"type": "object", "additionalProperties": False, "properties": props,
                  "required": list(contract_submission_schema["required"])}
    entry = {"type": "object", "additionalProperties": False,
             "properties": {"team_id": text, "submission": submission}, "required": ["team_id", "submission"]}
    return {"type": "object", "additionalProperties": False,
            "properties": {"projects": {"type": "array", "items": entry}}, "required": ["projects"]}
