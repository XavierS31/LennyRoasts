# Dev1 agent prompt — offline field and judge preparation

Paste this entire file into Dev1's agent. This continues the offline pipeline merged in PR #6; do not restart completed work.

## Assignment and starting point

Repository: [XavierS31/LennyRoasts](https://github.com/XavierS31/LennyRoasts). Work from current `main`, preserving existing workstream changes.

You are Dev1 for LennyRoasts, a Knight Hacks IX MVP built by three human developers supervising AI agents. Deliver a reviewed, Qwen-scored, immutable simulated competitor field that Dev2 can import. Work within the team's remaining 18-hour budget: a working small field comes before expansion.

Read `AGENTS.md`, `docs/TEAM_HANDOFF.md`, `plan_draft.md` sections 4–7 and 10, `contracts/README.md`, `contracts/openapi.json`, `contracts/fixtures.json`, `contracts/mock/README.md`, `offline/README.md`, and `experiments/RESULTS.md` first. The contract, including its semantic rules, controls implementation. Resolve ambiguity with the human integrator instead of inventing fields or formulas.

Use your own clone/worktree and the existing `codex/offline-field` branch if this is your ongoing work; otherwise create `codex/offline-<task>` from current main. Check status and preserve your existing work before fetching and merging `origin/main`. Edit only `offline/` and `experiments/`. Dev2 owns backend, contracts, root files, docs and CI; Dev3 owns frontend. Do not rewrite their files or create a duplicate judge/database implementation. Never run agents in another developer's checkout.

Current foundation:

- Collection, provenance, seeded sampling, Luna batch preparation/generation/ingest, copy/similarity checks, review/reject/report and scoring/export commands now exist under `offline/`. Inspect and continue them.
- `offline/README.md` reports ten accepted Luna mutations from twelve sampled teams in `kh9-smoke`, with two skipped after three attempts. These are private local artifacts, not files delivered by a Git pull. Verify their presence and review status; obtain them from your human owner before regenerating them.
- `backend.app.judging.score_submission` remains the shared live-scoring stub. Offline scoring/export depend on Dev2 implementing it and handing off the frozen `JudgeConfig`.
- `contracts/mock/` contains 200 synthetic projects, heuristic scores and saved rankings for integration. They are not Luna/Qwen results. The real field expansion target remains 109 accepted projects; show actual counts and never pad it with mock entries.

## Fixed integration boundary

Use contract version `1.0.0`. `Submission` contains exactly `name`, `tagline`, `inspiration`, `what_it_does`, `how_we_built_it`, `challenges_we_ran_into`, `accomplishments`, `what_we_learned`, `whats_next`, `built_with`, `challenges`. Follow all lengths and required fields from OpenAPI.

Only `gemini`, `elevenlabs`, `databricks`, `bny` can appear in sponsor opt-ins. Always score `overall`, `best_ai`, `best_game`, `most_useful` too. General categories do not go in `submission.challenges`. Keep all excluded tracks excluded, including Neon as a sponsor; Neon is the database only.

Import and await exactly:

```python
from backend.app.judging import score_submission
results = await score_submission(submission, challenge_ids, judge_config)
```

It returns a list of `ChallengeResult`, covering each opt-in plus all four general categories exactly once. Before enrichment, `placement` is null and `rivals`/`improvements` are empty. Reuse `backend.app.scoring_contract.validate_score_result`; do not recalculate scores yourself. Dev2 computes three-run means, relevance eligibility, exact evidence validation and later placement.

Export `PoolArtifact` with `contract_version`, `judge_version`, `pool_version`, `judge_config_sha256`, `projects`. Each `PoolProject` has `project_id`, `submission`, `meta`, `challenge_results`. Use canonical `ProjectMeta` keys/enums; `fit` keys exactly match opt-ins, metadata pool version matches the artifact, heavy mutations have two seeds and other mutations one. Hash the complete `JudgeConfig` using SHA-256 of UTF-8 JSON with sorted keys, compact separators and unescaped Unicode. Never reuse a judge version for changed configuration or mix scores from different versions.

## Work to complete, in order

1. Audit existing state, tests, challenge descriptions, seed provenance and accepted records. Preserve accepted work. Review the brief sources recorded in `offline/config/kh9_challenges.json` before finalizing judges. In particular, its Most “Useful” brief asks for funny/goofy projects; do not replace it with a generic practical-utility rubric. Hand any discrepancy with mock/API descriptions to Dev2.
2. Finish reviewed prompt drafts for all eight categories under `offline/config/`, using the plan's rubric and the exact raw schemas `OverallJudgeResponse`/`CategoryJudgeResponse`. Luna may prepare drafts once through the existing Codex account; review them before freezing. Judges receive only the submission, never persona/fit/seed/award labels. Separate intended sponsor relevance from completion, require actual gameplay for Best Game, and do not punish an already working scoped core for future features in `whats_next`.
3. Verify seed URLs, opt-ins and award provenance; do not turn unknown awards into confirmed non-winners. Preserve the configured disjoint split: Knight Hacks VII is reserved for judge examples and VIII for future backtesting. If time allows, prepare reviewed reference examples from the reserved split; otherwise hand off explicit empty example arrays rather than fabricated references. Large historical scraping/backtesting is outside the MVP.
4. Run semantic review of the existing ten accepted projects. Light mutations retain the core idea; heavy ones visibly borrow a technique from the second seed; weak sponsor fit means real incidental use, not zero use. Check candid broken/partial scope, originality of wording, renamed titles and no hidden-label leakage. Mechanical/embedding checks support review; passing them alone does not establish realism. Record rejections with the existing retry budget.
5. Keep collection, generation, semantic review and reports moving while Dev2 finishes scoring. The current generator requests `gpt-6-luna` through `codex exec`; use small serial batches and record provenance. Use the documented external-output `ingest` route if generation is run through a Codex Luna subagent instead. Do not silently substitute another model or buy separate API access. If the model/login is unavailable, report that dependency and continue the rest of the pipeline.
6. When Dev2 provides the shared scorer and final config, score a small bounded subset, inspect score/evidence/gate behavior, then score all accepted projects. Save/reuse successful results for the exact config. Do not fill failed/missing scores with heuristic data. Export and semantically validate the ten-project field, then hand it off privately to Dev2 with its config, versions, hash, commands and report.
7. Grow toward 109 only after the ten-project real flow works. Verify immutable sampling and accepted records when extending; account for skipped teams, seed-use caps and category coverage. A changed judge requires rescoring the entire final field. A smaller validated field is acceptable; a claimed 109 without accepted/exported records is not.
8. Add focused tests for any changed behavior, especially resumability, malformed/duplicate batch entries, version/hash mismatch, unavailable scoring and export rejection of incomplete results. Do not spend the remaining time rebuilding modules that already pass meaningful checks.

## Commands and verification

Run from the repository root; create `.venv` with Python 3.13 if absent. Install dependencies without changing another owner's requirements.

```sh
.venv/bin/python -m pip install -r backend/requirements.txt -r offline/requirements.txt
.venv/bin/python -m pytest offline/tests -q
.venv/bin/python -m backend.tools.check_contracts
.venv/bin/python -m offline.cli --help
.venv/bin/python -m offline.cli review --field kh9-smoke
.venv/bin/python -m offline.cli report --field kh9-smoke
```

The last two commands require the private field artifacts. Use the existing README's `prepare`, `generate`, `ingest`, `reject` and `sample` commands as needed. Do not automatically regenerate the smoke field on every setup.

After the scorer/config handoff, replace placeholders with actual ignored local paths:

```sh
.venv/bin/python -m offline.cli score --field kh9-smoke --judge-config <judge_config.json> --limit 1
.venv/bin/python -m offline.cli score --field kh9-smoke --judge-config <judge_config.json>
.venv/bin/python -m offline.cli export --field kh9-smoke --judge-config <judge_config.json>
.venv/bin/python -m offline.cli validate-artifact --artifact <artifact.json> --judge-config <judge_config.json>
```

Inspect large JSON programmatically, not by pasting the whole field into an agent prompt. Keep copied stories, generated projects, scores, raw responses and runtime provenance under ignored `.local-tests/offline/`; never commit them or credentials. Commit code, reviewed configs, synthetic unit fixtures and sanitized evidence only. No Neon schema or direct table writes belong here.

## Handoffs and definition of done

First handoff: reviewed eight-track brief/prompt drafts, reference availability, ten-project review status and exact dependency on Dev2's config/scorer. Do this early, before field expansion. Final handoff: a contract- and semantics-valid scored artifact, matching complete `JudgeConfig`, SHA-256, actual accepted/eligible category counts, report, provenance, preparation commands and private artifact location. Your human owner coordinates the private transfer; do not send messages or publish data without their instruction.

Before a PR, save your work, fetch/merge current main, run your tests, `git diff --check` and `.venv/bin/python backend/tools/check_ownership.py`. Commit, push and open a small PR limited to your paths; do not merge it. Dev2's human owner integrates reviewed PRs serially. Update `offline/README.md` with verified status and commands.

Finish with the PR URL, changed files, actual checks, artifact versions/counts, what Dev2 needs next and unresolved blockers. Distinguish teammate-reported local work from artifacts you inspected, successful Qwen scoring, and verified import; never claim human-judge accuracy or deployment from unit tests.
