# Dev2 evidence and handoff — October 10, 2026

Work runs in the clean original checkout on `codex/backend-judge`, synced with `origin/main` including Dev1 PR #9. No offline or handwritten frontend files were edited by Dev2. [PR #8](https://github.com/XavierS31/LennyRoasts/pull/8) delivers the scorer/config early; [PR #13](https://github.com/XavierS31/LennyRoasts/pull/13) adds storage/import; [PR #14](https://github.com/XavierS31/LennyRoasts/pull/14) adds live jobs and integration docs. Review/merge #8 → #13 → #14, retargeting the next PR after each base merges. The human owner merges serially.

Implemented:

- Exact shared async `backend.app.judging.score_submission(submission, challenge_ids, judge_config)` used by Dev1's existing pipeline and live jobs.
- HF router, fixed Qwen3-32B/DeepInfra selector, 0.2 temperature, schema output, `/no_think`, 1,200-token cap; no route/model/mock fallback. Returned model metadata is checked.
- Three complete validated runs/category, exact keys and integer criteria, arithmetic means, Overall /20, categories /25, majority eligibility/disagreement warnings, exact quote suppression, deterministic nearest-mean rationale/evidence selection. Private raw diagnostics expire after one hour.
- Complete provisional eight-category config with real collected briefs and empty reference arrays. Most “Useful” means funny/goofy, Game requires gameplay, and fit is separate from completion. Actual schema bytes and aggregation protocol are included in the config hash through its prompts. A narrower provider rationale grammar requires one sentence (within the contract's maximum of two) while retaining all contract keys/types.
- Versioned Neon SQL migration, immutable config/field/project/score rows, atomic/idempotent validated import and activation, persistent private jobs and TTL cleanup.
- Real background execution after POST, snapshot versions, read-only GET, worker/admission bounds, explicit restart failure, matching-run ranking and criterion-grounded feedback. Explicit mock mode remains unchanged.
- CI installs offline dependencies and runs backend/offline tests alongside existing ownership/type/build checks.

## Evidence actually obtained

Local: 64 backend/offline tests passed (43 backend, 21 offline), authoritative contract/200-project mock checks, frontend clean install/generated-type cleanliness/build, ownership guard and diff checks pass. Exact final test counts and current PR links appear in the PR descriptions.

Remote database: the supplied pooled and direct Neon URLs connected with **client-side TLS**. Migration `001_initial.sql` applied in the public schema; rerun was idempotent. Seven application tables plus schema_migrations exist. There is **no active live field**. PostgreSQL's internal pg_stat_ssl is behind Neon's proxy and did not represent client TLS; psycopg's client ssl_in_use was verified directly.

Isolated Neon replay: a temporary schema was created, tested and removed. One synthetic replay project and 15 run rows verified atomic/idempotent import, immutable triggers, private-session 404, POST-started worker without GET, completed report persistence across restart, clearing private inputs, interrupted-job failure and second-worker exclusion. The actual pooled connection's transaction worker lock separately blocked a second instance. These are PostgreSQL/live-storage checks with replay inference, **not** a real competitor-field/live-Qwen flow. No replay field was activated in public/live storage.

Provider: HF model metadata reports Qwen/Qwen3-32B with DeepInfra live. Initial v1 provisional smoke obtained three validated runs each for Overall, non-game, playable game and an injected unrelated ElevenLabs case. Game qualified; non-game/injection did not; one game quote was suppressed. v2 aligned plan anchors and completed one all-eight-category synthetic case (24 validated runs), but a separate game control exhausted retries on excess rationale sentences. v3 requested one sentence, passed a game control, but another all-eight case still exhausted retries on prose bounds. Those failures were retained privately; no partial report was published. v4 constrains the rationale in the provider schema and completed all eight categories (24 validated runs) in 48.6 seconds with three quote warnings; a playable game control qualified in 4.2 seconds and an injected unrelated ElevenLabs control stayed ineligible in 4.3 seconds. The non-game all-category control remained ineligible. These small controls do not measure human-judge agreement, predictive accuracy or deployment.

Combined isolated live integration: Qwen scored one synthetic competitor (15 validated runs), imported into a temporary Neon schema, then the actual API worker Qwen-scored a synthetic user (15 validated runs). POST queued → GET running → completed, captured versions, Overall placement out of 2, a separate-session 404 and report persistence across restart all passed. The schema was removed. Config `kh9-qwen32b-v4-isolated-smoke`, hash `166e3f4f16d2078e717618726daf0bdacba46e53b3870f5316f0ec8e42b8c142`, pool `test-replay-field-v1` (one authored synthetic control, but real Qwen scores). This is combined provider/database/API evidence, **not** the ten-project real-seed/Luna field or deployment.

Live server wiring: started the actual uvicorn app on free port 8111 because an existing process occupied 8110. Public Neon had no active field: challenges returned field_ready=false, POST returned 503, missing/private GET returned 404 and malformed JSON returned 422, all contract-valid. The temporary server was stopped; the pre-existing 8110 process was preserved.

## Required next handoffs

1. [Dev1 issue #10](https://github.com/XavierS31/LennyRoasts/issues/10): done. Dev1's reviewed prompts are frozen as `kh9-qwen32b-v5`, hash `87c962cfcaeb6da15575fb837009f88f915fea9f283d696f28d002170480af4a`; it passed all ten synthetic category controls and the four judge smoke cases (see `backend/config/README.md`). No historical reference examples are claimed.
2. [Dev1 issue #11](https://github.com/XavierS31/LennyRoasts/issues/11): score/export/validate the ten automatically accepted private projects with that exact final config and privately transfer PoolArtifact/config/report under `.local-tests/handoff/`. Under merged PR #9, semantic field spot checks are optional; automatic acceptance does not prove scope/fit realism.
3. Dev2: validate/import the delivered field, verify actual considered/eligible counts and real import → queued/running/completed Qwen report → restart/private 404. Expand only afterward.
4. [Dev3 issue #12](https://github.com/XavierS31/LennyRoasts/issues/12): integrate UI mode/count labels and rehearse against the real live field, keeping edits frontend-only. No API shape change is needed.
5. Human integrator: review/merge small PRs serially and choose deployment hosting/proxy configuration. No deployment has been performed.

## Copyable commands

```sh
.venv/bin/python -m pip install -r backend/requirements.txt -r offline/requirements.txt
.venv/bin/python -m backend.tools.check_contracts
.venv/bin/python -m pytest backend/tests offline/tests -q
.venv/bin/python -m backend.tools.judge_smoke --case all
.venv/bin/python -m backend.tools.neon_smoke
.venv/bin/python -m backend.tools.live_integration_smoke  # bounded paid calls; isolated synthetic control
.venv/bin/python -m backend.tools.migrate
# Only after Dev2 freezes the reviewed config:
.venv/bin/python -m offline.cli score --field kh9-smoke --judge-config backend/config/judge_config.json
.venv/bin/python -m offline.cli export --field kh9-smoke --judge-config backend/config/judge_config.json
.venv/bin/python -m backend.tools.import_field --artifact .local-tests/handoff/pool.json --judge-config backend/config/judge_config.json --validate-only
.venv/bin/python -m backend.tools.import_field --artifact .local-tests/handoff/pool.json --judge-config backend/config/judge_config.json
LENNY_MODE=live .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --workers 1 --no-access-log
```

See backend/README.md for startup/deployment/privacy limits. Provisional imports are rejected, so these field commands cannot accidentally activate a moving judge. Credentials are configured only in ignored `.env.local`; no values or real artifacts belong in Git/issues/PRs.
