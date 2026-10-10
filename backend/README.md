# Backend — Person 2

Run from the repository root using Python 3.13+:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
LENNY_MODE=fixture .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --reload
```

The frontend proxies `/api` to `http://127.0.0.1:8110`. The fixed API remains the three endpoints in `contracts/openapi.json`. `/docs` serves that contract.

Fixture mode returns synthetic, predetermined values. POST returns queued; the first GET returns running; later GETs return completed. This is an integration simulation, not background inference. Jobs are process-local, disappear on restart, and are visible only to the originating cookie session. Use this server only for local integration. No HF or Neon requests occur.

Without explicit `LENNY_MODE=fixture`, evaluation POST returns 503; it never substitutes fixture scores for missing live scoring. Person 2 replaces the in-memory job store with Neon persistence and implements real Qwen inference/versioned field ranking.

The frozen offline/live scoring import is:

```python
from backend.app.judging import score_submission
results = await score_submission(submission, challenge_ids, judge_config)
```

This is currently a stub that raises `LiveScoringNotReady`. Implement it here once; Person 1 imports it instead of duplicating it. Person 2 also implements cache import under `backend/`, with a documented CLI once ready. Until then Person 1 prepares/validates artifacts locally.

Checks:

```sh
.venv/bin/python -m backend.tools.check_contracts
.venv/bin/python -m pytest backend/tests -q
.venv/bin/python backend/tools/check_ownership.py
```

Neon connection settings remain server-only in ignored environment files. No database or live model connection has been implemented or verified by the bootstrap.
