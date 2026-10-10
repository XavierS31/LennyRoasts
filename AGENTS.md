# LennyRoasts agent workflow

Read `plan_draft.md`, `contracts/README.md`, `contracts/openapi.json` and `contracts/fixtures.json` before implementing. This is an 18-hour MVP with three human owners supervising separate AI agents.

## Workstream ownership

- Person 1: `offline/`, `experiments/` — collection, provenance, Luna mutations, validation and scoring/export of the field using Person 2's module.
- Person 2: `backend/`, `contracts/`, shared root files — FastAPI, shared Qwen judge, calculations, Neon PostgreSQL, cache import/export and integration.
- Person 3: `frontend/` — React/TypeScript/Vite, fixture-based UI, API integration and demo flow checks.

Use a separate clone/worktree and `codex/` branch for each workstream. Edit only your assigned paths. Send cross-owner dependencies to their human owner/integrator; do not independently patch their files. Person 2 owns coordinated contract/root changes and serial integration merges. Sync main before final PR checks. The plan and contract are the source of truth; don't rename endpoints or invent alternate payloads.

## Frozen architecture

- Luna through Codex prepares and saves projects/prompts offline. No live mutation generation.
- Qwen3-32B via HF/DeepInfra scores both saved competitors and live users through one shared module.
- Freeze model/provider/prompt/rubric/schema/settings/aggregation under a judge version. Configuration changes require a version bump and full field rescore. No silent fallback or mixed cache versions.
- Compute totals, normalized scores, majority eligibility and ranks in code. Validate JSON and exact evidence quotes. Best Overall omits relevance and uses /20; other categories use /25.
- Implement exactly the API contract: GET `/api/challenges`, POST `/api/evaluations`, GET `/api/evaluations/{evaluation_id}`. Frontend must not call HF directly.
- Neon-hosted PostgreSQL is the backend database. Person 2 owns migrations; offline work exports/imports artifacts through the shared backend tools. Neon remains excluded as a sponsor track.
- Keep secrets server-side. Commit only the empty `.env.example` template; never commit actual `.env*` credentials, copied stories, generated field databases, raw requests/responses or tokens. Runtime artifacts stay under ignored `.local-tests/` until a private handoff is agreed.
- First deliver a working small validated field, then grow toward 109. Show actual field sizes and simulated practice labels. Defer fine-tuning, full historical scraping, backtesting, pairwise reranking and live leaderboard.

Validate your owned deliverable against the contract and fixtures, then report the actual checks in a small PR. Synthetic UI fixtures are not live judge results or deployment proof.
