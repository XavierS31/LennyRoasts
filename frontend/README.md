# Frontend — Person 3

React, TypeScript and Vite provide the project form, private evaluation polling and practice report. Use Node 24. The frontend sends requests only to the same-origin API and uses the generated OpenAPI types in `src/api/contract.d.ts`.

## Local development

From this folder:

```sh
npm ci
npm run contracts
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
- The form checks required text fields and OpenAPI limits, trims and deduplicates comma-separated technology tags, and permits zero sponsor opt-ins. Four general categories marked automatic by the API are not sent as sponsor challenges.
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

These checks exercise the local mock API only. The live Qwen scorer, real frozen field, Neon persistence and a ten-project live integration are not yet available on `origin/main`; no live result or deployed-device behavior is claimed. The current API challenge descriptions are still synthetic fixture text, including Most Useful. The UI displays descriptions from the API, so the reviewed event brief must arrive through Dev2's challenge response before it can be presented as authoritative.
