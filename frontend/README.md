# Frontend — Person 3

React, TypeScript and Vite provide a single idea-description form, private evaluation polling and practice report. Use Node 24. The frontend sends requests only to the same-origin API and uses the generated OpenAPI types in `src/api/contract.d.ts`.

## Local development

From this folder:

```sh
npm ci
npm run contracts
npm run test
npm run check
npm run build
npm run dev
```

Open `http://127.0.0.1:5173`. The development server uses the fixed port and proxies `/api/*` to `http://127.0.0.1:8110`; it will not move to another port silently.

Run the backend from the repository root in explicit mock mode. On Linux or macOS, use the command in `backend/README.md`. On Windows PowerShell:

```powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
$env:LENNY_MODE = 'mock'
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --reload
```

The mock API is for development only. It returns input-dependent heuristic scores against synthetic competitors. The frontend labels the mode from the API's readiness and versions; it does not infer live judging from a successful build or replace an unavailable field with mock results.

## UI behavior

- Challenge names, definitions, automatic categories, readiness and versions come from `GET /api/challenges`.
- The only required input is one free-form idea description (up to 8,000 Unicode characters). Guidance asks for the problem, intended users, planned flow, possible tools and first demo; no completed build, accomplishments or technology tags are required. Sponsor opt-ins are optional and collapsed by default. Four general categories marked automatic by the API are not sent as sponsor challenges.
- `src/ideaSubmission.ts` adapts that description to the unchanged shared Submission schema: all user text stays in `what_it_does`, the first line supplies a bounded display name, and missing structured details/tags are `not described`. Explicit idea-stage markers separate planned behavior from implemented claims. It does not infer features, chosen technologies or accomplishments. The offline field and frozen scorer/config remain unchanged.
- `demo/campus-queue.txt` is authored sample idea text for copy/paste during the demo; Load sample uses this same file and selects Gemini. It describes plans, not a fabricated completed app.
- The client submits one `EvaluationRequest`, retains the returned job ID in `sessionStorage`, and resumes polling that same ID after reload. Backoff is bounded; network errors and long-running jobs offer a manual resume. Pausing checks does not cancel server work.
- Completed reports render the API's criterion means, denominator, score, eligibility, rank range, returned field counts, rationale, evidence, warnings, rival summaries and improvements. The frontend does not calculate scores or placements. Feedback is based on the write-up; software execution is unverified.
- API errors remain separate from failed jobs. A failed job has no report. The entered write-up is retained after failures.

The only network wrappers belong in `src/api/client.ts`. Do not edit the generated contract file manually. Contract changes originate with Person 2, followed by `npm run contracts`. Never put HF or database credentials in frontend code or `VITE_*` variables.

## Verification on this branch

- Desktop browser at 1440×1000 and narrow mobile browser at 390×844: the mock mode and report render; the mobile document has no horizontal overflow.
- Loaded Campus Queue, submitted with no sponsor opt-ins, and received the four API-returned general categories, including an ineligible game result with no rank.
- Selected all four sponsor opt-ins and received eight API-returned categories. The report displayed the response's actual placement ranges and counts, rival summaries, improvements and mock warnings.
- Changed substantive project content and received changed mock placement data. Submitted a 7,820-character write-up on mobile without document overflow.
- Empty form submission focused the first invalid field and exposed field-level errors.
- Switched the backend to its default no-mock mode after loading the ready mock config: the POST 503 showed an unavailable error and retained the input. Refreshing challenge readiness then showed `unconfigured` versions and disabled submission.
- Restarted the process while a job was pending: the interrupted poll exposed a resume action; resuming the same saved ID reached the API's 404 state without creating another evaluation.

The earlier multi-field checks above exercised the local mock API only. The single-description update is verified separately below. Shared Qwen scoring and Neon persistence are now merged; the reviewed frozen judge config and private real-field import still gate live readiness. The UI displays API-returned descriptions and versions; a build is not live judging or deployment evidence.

## Single-description update

This change is explicitly requested by the user for the MVP idea-testing flow and is isolated on `codex/frontend-idea-input`. The API contract, saved field scores and judge hash are unchanged. Functionality still measures described implementation under the existing rubric; the UI does not label it as predicted future completion.

Adapter tests cover full text preservation, no inferred implementation/technology claims, Unicode title bounds, blank/oversized descriptions, and optional sponsor tracks. Verified in the browser: one text input, blank/8,001-character errors focus that input, the sample queues and completes with one sponsor or none, stale-report labels survive edits, and 390px mobile width has no document overflow. Loading the sample resets the textarea scroll to the start.

A bounded real Qwen/DeepInfra control on this exact adapted sample completed all three Overall runs (functionality 2/5) with one suppressed invalid evidence quote. Raw results stay ignored under `.local-tests/idea-input/`. This checks the idea adapter against the existing provisional rubric; it is not a real-field rank, a calibrated idea-potential model, or deployment evidence. The rubric/hash was not changed.
