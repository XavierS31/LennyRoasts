# Dev2 evidence and handoff — October 11, 2026

Current work is on `codex/backend-live-field` in the clean Dev2 checkout, synced to `origin/main` at `001c900` (merged PR #38). Dev1 completed scoring/export; Dev2 imported the complete 106-project v6 field into the configured Neon database and verified local API/browser integration. No competitor was rescored, judge config changed, offline code edited or handwritten frontend file edited. The three endpoints and async scorer signature are unchanged.

## Current verified integration

- Artifact: `offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json`; pool `kh9-smoke-n106`, judge `kh9-qwen32b-v6`, wire contract `1.0.0`, frozen config SHA-256 `46a532c5938db8e4ffb67dfc966bfbfdfbbdb62e243f14aab2043244ef12da79`.
- Both `offline.cli validate-artifact` and `backend.tools.import_field --validate-only` passed against the current config. All 106 projects have exactly three validated runs per applicable category. This checks cached artifacts, not human-judge agreement or a repeat of Dev1's generation/similarity checks.
- `HF_TOKEN`, `DATABASE_URL`, `DATABASE_URL_DIRECT` were present; values were never printed. Direct and pooled Neon connections use client TLS. Applied `001_initial.sql` matches its checksum; running migrations applied nothing further.
- Default atomic import activated the field; a second identical import returned `idempotent=true`. A fresh Neon read reconstructed and validated the artifact/hash: 106 projects, 1,779 per-run score rows, actual counts below. No new dataset copy was committed.
- Live backend is running on `127.0.0.1:8110`, explicitly `LENNY_MODE=live`, one worker, access logs disabled. Pre-existing Dev3 Vite 5174 and preview 5175 processes were preserved. The existing 5174 `/api` proxy reaches this backend and accepts same-origin POST/cookies. Preview 5175 was preserved but its live API flow was not tested.
- Real HF/DeepInfra Qwen all-eight-category API check through port 5174: POST 202 queued → polling GET running → completed in **41.75 seconds**, correct captured v6/n106 versions, 24 validated provider responses with Qwen3-32B metadata and no invalid-response retries. No live failure or mock substitution occurred.
- All returned arithmetic/three-run semantics and displayed evidence passed validation against the submitted text. Rankings were independently recomputed against the imported cache, including ties, matching run indices, eligible N and N+1 denominators. Every category's improvements and rationale matched its selected provider run; no feedback template substitution was needed. Quote suppression warnings were retained.
- Another session received contract-shaped 404 before and after a controlled backend restart. With no outstanding work, only this turn's backend process was stopped and restarted. The owner's completed report was identical after restart; readiness and active versions remained correct. Completed submission input was cleared in Neon. Reports retain the existing one-hour TTL; restart persistence is not indefinite retention.
- Browser check on the existing Dev3 development server: loaded the UI sample, submitted to live Qwen, observed running then completed, entered Engineering II and opened the report. Its five categories had 15 validated provider responses with no invalid-response retries; completion was observed by **24.43 seconds after job creation** (an observation upper bound, not exact scoring time). The browser displayed live v6/n106 labels, simulated-practice wording, 47 Gemini competitors / 48 entries and 106 Overall competitors / 107 entries, AI 95 / 96, ineligible Game and Most “Useful” with no placement, exact evidence/not-described fields, quote warnings, three scoring runs, rivals and judge-written improvements. Its ranks were also independently recomputed.
- Browser screenshots, session cookies, submission/report checks and raw diagnostics remain ignored under `.local-tests/`; none are in this PR or posted to issues. Existing raw-diagnostic expiry remains one hour. Browser verification used a synthetic sample with real live scoring against the real-seed Luna field; it is not a real entrant or deployment proof.

| Category | Considered | Eligible competitors | Entries with an eligible user |
| --- | --- | --- | --- |
| Overall | 106 | 106 | 107 |
| Best AI | 106 | 95 | 96 |
| Best Game | 106 | 14 | 15 |
| Most “Useful” | 106 | 13 | 14 |
| Gemini | 51 | 47 | 48 |
| ElevenLabs | 45 | 41 | 42 |
| Databricks | 30 | 20 | 21 |
| BNY | 43 | 32 | 33 |

Current local checks: **92 backend/offline tests passed**, **14 frontend tests passed**, contract/mock semantic checks passed, frontend `npm ci`, generated-type command (no type diff), TypeScript/Vite build passed. Vite retains the existing >500 kB chunk warning. Ownership and diff checks passed for the documentation handoff. No new source behavior, schema, migration, contract JSON or judge setting was changed.

## Remaining handoff and limits

- [#11](https://github.com/XavierS31/LennyRoasts/issues/11): Dev2 import/live acceptance is complete using the agreed PR #38 artifact. The old v5/private-ten-project/scoring instructions are superseded. Dev1's scoring/export must not be repeated for this integration.
- [#12](https://github.com/XavierS31/LennyRoasts/issues/12): Dev3 still owns responsive layout, browser 422/503/failed-job/no-fallback states, pause/resume/reload/session behavior and full demo rehearsal. The form's privacy footer (`frontend/src/App.tsx`) still discusses the current mock's in-memory storage while live mode is active; Dev3 should describe input clearing and the one-hour live report/session TTL. No handwritten frontend patch was made by Dev2.
- Known frozen-judge limitation: the all-track synthetic control described Gemini but no Databricks integration, yet Databricks relevance was 3 in all three runs and it qualified. Its Overall placement also spanned 1–107 because of run variation and ties. These are real outputs from the frozen judge, not corrected outcomes or calibrated uncertainty. Do not change the judge without a version bump and full field rescore; none was attempted here.
- Luna rewrites and automatic acceptance do not establish realism; Qwen scores and exact quotes do not verify software execution, rationale truth or human-judge agreement. Reference arrays remain empty. Local integration is verified; production hosting, HTTPS/proxy configuration and deployment are not.

## Historical implementation and evidence — October 10

PRs #8, #13 and #14 delivered the shared scorer, storage/import and live worker. The following earlier checks describe their original boundaries; they are superseded by the current integration above where explicitly stated.

Implemented:

- Exact shared async `backend.app.judging.score_submission(submission, challenge_ids, judge_config)` used by Dev1's existing pipeline and live jobs.
- HF router, fixed Qwen3-32B/DeepInfra selector, 0.2 temperature, schema output, `/no_think`, 1,200-token cap; no route/model/mock fallback. Returned model metadata is checked.
- Three complete validated runs/category, exact keys and integer criteria, arithmetic means, Overall /20, categories /25, majority eligibility/disagreement warnings, exact quote suppression, deterministic nearest-mean rationale/evidence selection. Private raw diagnostics expire after one hour.
- Complete eight-category config (now frozen as v6) with real collected briefs and empty reference arrays. Most “Useful” means funny/goofy, Game requires gameplay, and fit is separate from completion. Actual schema bytes and aggregation protocol are included in the config hash through its prompts. A narrower provider rationale grammar requires one sentence (within the contract's maximum of two) while retaining all contract keys/types.
- Versioned Neon SQL migration, immutable config/field/project/score rows, atomic/idempotent validated import and activation, persistent private jobs and TTL cleanup.
- Real background execution after POST, snapshot versions, read-only GET, worker/admission bounds, explicit restart failure, matching-run ranking and criterion-grounded feedback. Explicit mock mode remains unchanged.
- CI installs offline dependencies and runs backend/offline tests alongside existing ownership/type/build checks.

## Historical evidence actually obtained — October 10

Local: 64 backend/offline tests passed (43 backend, 21 offline), authoritative contract/200-project mock checks, frontend clean install/generated-type cleanliness/build, ownership guard and diff checks pass. Exact final test counts and current PR links appear in the PR descriptions.

Remote database: the supplied pooled and direct Neon URLs connected with **client-side TLS**. Migration `001_initial.sql` applied in the public schema; rerun was idempotent. Seven application tables plus schema_migrations exist. At that checkpoint there was **no active live field**. PostgreSQL's internal pg_stat_ssl is behind Neon's proxy and did not represent client TLS; psycopg's client ssl_in_use was verified directly.

Isolated Neon replay: a temporary schema was created, tested and removed. One synthetic replay project and 15 run rows verified atomic/idempotent import, immutable triggers, private-session 404, POST-started worker without GET, completed report persistence across restart, clearing private inputs, interrupted-job failure and second-worker exclusion. The actual pooled connection's transaction worker lock separately blocked a second instance. These are PostgreSQL/live-storage checks with replay inference, **not** a real competitor-field/live-Qwen flow. No replay field was activated in public/live storage.

Provider: HF model metadata reports Qwen/Qwen3-32B with DeepInfra live. Initial v1 provisional smoke obtained three validated runs each for Overall, non-game, playable game and an injected unrelated ElevenLabs case. Game qualified; non-game/injection did not; one game quote was suppressed. v2 aligned plan anchors and completed one all-eight-category synthetic case (24 validated runs), but a separate game control exhausted retries on excess rationale sentences. v3 requested one sentence, passed a game control, but another all-eight case still exhausted retries on prose bounds. Those failures were retained privately; no partial report was published. v4 constrains the rationale in the provider schema and completed all eight categories (24 validated runs) in 48.6 seconds with three quote warnings; a playable game control qualified in 4.2 seconds and an injected unrelated ElevenLabs control stayed ineligible in 4.3 seconds. The non-game all-category control remained ineligible. These small controls do not measure human-judge agreement, predictive accuracy or deployment.

Combined isolated live integration: Qwen scored one synthetic competitor (15 validated runs), imported into a temporary Neon schema, then the actual API worker Qwen-scored a synthetic user (15 validated runs). POST queued → GET running → completed, captured versions, Overall placement out of 2, a separate-session 404 and report persistence across restart all passed. The schema was removed. Config `kh9-qwen32b-v4-isolated-smoke`, hash `166e3f4f16d2078e717618726daf0bdacba46e53b3870f5316f0ec8e42b8c142`, pool `test-replay-field-v1` (one authored synthetic control, but real Qwen scores). This is combined provider/database/API evidence, **not** the ten-project real-seed/Luna field or deployment.

Live server wiring: started the actual uvicorn app on free port 8111 because an existing process occupied 8110. Public Neon had no active field: challenges returned field_ready=false, POST returned 503, missing/private GET returned 404 and malformed JSON returned 422, all contract-valid. The temporary server was stopped; the pre-existing 8110 process was preserved.

## Copyable commands

```sh
.venv/bin/python -m pip install -r backend/requirements.txt -r offline/requirements.txt
.venv/bin/python -m backend.tools.check_contracts
.venv/bin/python -m pytest backend/tests offline/tests -q
.venv/bin/python -m backend.tools.judge_smoke --case all
.venv/bin/python -m backend.tools.neon_smoke
.venv/bin/python -m backend.tools.live_integration_smoke  # bounded paid calls; isolated synthetic control
.venv/bin/python -m backend.tools.migrate
# Dev1 scoring/export is complete; validate/import the unchanged handoff:
.venv/bin/python -m backend.tools.import_field --artifact offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json --judge-config backend/config/judge_config.json --validate-only
.venv/bin/python -m backend.tools.import_field --artifact offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json --judge-config backend/config/judge_config.json
LENNY_MODE=live .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --workers 1 --no-access-log
```

See backend/README.md for startup/deployment/privacy limits. Provisional imports are rejected, so these field commands cannot accidentally activate a moving judge. Credentials are configured only in ignored `.env.local`; no credential values, new runtime artifacts or raw results belong in Git/issues/PRs. PR #38 already contains the agreed field handoff; do not duplicate it.
