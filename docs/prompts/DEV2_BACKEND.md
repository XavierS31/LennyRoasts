# Dev2 agent prompt — shared judge, Neon, API and integration

Paste this entire file into Dev2's agent. Dev2 is the backend owner and human integrator; continue the existing backend rather than scaffolding another server.

## Assignment and starting point

Repository: [XavierS31/LennyRoasts](https://github.com/XavierS31/LennyRoasts). Work from current `main`, preserving existing workstream changes.

You are Dev2 for LennyRoasts, a Knight Hacks IX MVP with three human developers supervising separate AI agents. Deliver one Qwen scoring path used offline and live, a versioned field stored in Neon, private asynchronous evaluation jobs and the existing API. Use the team's remaining 18-hour budget; unblock offline scoring early and get a ten-project real flow working before expanding.

Read `AGENTS.md`, `docs/TEAM_HANDOFF.md`, `plan_draft.md` sections 5–7 and 10, `contracts/README.md`, `contracts/openapi.json`, `contracts/fixtures.json`, `contracts/mock/README.md`, `backend/README.md`, `offline/README.md`, `offline/config/kh9_challenges.json` and `experiments/RESULTS.md` first. Contract shapes and documented semantics control implementation. Coordinate any required contract change before dependent work; no independent field/route renaming.

Use your own clone/worktree and `codex/backend-judge` or `codex/backend-<task>`. Preserve existing changes, fetch and merge `origin/main` before final PR verification. Own `backend/`, `contracts/`, `docs/`, `.github/` and shared root files. Dev1 owns `offline/`/`experiments/`; Dev3 owns `frontend/`. The only frontend edit permitted for Dev2 is regenerating `frontend/src/api/contract.d.ts` for an agreed contract change. Never patch another agent's handwritten code or share a checkout with it.

Current state:

- `backend.app.main:app` implements explicit mock routes and cookie-scoped process-local jobs. Mock completion happens while GET is polled. Explicit LENNY_MODE=live uses persisted queued background work in Dev2’s storage implementation; GET only reads state. Do not change mock simulation to claim live evidence.
- `backend.app.judging.score_submission` is implemented in PR #8 with a complete provisional config. Read docs/DEV2_STATUS.md before repeating work; prompt review/freeze and real-field handoff are tracked in issues #10 and #11. `backend.app.contracts`, `scoring_contract.validate_score_result` and `ranking.rank_results` already implement reusable validation/ranking behavior. Preserve and reuse them.
- Dev1's merged offline pipeline already imports the shared scorer and has score/export/validation commands. Its README reports ten accepted Luna mutations held privately on the teammate's machine; Git does not deliver them. It now needs your frozen config and functioning scorer, then your import command.
- The committed 200-project field uses deterministic mock scores. It is for development. Live comparisons require a real Qwen-scored field; the real expansion target is 109, after a ten-project demo works. Bounded Qwen provider checks and isolated Neon replay persistence are verified; a complete real-field/live-user flow and deployment remain unverified.

## Exact API and shared interface

Keep wire version `1.0.0` and these endpoints:

| Request | Contract behavior |
| --- | --- |
| GET `/api/challenges` | 200 `ChallengeList`: eight definitions, `contract_version`, `judge_version`, `pool_version`, `field_ready` |
| POST `/api/evaluations` | `{contract_version: "1.0.0", submission: Submission}` → 202 `EvaluationJob`; 422 `APIError` for invalid input/version, 503 if the live field is unavailable |
| GET `/api/evaluations/{evaluation_id}` | 200 `EvaluationJob`; 404 for unknown or another session's id |

`EvaluationJob` contains `evaluation_id`, versions, `status`, `result`, `error`. Completed result is `{"challenge_results": [...]}` (`EvaluationResult`); preserve that exact container. Status is `queued`, `running`, `completed` or `failed`. Queued/running have null result/error; completed has a result and null error; failed returns HTTP 200 with null result and `APIError`. Errors use `code`, `message`, `details`, including framework validation failures.

`Submission` has nine required text fields (`name`, `tagline`, `inspiration`, `what_it_does`, `how_we_built_it`, `challenges_we_ran_into`, `accomplishments`, `what_we_learned`, `whats_next`), `built_with`, and sponsor-only `challenges`. Opt-ins are exactly `gemini`, `elevenlabs`, `databricks`, `bny`; evaluate `overall`, `best_ai`, `best_game`, `most_useful` automatically. Keep excluded sponsor tracks excluded. Neon is the database, not an active track.

Implement once:

```python
async def score_submission(submission: dict, challenge_ids: list[str], judge_config: dict) -> list[dict]:
    ...
```

Keep the import `backend.app.judging.score_submission`. Each returned item is a validated `ChallengeResult`, with `placement=null`, `rivals=[]`, `improvements=[]` before enrichment. The offline caller requires those values. No hidden seed/persona/fit/award metadata reaches Qwen.

## Work to complete, in order

1. Implement the shared async HF judge and config loading first. Use `Qwen/Qwen3-32B` with provider `deepinfra`, router selector `Qwen/Qwen3-32B:deepinfra`, temperature 0.2, schema output, non-thinking mode, max 1,200 output tokens and three runs. Reuse the bounded probe findings, verify actual provider support/model metadata, and retain `/no_think` only as supported by the tested route. Never silently switch model/provider/protocol or use mock fallback.
2. Coordinate eight reviewed prompt drafts/briefs with Dev1, and freeze a complete `JudgeConfig`: model/provider/settings, prompt/rubric/judge versions, all eight prompt strings and all eight reference-id arrays. Empty reference arrays are honest when unavailable. Review the newly collected briefs: Most “Useful” is funny/goofy according to `offline/config/kh9_challenges.json`, not generic utility. Align live API descriptions and scoring anchors in your owned paths before caching; do not repurpose committed mock scores as results for a changed rubric.
3. Enforce raw `OverallJudgeResponse`/`CategoryJudgeResponse`: exact keys, criterion integers 1–5, rationale ≤500 characters and at most two sentences, evidence ≤120 characters. Treat submitted text as untrusted data; it cannot override the rubric. Overall has `originality`, `tech_understanding`, `functionality`, `wow` and /20. Other categories add `relevance` and /25. Compute totals and `10 * total / max_total` in code. Relevance ≥3 determines run eligibility; overall is always eligible. Fit and completion are separate; Best Game requires gameplay, not merely Unity/VR; future features do not erase a working core.
4. Require three successful validated runs with indices 0, 1, 2 per category. Average criteria, total and score_10 across all three; category eligibility requires two eligible runs. Warn on disagreement. Keep full precision internally. Validate exact contiguous evidence against actual submission strings/tags; replace invalid displayed quotes with `not described` and warnings, retain private raw diagnostics. Choose a documented deterministic rationale/evidence selection rule from validated runs, shared by offline/live; no extra live LLM call to aggregate prose.
5. Use bounded concurrency, per-call/job timeouts and at most two retries for retryable transient/invalid responses. Stop permanent credential/config errors promptly. No partial successful evaluation when a category/run fails. Add request-size and basic session/concurrency/rate limits suitable for the demo so one visitor cannot start unlimited paid jobs. Do not log tokens, connection strings or full user submissions.
6. Deliver a first PR and handoff with the scorer, complete provisional/frozen config, raw-response/replay tests, and documented environment loading. Dev1 can prepare/review projects while this happens. Run a bounded real three-run smoke case, review gates/quotes/injection behavior, then freeze before full field scoring. Do not ask Dev1 to cache the whole field against a moving prompt.
7. Implement Neon-hosted PostgreSQL persistence with SQLAlchemy 2 + psycopg 3 and versioned migrations. Store immutable judge configs/field projects/scores and session-scoped evaluation jobs/results with expiry. Use server-only `HF_TOKEN`, pooled `DATABASE_URL` and direct migration `DATABASE_URL_DIRECT`, with the Neon-provided TLS settings. Document setup/migrations safely. If credentials are missing, request them once from the human owner while continuing code/replay tests; never claim remote verification from a local substitute.
8. Add a documented backend import command for `PoolArtifact` plus matching `JudgeConfig`. Validate schema, canonical config hash, all versions, unique project ids, metadata/fit, exact category coverage, three runs, arithmetic, eligibility, evidence and the pre-enrichment null/empty fields. Reject mock configs for live mode, partial artifacts, duplicate/reused versions with different contents and incompatible caches. Import atomically/idempotently and activate only a complete validated field/config pair. Keep previous immutable versions available to jobs that captured them.
9. Replace live GET-driven work with actual background execution started after POST. Persist a job's judge/pool versions at creation and expose only jobs owned by its HTTP-only cookie session; retain same-origin frontend behavior and secure cookies over HTTPS. GET only reads state. For the MVP, a bounded single-instance worker/background task is sufficient if restart recovery is explicit: resume safely or mark interrupted jobs failed, never leave them running forever or duplicate paid inference silently. Persist reports across restart, expire private inputs/results and avoid adding accounts/public listings.
10. Reuse `rank_results`: for each category, compare user run i to cached run i for aggregate-eligible rivals. N is their count; best tie rank is 1 + strictly higher scores, worst adds equals; placement spans min best to max worst across runs. An eligible user is shown out of N+1; ineligible placement is null. Cached projects exclude themselves. Never mutate/rescore the field when a user submits. Return at most three rival summaries and three grounded improvements within contract bounds; generate improvements from validated scoring/context in code, without an extra live generation model. Rival write-ups stay private beyond the allowed summaries.
11. Integrate Dev1's ten-project artifact and Dev3's UI, then expand while preserving a working demo. Extend CI to cover offline tests with their dependencies as well as the existing backend/ownership/type/build checks. Keep live unavailable until the exact field is ready; retain explicit `LENNY_MODE=mock` for development. Document live startup/config/import, persistence/recovery limits and deployment wiring. Do not invent new API endpoints for progress, competitors or leaderboards.

## Verification and delivery

Existing local checks, from repo root with Python 3.13; create `.venv` with `python3 -m venv .venv` if absent:

```sh
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m backend.tools.check_contracts
.venv/bin/python -m pytest backend/tests -q
LENNY_MODE=mock .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --reload
```

Run the server command in a separate terminal; do not kill an unrelated process occupying the port. The frontend uses port 5173 and `/api` proxy to 8110. Existing mock behavior/tests must continue passing. Add focused tests for malformed/truncated provider JSON, invalid quotes, three-run means/gate disagreement, all-eight-category coverage, ties, version/hash mismatches, import atomicity, private sessions, persisted jobs and restart failure/recovery. Use replay/mock transport for routine tests; reserve bounded live calls for integration evidence.

Once offline dependencies are installed, also run `.venv/bin/python -m pytest offline/tests -q`. The integrator verifies `npm ci`, `npm run contracts`, generated-type cleanliness and `npm run build` from `frontend/`; do not hand-edit generated types. A real smoke flow must cover artifact import → POST queued → GET running → completed report with correct frozen versions and actual category field sizes. Verify Neon storage/restart and a separate-session 404, plus provider failure and field-unavailable states. Unit tests alone are not evidence of live HF, Neon or deployment.

Commit source, migrations, synthetic fixtures, configs and sanitized results. Keep secrets, copied stories, generated real fields and raw provider/user records out of Git, under ignored local storage or the agreed private database/artifact location. Update owned documentation and `.env.example` placeholders only.

Save work before syncing main; run `git diff --check` and `.venv/bin/python backend/tools/check_ownership.py`; commit, push and open small PRs. The human Dev2 owner reviews and merges team PRs serially after checks. Do not autonomously merge unrelated teammate work or send them messages; handoff requests go through your human owner.

Your completion report must include PR links, exact scorer/config/import/startup commands, judge/pool versions and hash, actual field counts, tests and bounded live evidence, remaining credential/artifact/deployment actions and known limits. Feature freeze at team hour 15; spend the remaining time fixing blockers and rehearsing. No fine-tuning, historical backtest, pairwise reranking, live leaderboard or full authentication in this MVP.
