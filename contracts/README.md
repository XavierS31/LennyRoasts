# Shared contract v1.0.0

[openapi.json](openapi.json) is the authoritative API and JSON schema contract for the 18-hour MVP. [fixtures.json](fixtures.json) contains synthetic request, queued, completed, failed and validation-error examples. It contains no real project data or measured scores.

All three developers must give these files, the plan and their ownership section to their AI agents before coding. Use the schema names and field names exactly; do not create competing DTOs, route names or challenge aliases. Backend models and frontend types must match this contract. Fixtures let frontend work start before the API is ready.

## Fixed endpoints

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/challenges` | 200 `ChallengeList`: eight definitions, frozen versions and readiness |
| POST | `/api/evaluations` | `EvaluationRequest` → 202 `EvaluationJob`; queues work without waiting for all inference |
| GET | `/api/evaluations/{evaluation_id}` | 200 `EvaluationJob`; poll until completed or failed |

POST returns 422 `APIError` for invalid input/version, or 503 when the frozen field is unavailable. GET returns 404 `APIError` for unknown evaluation ids. All errors use `code`, `message`, `details`; normalize framework validation errors to this shape. A failed queued job returns HTTP 200 with `status=failed`, `result=null` and an error. Queued/running jobs have null result and error; completed jobs have a non-null result and null error. Evaluation ids are opaque: only show a job to its requesting session; no public list endpoint.

Only sponsor opt-ins go in `submission.challenges`: `gemini`, `elevenlabs`, `databricks`, `bny`. An empty list is allowed. Always evaluate `overall`, `best_ai`, `best_game`, `most_useful` too. Each result contains exactly the requested sponsor tracks plus those four categories, once each. Excluded tracks have no API ids. Do not send hidden seed/persona/award metadata to the judge.

## Scoring semantics shared by offline and live paths

Person 2 owns one scoring module used by Person 1's offline command and the live API. Its interface is `score_submission(submission, challenge_ids, judge_config) -> list[ChallengeResult]` (async is allowed); its scoring results have `placement=null` and empty `rivals`/`improvements` until ranking enrichment. Ranking reads the frozen cache without rejudging it. Person 1 imports this module rather than copying its prompts or reimplementing its calculations.

- Raw Qwen responses use `OverallJudgeResponse` or `CategoryJudgeResponse`. These omit totals and eligibility. All raw criterion scores are integers 1–5; rationale ≤500 characters; evidence ≤120 characters per criterion.
- Best Overall omits relevance everywhere and uses max_total=20. Other categories require relevance and max_total=25. The generic API schema permits relevance to be absent for overall; the backend must enforce this category-specific rule.
- Compute run total as sum of active criteria, score_10 as 10 × total / max_total, and eligibility as relevance ≥3 (overall always true). Run indices are 0, 1, 2.
- All three runs must succeed before publishing a result. Criterion means, total and score_10 are arithmetic means across runs; keep precision internally and display scores to one decimal. Overall is eligible; other categories require at least two eligible runs. Warn on disagreement.
- Quote strings must be exact contiguous substrings of submission text or `not described`. Substitute `not described` for invalid displayed quotes and retain a warning; preserve the raw response in local diagnostics. An explanation can still be wrong even with valid quotes.
- N is the number of aggregate-eligible cached competitors in that category. If the user is eligible, compare each user run with the corresponding cached runs for those N competitors. Best tie rank is 1 + number strictly greater; worst tie rank adds the number equal. Return the minimum best and maximum worst across runs, with field_size_including_user=N+1. Ineligible users have null placement; do not give them a rank.
- A job captures judge_version and pool_version at creation. Never combine versions or present fixture fallback scores as live results. No partial-result success or silent provider fallback.

## Offline artifacts

Person 1 exports a local JSON artifact matching `PoolArtifact`, with `contract_version`, `judge_version`, `pool_version`, `judge_config_sha256`, `projects`. Each project matches `PoolProject`: `project_id`, `submission`, hidden `ProjectMeta` and `challenge_results` from the shared module. Generator personas use canonical `ai_ml`/`game_dev` skill ids and `writing_style`, not free-text aliases. Its `fit` keys must exactly match sponsor opt-ins, and metadata pool_version must match the artifact. Offline results have null placement and empty rivals/improvements. Person 2 implements import/storage and rejects mismatched versions, hashes, invalid submissions/results or missing categories/runs. General categories are not stored in submission.challenges. The saved judge settings match `JudgeConfig`; hash its UTF-8 JSON encoded with sorted keys, compact separators and unescaped Unicode (SHA-256). Runtime prompts/reference ids must be complete for all eight tracks; unavailable reference sets use empty arrays. Response schemas come from this contract. Keep artifacts under `.local-tests/` until a separate private handoff location is agreed; do not commit raw stories or the generated field database.

## Database boundary

Person 2 owns Neon-hosted PostgreSQL schema migrations, persistence and cache imports (SQLAlchemy 2 + psycopg 3). Person 1 exports artifacts and uses the shared import tool; its agent must not create a competing database schema. Person 3 only uses the API. These storage choices do not change API payloads or activate the excluded Neon sponsor track.

`DATABASE_URL` is the server runtime pooled connection, `DATABASE_URL_DIRECT` the server migration connection, and `HF_TOKEN` the server inference credential. Use Neon Console TLS settings and never send these values to the browser or log them. Schema changes are reviewed migration files owned by Person 2. A live Neon connection is still unconfigured/unverified. See [Neon connections](https://neon.com/docs/get-started/connect-neon) and [pooling](https://neon.com/docs/connect/connection-pooling).

## Ownership and change control

Person 2 owns contract changes, shared backend scoring and import/storage. Person 1 owns `offline/` and `experiments/`. Person 3 owns `frontend/`. Each developer uses a separate clone or worktree and a `codex/` branch. AI agents edit only their owned paths. A dependency change in another area becomes a handoff request to its owner, not a cross-folder edit.

Freeze v1 at kickoff. Any required change gets one coordinated contract PR and updated fixtures/types before dependent implementation merges. Only Person 2 edits shared root files, this contract and the plan after kickoff; integration PRs are merged serially. Each PR must sync with main before final verification. Never have two agents write into the same checkout.

No live leaderboard, public project sharing or full user-auth system is required for the 18-hour MVP. Keep evaluation data private to the requesting session and retention minimal; do not expose submission bodies in logs. Frontend forwards `/api/*` through a development proxy or uses one documented API base URL; it must not call Hugging Face directly or contain HF_TOKEN.
