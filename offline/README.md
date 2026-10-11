# Offline preparation — Person 1

Builds the frozen simulated field: real Devpost seeds → sampled team plans → GPT-6 Luna batches through Codex → mechanical, similarity and semantic checks → scoring with the shared `backend.app.judging.score_submission` → a contract-valid `PoolArtifact`. See plan sections 4 and 10, [the contract](../contracts/README.md) and [the team handoff](../docs/TEAM_HANDOFF.md).

Committed here: code, tests, the KH IX challenge config, field settings and the seed provenance manifest. Seed write-ups, generated projects, scores and artifacts are written only under the Git-ignored `.local-tests/offline/`. There is no second Qwen client, calculation scheme or database schema here: score checks reuse `backend.app.scoring_contract`, schemas come from `backend.app.contracts`, and Person 2 supplies the database import command.

## Setup

Use the root Python environment from `backend/requirements.txt`, plus `offline/requirements.txt` for the embedding model. Run from the repo root:

```sh
.venv/bin/python -m pip install -r backend/requirements.txt -r offline/requirements.txt
.venv/bin/python -m offline.cli --help
.venv/bin/python -m pytest offline/tests -q
```

`generate` needs a logged-in Codex CLI. The commands below write `python -m offline.cli` for brevity.

## Layout

| Path | Purpose |
| --- | --- |
| `config/kh9_challenges.json` | Four sponsor and four general challenges with verbatim official briefs (Devpost page and Hacker's Guide, read 2026-10-10), sponsor tech tags and popularity weights |
| `config/field_settings.json` | Opt-in/fit/persona shares, seed cap, retry budget, similarity cutoff, pinned embedding model, generator settings, judge-example/backtest split |
| `config/seed_manifest.json` | Seed provenance: Devpost URL, hackathon, year, prize opt-ins, pool, skills. No story text |
| `config/seed_sources.json` | Scouted prize sources per pool, seeds-per-pool targets, winner share, "Built with" tag → skill map |
| `devpost.py`, `collect.py` | Prize-filter recipe from plan 4.4; parsing is pure, fetching is throttled |
| `seed_pool.py` | Deterministic seed selection: merged opt-ins, per-pool shuffled order, winner quota, tag-derived skills, reserved-hackathon listing check |
| `sampler.py` | Challenge assigner, persona sampler, least-used seed picker. Per-team RNG, so growing the field never changes existing teams |
| `prompts.py`, `generate.py` | Plan 4.8 mutation prompts, batched; `codex exec -m gpt-6-luna` in a read-only sandbox with an output schema, recording provenance |
| `checks.py`, `similarity.py` | Plan 4.9 checks: schema, exact challenge ids, style lengths ±50%, sponsor tech, leaked labels/hackathon names, completion honesty, renamed title/tagline, 12-word copy runs, cosine > 0.95 to seeds or accepted projects |
| `field.py` | Field state, batches, ingest with a 3-attempt budget, optional review sheet and reject, pool report |
| `scoring.py`, `artifact.py` | Calls the shared scorer, adds offline checks, exports and validates `PoolArtifact` |

## Commands

```sh
# Schema-only check of any local file
python -m offline.cli validate PoolArtifact .local-tests/pool.json

# 1. Seeds (provenance is committed; text goes to .local-tests/offline/seeds/)
python -m offline.cli prizes --hackathon swamphacks-xi                     # prize filter ids
python -m offline.cli optins --hackathon swamphacks-xi --prize-id 95345    # every opt-in, W = winner badge
python -m offline.cli fetch-seeds                                          # awards read from project pages
#    growing the manifest from config/seed_sources.json:
python -m offline.cli scout                                                # opt-in lists per prize source
python -m offline.cli grow-seeds                                           # append seeds up to each pool target

# 2. Team plans (create, or extend later toward 109 without changing existing teams)
python -m offline.cli sample --field kh9-smoke --teams 10

# 3. Luna generation, one batch at a time (run batches serially)
python -m offline.cli prepare --field kh9-smoke --size 5
python -m offline.cli generate --field kh9-smoke --batch b001   # Codex/Luna, then automatic ingest
#    failing teams return to pending; `prepare` + `generate` again for retries (3 attempts, then skipped)
python -m offline.cli ingest --field kh9-smoke --batch b001 --output <answer.json> --model gpt-6-luna
#    re-validates an answer produced outside `generate`

# 4. Pool report (projects passing the automatic checks are accepted; no manual review step)
python -m offline.cli report --field kh9-smoke       # writes pool_report.json
#    optional spot checks:
python -m offline.cli review --field kh9-smoke       # writes review.md beside the field
python -m offline.cli reject --field kh9-smoke --team t004 --reason "light mutation changed the core concept"

# 5. Scoring with backend.app.judging.score_submission, then export
python -m offline.cli score --field kh9-smoke --judge-config <judge_config.json>
python -m offline.cli export --field kh9-smoke --judge-config <judge_config.json>   # pool_version defaults to kh9-smoke-n<count>
python -m offline.cli validate-artifact --artifact <artifact.json> --judge-config <judge_config.json>
```

## Rules the code enforces

- A rewrite that passes every mechanical, copy and similarity check is accepted automatically. Semantic properties (light keeps the core concept, weak fit is really incidental) are not checked by hand.
- Judges only ever receive `submission`; seed ids, persona, fit and awards stay in hidden metadata.
- Seeds may not come from Knight Hacks VII (reserved for judge reference examples) or Knight Hacks VIII (reserved for the KH25 backtest), nor list either hackathon in their Devpost sidebar.
- `grow-seeds` only appends to the manifest, picks candidates in a fixed seeded order per pool (winner-badge projects first, up to `winner_share`), skips pages missing name, what it does or how it was built, and derives skills from "Built with" tags. Extending a field keeps every existing team's plan and seeds.
- Scores are saved per `judge_version` with the config SHA-256. A changed config under the same version is refused, and so is export with any unscored project. Pool versions are immutable once exported.
- Offline results must pass `validate_score_result`, have null placement and empty rivals/improvements, and cover exactly the sponsor opt-ins plus the four general categories.

## Status

Smoke field `kh9-smoke`: 10 Luna mutations accepted on automatic checks, of 12 sampled teams (2 skipped after three failed attempts), stored locally. The seed manifest has grown from 18 to 77 seeds (general 20, BNY/Gemini/ElevenLabs 15 each, Databricks 12; 9 with a won prize on their page), enough for 109 teams under the 3-use cap; the field has been extended to 109 team plans with the first 12 unchanged, and Luna generation for the new teams runs locally. Scoring and export wait for the implemented `score_submission` and the frozen live `JudgeConfig`.
