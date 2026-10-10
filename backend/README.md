# Backend — Person 2

Run from the repository root using Python 3.13+:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
LENNY_MODE=mock .venv/bin/python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8110 --reload
```

The frontend proxies `/api` to `http://127.0.0.1:8110`. The fixed API remains the three endpoints in `contracts/openapi.json`. `/docs` serves that contract.

Mock mode loads the committed 200-project field in `contracts/mock/` and scores submitted content with the same deterministic mock rules as the cached competitors. `LENNY_MODE=fixture` remains an alias. All judgments are explicitly synthetic. POST returns queued; the first GET returns running; later GETs return completed. This is an integration simulation, not background inference. Completed reports are cached per job; polling never rescores the project or changes the field. Rank ranges account for matching runs and exact ties; top rivals come from the saved field. Jobs are process-local, disappear on restart, and are visible only to the originating cookie session. Use this server only for local integration. No HF or Neon requests occur.

Without explicit `LENNY_MODE=mock` or its fixture alias, evaluation POST returns 503; it never substitutes fixture scores for missing live scoring. Person 2 replaces the in-memory job store with Neon persistence and implements real Qwen inference/versioned field ranking.

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

Neon connection settings remain server-only in ignored environment files. No database or live model connection has been implemented or verified. `backend.app.ranking.rank_results` and `backend.app.scoring_contract.validate_score_result` are reusable by the future live judging/cache paths.

Generate/check the shared mock data with `.venv/bin/python -m backend.tools.generate_mock_field`. See [mock field documentation](../contracts/mock/README.md) for counts, saved rankings and limits.
