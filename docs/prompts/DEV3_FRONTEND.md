# Dev3 agent prompt — complete input and practice report UI

Paste this entire file into Dev3's agent. Continue the existing React application and API client; do not scaffold a replacement.

## Assignment and starting point

Repository: [XavierS31/LennyRoasts](https://github.com/XavierS31/LennyRoasts). Work from current `main`, preserving existing workstream changes.

You are Dev3 for LennyRoasts, a Knight Hacks IX MVP built by three human developers supervising separate AI agents. Deliver a polished, usable form → asynchronous evaluation → simulated practice report flow. Build against the working mock backend now and integrate the same API with real Qwen scoring later. Work within the team's remaining 18-hour budget; do not wait for field generation to begin UI work.

Read `AGENTS.md`, `docs/TEAM_HANDOFF.md`, `plan_draft.md` sections 5–7 and 10, `contracts/README.md`, `contracts/openapi.json`, `contracts/fixtures.json`, `contracts/mock/README.md`, `frontend/README.md` and `backend/README.md` before editing. Inspect the running application and existing components/client first. If a relevant design/browser skill is available, read and apply it. Prioritize a coherent useful interface over extra features.

Use your own clone/worktree and `codex/frontend` or `codex/frontend-<task>`. Preserve existing work, fetch/merge `origin/main` before final PR checks. Edit only `frontend/`. Dev1 owns offline generation; Dev2 owns backend, contracts, root docs/environment and CI. Route a missing API behavior or required contract change to the human Dev2 integrator; do not patch those files, invent endpoints or calculate a second set of scores/ranks.

Current foundation:

- React/TypeScript/Vite, a Devpost-style form, sample loader, sponsor selection, submit/poll flow and basic result cards already exist. Continue `src/App.tsx`, `src/styles.css` and components you introduce under `frontend/`.
- All network calls belong in `src/api/client.ts`. Types come from `src/api/contract.d.ts`, generated from OpenAPI; never edit that file manually. Keep the existing dependency versions and lockfile unless a necessary scoped change is justified.
- Explicit backend mock mode scores new input using deterministic rules against 200 committed synthetic projects. `contracts/mock/rankings.json` is saved competitor ranking data. Campus Queue is only `contracts/fixtures.json.request.submission`; its placement is computed after submission, not a fixed stored ranking. Do not render the old `fixtures.completed` report as a new user's result.
- Dev1's offline pipeline is merged and reports a private ten-project Luna field. Live Qwen, Neon and its scored/imported field still depend on Dev2. Neither unit fixtures nor local mock success demonstrate that real integration exists.

## Exact API and expected data

Keep wire version `1.0.0` and use only:

| Call | Behavior |
| --- | --- |
| GET `/api/challenges` | `ChallengeList` with eight definitions, versions and `field_ready` |
| POST `/api/evaluations` | Send `{contract_version: "1.0.0", submission}`; receive 202 `EvaluationJob` |
| GET `/api/evaluations/{evaluation_id}` | Poll that job through `queued`, `running`, `completed` or `failed` |

Jobs include `evaluation_id`, contract/judge/pool versions, status, nullable result/error. Completed result is `{"challenge_results": [...]}`; render `job.result.challenge_results` using generated types. Queued/running have null result/error; completed has result and null error; failed has null result and `APIError`. HTTP 422 means invalid input/version, 503 means evaluation unavailable, and 404 means unknown/private-session-inaccessible id. Errors have `code`, `message`, `details`. Preserve cookie-based same-origin requests; evaluations are private, with no public results listing.

`Submission` has nine required text fields: `name`, `tagline`, `inspiration`, `what_it_does`, `how_we_built_it`, `challenges_we_ran_into`, `accomplishments`, `what_we_learned`, `whats_next`, plus `built_with` and `challenges`. Name ≤100 characters, tagline ≤139, other text fields ≤8,000, all nonempty per schema. `built_with` has 1–30 unique strings of 1–80 characters. Sponsor opt-ins are 0–4 unique ids: `gemini`, `elevenlabs`, `databricks`, `bny`. Automatically evaluated `overall`, `best_ai`, `best_game`, `most_useful` must not be submitted in the opt-in array. Excluded tracks must not reappear.

Each `ChallengeResult` contains `challenge_id`, `eligible`, criterion means, `total`, `max_total`, `score_10`, three `runs`, `rationale`, validated `evidence`, `warnings`, nullable `placement`, `rivals`, `improvements`. Overall has four criteria and /20, other categories five including relevance and /25. The backend owns these calculations. Placement contains `best_rank`, `worst_rank`, `eligible_competitors`, `field_size_including_user`. Rivals expose only id/name/summary/score, at most three; improvements at most three. Do not import the full competitor field into the frontend bundle.

## Work to complete, in order

1. Inspect the existing UI and run the current mock flow. Build the final layout around a clearly organized write-up form, track choices and readable reports. Keep the successful form/API scaffold and useful sample loader. Use consistent typography, spacing, responsive layout and a restrained visual style; no template rewrite or unnecessary animation.
2. Match form validation to OpenAPI. Provide labels, useful short examples, limits and field-level errors; keep entered data after failures. Parse/deduplicate technology tags before submission and explain invalid/missing fields. Explain private temporary processing/retention in brief form copy agreed with Dev2. Use challenge definitions from the API, not a second hardcoded registry. Explain that all four general categories are automatic. The actual Most “Useful” brief currently collected by Dev1 is funny/goofy; display the backend's reviewed description rather than inventing a utility criterion.
3. Implement honest readiness/mode states using existing `field_ready` and versions. Replace the current hardcoded mock banner with an explicit mock notice for `judge_version` beginning `mock-`, unavailable state if the field is not ready, and live simulated-field wording only when a real field is ready. Never infer live success from the frontend build or silently substitute fake scores. Do not hardcode 200 as a live field size; use each returned placement's actual count.
4. Handle queued/running/completed/failed jobs, disable duplicate submit while active, show accessible progress and retain the job id. The current 120-second overall polling cutoff may be too short for real three-run judging across up to eight categories. Implement bounded recoverable polling/backoff and a clear “still processing / resume checking” state agreed with Dev2. A network retry or page reload must not create another paid evaluation automatically. Browser abort stops polling, not server-side work; do not label it as server cancellation. Avoid invented progress percentages or guaranteed completion times.
5. Render the complete report for every selected sponsor and all four general categories: score to one decimal, category-specific criterion means/denominator, concise rationale, exact evidence, warnings, eligibility and placement. Use the provided rank range; if best=worst show a single rank. An ineligible category has no rank and an understandable explanation, not a fabricated last place. Show “practice placement X–Y of K eligible entries, including yours” using `field_size_including_user`; explain that the range reflects repeated scores/ties within a simulated field, not win probability or statistical confidence.
6. Show up to three supplied rival summaries and grounded improvements. Allow concise expandable details for three-run variation/evidence without overwhelming the main report. Display `not described` as missing evidence and preserve warnings. Render user/model text as plain text, never unsanitized HTML. Do not embellish quotes, invent missing rivals/feedback, average scores again or infer real winners. State that feedback is based on the write-up and software execution is unverified.
7. Handle invalid submission 422, unconfigured/unavailable field 503, unknown/expired/session-mismatched job 404, network errors and terminal provider failures distinctly. Keep input recoverable and provide an appropriate next action. A failed job does not display a partial successful ranking or trigger automatic resubmission. If storing the active job id for reload recovery, scope it to the browser session; do not store credentials or expose private projects publicly.
8. Verify keyboard navigation, focus movement to errors/results, visible focus, screen-reader labels/status, readable contrast, mobile layout and long-text overflow. Avoid using only color to distinguish eligibility/warnings. Do not add account setup, public sharing, a leaderboard or extra endpoints to finish the interface.
9. Integrate the unchanged client with Dev2's live API once it is ready. Check a real ten-project field before expansion; make actual counts and mode labels follow the responses. Report payload/description errors to Dev2 with a small reproduction rather than working around them with fabricated client data. Update `frontend/README.md` with your commands and verified demo flow.

## Commands and checks

Use Node 24. From `frontend/`:

```sh
npm ci
npm run contracts
npm run check
npm run build
npm run dev
```

The last command runs the development server. Frontend port is 5173; Vite proxies `/api` to backend port 8110. For local mock integration, run from repository root in another terminal with the backend dependencies installed:

```sh
LENNY_MODE=mock .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --reload
```

Do not kill unrelated processes or silently move ports; report a local conflict. Backend code is a read-only dependency for your role. Root environment/deployment/proxy infrastructure changes belong to Dev2. No `HF_TOKEN`, Neon URL or direct provider call belongs in frontend code or `VITE_*` variables.

Browser-check desktop and narrow mobile views: load Campus Queue, change substantive project content and see input-dependent results; submit no sponsor opt-ins and see all four general categories; submit all four opt-ins and see eight categories; verify ineligible/null placement, ties, evidence warnings, very long text, validation errors, queued/running and failure/unavailable states. Use synthetic controlled responses for hard-to-reproduce states and label them as such. Add only focused tests that protect meaningful changed behavior. Provide screenshots or browser evidence in your handoff; a successful build alone does not prove the flow.

Before your PR, save work, fetch/merge main, run the checks and `git diff --check`, and confirm generated types have no unintended drift. From root run `.venv/bin/python backend/tools/check_ownership.py` on your frontend branch. Commit/push/open a small PR within your paths; do not merge it. Dev2's human owner merges reviewed PRs serially. Request dependencies through your human owner instead of messaging teammates automatically.

## Definition of done and final handoff

First increment: the entire usable mock submit-to-report flow with criteria, ranges, evidence, rivals, improvements and failure states. Start immediately; no need to wait for Dev1 or Dev2. Final increment: the same frontend works with the real frozen field/API and visibly distinguishes mock/unavailable/live simulated practice states. The team minimum is a verified ten-project real flow, not 109 before any demo works.

Finish with the PR URL, changed files, commands/build checks, browser scenarios/screenshots, exact integration expectations and remaining blockers. Distinguish mock browser verification from real Qwen/Neon/API and deployed-device verification. Feature freeze at team hour 15; use the final three hours for blockers and rehearsal. Keep fine-tuning, backtesting, live generation, leaderboard and full auth out of scope.
