# Backend — Person 2

Run from the repository root with Python 3.13+:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt -r offline/requirements.txt
LENNY_MODE=mock .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --reload
```

The frontend proxies `/api` to `http://127.0.0.1:8110`. Keep the three endpoints in `contracts/openapi.json`, wire version 1.0.0 and completed `result.challenge_results` unchanged. `/docs` serves the contract. Handwritten frontend and offline code belong to their owners.

Mock mode uses the committed 200-project synthetic heuristic field. `LENNY_MODE=fixture` is an alias. POST returns queued; first GET simulates running; later GET computes/caches mock completion. Mock jobs are process-local and disappear on restart. No HF/Neon requests occur. Mock and Qwen fields/configs are distinct; mock scores never substitute for unavailable live judging.

## Shared scorer and judge freeze

```python
from backend.app.judging import score_submission
results = await score_submission(submission, challenge_ids, judge_config)
```

This exact async signature is implemented and used by Dev1's existing score/export pipeline and the live worker. It produces three validated runs per category, with null placement, empty rivals and the judge's improvements from the run nearest the mean. See [config instructions](config/README.md) for the frozen eight-category config, canonical hash, frozen response schema, exact quotes, arithmetic/majority rules, retries and bounded provider smoke commands. Config changes require a new judge version and full field rescore.

`HF_TOKEN`, pooled `DATABASE_URL` and direct migration `DATABASE_URL_DIRECT` are server-only. Environment variables override ignored root `.env.local`, loaded with python-dotenv. Commit only the empty `.env.example`. Credentials, real projects and raw responses remain under ignored private storage. Never log connection strings or provider/user payloads.

## Neon migrations and validated import

Use the Neon-provided TLS query settings, such as sslmode=require and channel_binding=require; the backend rejects non-Neon/non-TLS URLs. SQLAlchemy selects psycopg 3 without rewriting credentials or disabling TLS. Migration files are versioned, transactionally applied using the direct connection, and checksum-checked; runtime does not auto-create tables.

```sh
.venv/bin/python -m backend.tools.migrate
# Dev1 completed scoring/export; PR #38 contains the agreed handoff:
.venv/bin/python -m backend.tools.import_field \
  --artifact offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json \
  --judge-config backend/config/judge_config.json --validate-only
.venv/bin/python -m backend.tools.import_field \
  --artifact offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json \
  --judge-config backend/config/judge_config.json
```

`--validate-only` needs no database. `--no-activate` imports without changing the active field. The default activates only after the complete atomic import commits. Provisional, candidate, draft and mock configs/fields are rejected. Use the complete 106-project v6 field; show actual considered/eligible counts. No quota padding or comparison to heuristic mock scores.

Import validates the authoritative schemas, canonical config hash/versions, unique ids, seed/mutation provenance, timestamps, matching metadata/fit, exact category coverage, distinct run indices, means/arithmetic/denominators, majority eligibility/disagreement warnings, exact displayed evidence, and null/empty enrichment fields. Same-content imports are idempotent; reusing judge/pool versions with different content fails. PostgreSQL triggers prevent updates/deletes to frozen configs, fields, projects and score rows. Old versions remain available to captured jobs. The database stores aggregate category reports and normalized per-run rows; raw provider diagnostics are expiring local private files, not artifact schema additions.

## Issue #11: import the scored 106-project v6 handoff

Dev1 completed scoring/export in merged [PR #38](https://github.com/XavierS31/LennyRoasts/pull/38). The agreed artifact is `offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json`, pool `kh9-smoke-n106`, judge `kh9-qwen32b-v6`, canonical config SHA-256 `46a532c5938db8e4ffb67dfc966bfbfdfbbdb62e243f14aab2043244ef12da79`. Dev2 owns validation, Neon import/activation and live integration. Do not prepare a ten-project subset, rescore competitors or change the judge for this handoff.

Run the migration and validate/import commands above; repeat import to verify idempotence. The agreed dataset already exists in Git: do not duplicate it. New requests, sessions, reports and provider diagnostics remain under ignored `.local-tests/` or private Neon storage. `prepare_field` remains available for historical small snapshots and is not part of this completed handoff.

| Category | Considered | Eligible competitors |
| --- | --- | --- |
| Overall | 106 | 106 |
| Best AI | 106 | 95 |
| Best Game | 106 | 14 |
| Most “Useful” | 106 | 13 |
| Gemini | 51 | 47 |
| ElevenLabs | 45 | 41 |
| Databricks | 30 | 20 |
| BNY | 43 | 32 |

Eligible users rank out of eligible competitors + 1. These are Luna rewrites of real seeds scored by Qwen for simulated practice; they are not actual entrants or human judgments. See [Dev2 evidence](../docs/DEV2_STATUS.md) for verified import, API and browser checks and remaining Dev3 work under [#12](https://github.com/XavierS31/LennyRoasts/issues/12).

## Live startup and private jobs

```sh
LENNY_MODE=live .venv/bin/python -m uvicorn backend.app.main:app \
  --host 127.0.0.1 --port 8110 --workers 1 --no-access-log
```

Choose exactly one mode. Without an explicit mode, evaluation POST fails closed. Live GET `/api/challenges` reports ready only with HF configuration, working storage and a complete active frozen field; its descriptions include actual per-category considered/eligible counts and simulated-practice labels. Provider access can still fail after readiness; no success or rank is fabricated.

Live POST persists a queued job and captured judge/pool versions before putting it on the bounded worker queue. Inference starts independently of GET. One worker processes paid jobs sequentially, with three concurrent calls inside each scorer invocation. GET only reads persisted job state. Completion reuses ranking, matching cached/user run indices, aggregate-eligible competitors and exact ties; returns at most three private rival summaries and three criterion-grounded improvements without additional model calls. The field is never mutated/rescored by user submissions.

Cookie sessions are opaque and HTTP-only, SameSite=Lax, Secure over HTTPS; only SHA-256 session keys are persisted. A different or expired session gets 404. Keep frontend/API same-origin through the `/api` proxy, including in deployment. Configure trusted proxy headers explicitly so HTTPS cookie handling and client IP limits are correct. No wildcard CORS, accounts, public listing or leaderboard.

Demo limits: 128KB streamed request body, ten-second body read, one active job/session, three submissions/session/ten minutes, five admissions/client IP/ten minutes and eight outstanding jobs globally. Paid scorer requests have 45-second HTTP timeouts, two retries maximum, 360-second scoring timeout; full jobs are bounded to 420 seconds. Limits return contract-shaped 503 errors; malformed/oversized/cross-origin inputs return 422. IP admissions are process-local; session/outstanding limits are persisted. These limits are for a single-instance demo, not distributed abuse protection.

One API instance is required. A PostgreSQL transaction advisory lock holds a dedicated pooled connection for the worker lifetime (compatible with transaction pooling); maintenance keeps it alive every minute. A second instance fails closed. Lock/storage loss disables readiness. On startup, queued/running jobs from the prior instance are marked failed with INTERRUPTED, rather than automatically repeating paid inference. Completed reports persist across restart. Inference already dispatched during cancellation may still be billed.

Inputs are cleared immediately after completion/failure; inputs/results/session job rows expire after one hour, cleaned every minute while the server runs and on startup. If the server is stopped, cleanup resumes next startup. Frozen competitor fields/configs have separate immutable retention. Private raw provider diagnostics expire after one hour and are pruned during scoring/maintenance; set LENNY_JUDGE_DIAGNOSTICS=0 to disable them. These ignored local files are not report persistence.

## Checks and current evidence

```sh
.venv/bin/python -m backend.tools.check_contracts
.venv/bin/python -m pytest backend/tests offline/tests -q
.venv/bin/python backend/tools/check_ownership.py
# Explicit remote PostgreSQL check in an isolated schema, using SYNTHETIC REPLAY inference:
.venv/bin/python -m backend.tools.neon_smoke
```

The isolated Neon smoke creates/drops a temporary schema and verifies migrations/idempotence, immutable triggers, import, actual background execution, session 404, report persistence and interrupted-job failure. It never activates a synthetic field in the live/public schema, and replay inference is not live Qwen integration evidence. For a bounded paid combined check, `.venv/bin/python -m backend.tools.live_integration_smoke` uses one synthetic competitor and one user with real Qwen scores in a temporary Neon schema, then removes it. This does not replace integration against the agreed 106-project field. See [Dev2 evidence/handoff](../docs/DEV2_STATUS.md) for actual provider/database checks and remaining work.

Dev1's prompt review and v6 field scoring/export are complete ([#10](https://github.com/XavierS31/LennyRoasts/issues/10), [PR #38](https://github.com/XavierS31/LennyRoasts/pull/38)). Dev2 owns import/live integration ([#11](https://github.com/XavierS31/LennyRoasts/issues/11)); Dev3 owns the remaining UI checks ([#12](https://github.com/XavierS31/LennyRoasts/issues/12)). Merge PRs serially under the human integrator. Local live verification is recorded separately from deployment in docs/DEV2_STATUS.md.
