# Offline field preparation

Builds the frozen simulated field: real Devpost seeds → sampled team plans → generator batches → mechanical and similarity checks → scoring with the backend's shared `score_submission` → a contract-valid `PoolArtifact`. See plan sections 4 and 10 and [the contract](../contracts/README.md).

Committed here: code, tests, the KH IX challenge config, field settings and the seed provenance manifest. Seed write-ups, generated projects, scores and artifacts are written only under the Git-ignored `.local-tests/offline/`.

## Layout

| Path | Purpose |
| --- | --- |
| `config/kh9_challenges.json` | Four sponsor and four general challenges with verbatim official briefs (Devpost page and Hacker's Guide, read 2026-10-10), sponsor tech tags and popularity weights |
| `config/field_settings.json` | Opt-in/fit/persona shares, seed cap, retry budget, similarity cutoff, pinned embedding model, judge-example/backtest split |
| `config/seed_manifest.json` | Seed provenance: Devpost URL, hackathon, year, prize opt-ins, pool, skills. No story text |
| `devpost.py`, `collect.py` | Prize-filter recipe from plan 4.4; parsing is pure, fetching is throttled |
| `sampler.py` | Challenge assigner, persona sampler, least-used seed picker. Per-team RNG, so growing the field never changes existing teams |
| `prompts.py` | Mutation prompts from plan 4.8, batched per generator call |
| `generate.py` | Sends a batch to GPT-6 Luna with `codex exec` (read-only sandbox, output schema) and records provenance. Needs a logged-in Codex CLI |
| `checks.py`, `similarity.py` | Plan 4.9 checks: schema, exact challenge ids, style lengths ±50%, sponsor tech, leaked labels/hackathon names, completion honesty, renamed title/tagline, 12-word copy runs, cosine > 0.95 to seeds or accepted projects |
| `field.py` | Field state, batches, ingest with a 3-attempt budget, review sheet, reject, pool report |
| `scoring.py`, `artifact.py` | Calls the backend scorer (no judge client here), checks contract arithmetic, exports and validates `PoolArtifact` |

## Setup

Python 3.11+. Run from the repository root:

```sh
uv run --no-project --with-requirements offline/requirements.txt python -m offline --help
# or: python3 -m pip install -r offline/requirements.txt && python3 -m offline --help
uv run --no-project --with-requirements offline/requirements.txt python -m pytest offline/tests -q
```

The commands below write `python -m offline` for brevity.

## Commands

```sh
# 1. Seeds (provenance is committed; text goes to .local-tests/offline/seeds/)
python -m offline prizes --hackathon swamphacks-xi            # prize filter ids
python -m offline optins --hackathon swamphacks-xi --prize-id 95345   # every opt-in, W = winner badge
python -m offline fetch-seeds                                 # fetch manifest seeds; awards read from project pages

# 2. Team plans (create, or extend later to 109 without changing existing teams)
python -m offline sample --field kh9-smoke --teams 10

# 3. Generation with GPT-6 Luna through Codex, one batch at a time (run batches serially)
python -m offline prepare --field kh9-smoke --size 5          # batches/b001/prompt.md + output_schema.json
python -m offline generate --field kh9-smoke --batch b001     # codex exec -m gpt-6-luna (read-only), then ingest
#    saves answer.json, provenance.json and codex_stderr.log beside the batch; failing teams return to
#    pending, so run `prepare` + `generate` again for retries (3 attempts total, then skipped)
python -m offline ingest --field kh9-smoke --batch b001 --output <answer.json> --model gpt-6-luna
#    ingest alone re-validates an answer produced outside `generate` (e.g. a manual Codex session)

# 4. Semantic review and pool report
python -m offline review --field kh9-smoke                     # writes review.md beside the field
python -m offline reject --field kh9-smoke --team t004 --reason "light mutation changed the core concept"
python -m offline report --field kh9-smoke                     # writes pool_report.json

# 5. Scoring with the backend's shared module, then export
python -m offline score --field kh9-smoke --scorer <backend.module>:score_submission --judge-config <judge_config.json>
python -m offline export --field kh9-smoke --judge-config <judge_config.json>   # pool_version defaults to kh9-smoke-n<count>
python -m offline validate-artifact --artifact <artifact.json> --judge-config <judge_config.json>
```

## Rules the code enforces

- Judges only ever receive `submission`; seed ids, persona, fit and awards stay in hidden metadata.
- Seeds may not come from Knight Hacks VII (reserved for judge reference examples) or Knight Hacks VIII (reserved for the KH25 backtest).
- Scores are saved per `judge_version` with the config SHA-256. A changed config under the same version is refused, and so is export with any unscored project. Pool versions are immutable once exported.
- Offline results must have null placement, empty rivals/improvements, runs 0–2, contract totals/score_10/eligibility, and exactly the sponsor opt-ins plus the four general categories.

## Handoff assumptions for the backend owner

- `score_submission(submission, challenge_ids, judge_config)` is called with the sponsor opt-ins **plus** `overall`, `best_ai`, `best_game`, `most_useful`, and `judge_config` as the `JudgeConfig` JSON dict. It may be sync or async and must return JSON-compatible `ChallengeResult` dicts.
- The judge config file and scorer import path come from the backend; this folder does not define either.
- The backend import tool loads the exported artifact into Neon. Nothing here touches the database.
