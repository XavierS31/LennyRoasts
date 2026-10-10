"""Explicit 200-project mock API; unconfigured live scoring remains fail-closed."""
import copy
import os
import secrets
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from jsonschema.exceptions import ValidationError

from .contracts import FIXTURES, GENERAL_IDS, SPEC, validate, validator
from .mock_field import load_mock_pool
from .mock_scoring import MOCK_CONFIG, MOCK_POOL_VERSION, score_mock_submission
from .ranking import rank_results


def create_app(*, fixture_mode: bool = False, mock_mode: bool = False) -> FastAPI:
    app = FastAPI(title="LennyRoasts practice API")
    mock_enabled = mock_mode or fixture_mode
    pool = load_mock_pool() if mock_enabled else None
    app.openapi = lambda: copy.deepcopy(SPEC)
    # Mock-only, process-local state. Person 2 replaces this with Neon jobs.
    jobs: dict[str, dict[str, Any]] = {}

    def error(status: int, code: str, message: str, details=None):
        body = {"code": code, "message": message, "details": details or []}
        validate("APIError", body)
        return JSONResponse(body, status_code=status)

    @app.get("/api/challenges")
    async def challenges():
        body = copy.deepcopy(FIXTURES["challenges"])
        body["field_ready"] = mock_enabled
        body["judge_version"] = MOCK_CONFIG["judge_version"] if mock_enabled else "unconfigured"
        body["pool_version"] = MOCK_POOL_VERSION if mock_enabled else "unconfigured"
        if pool is not None:
            for challenge in body["challenges"]:
                scores = [score for project in pool["projects"] for score in project["challenge_results"] if score["challenge_id"] == challenge["id"]]
                eligible = sum(score["eligible"] for score in scores)
                challenge["description"] += f" Mock field: 200 synthetic projects; {len(scores)} considered, {eligible} eligible for this category. Scores use deterministic mock rules, not Qwen."
        validate("ChallengeList", body)
        return body

    @app.post("/api/evaluations", status_code=202)
    async def create_evaluation(request: Request):
        try:
            body = await request.json()
        except (ValueError, UnicodeDecodeError):
            return error(422, "INVALID_SUBMISSION", "Request must contain valid JSON.")
        failures = sorted(validator("EvaluationRequest").iter_errors(body), key=lambda e: str(e.path))
        if failures:
            details = [f"{'.'.join(map(str, e.path)) or 'request'}: {e.validator} constraint failed" for e in failures[:20]]
            return error(422, "INVALID_SUBMISSION", "Submission validation failed.", details)
        if not mock_enabled:
            return error(503, "FIELD_NOT_READY", "Live judging and the frozen field are not configured.")
        owner = request.cookies.get("lenny_fixture_session") or secrets.token_urlsafe(32)
        identifier = secrets.token_urlsafe(18)
        jobs[identifier] = {"owner": owner, "polls": 0, "submission": body["submission"], "challenges": body["submission"]["challenges"] + list(GENERAL_IDS), "completed": None}
        response_body = {**copy.deepcopy(FIXTURES["queued"]), "evaluation_id": identifier, "judge_version": MOCK_CONFIG["judge_version"], "pool_version": MOCK_POOL_VERSION}
        validate("EvaluationJob", response_body)
        response = JSONResponse(response_body, status_code=202)
        response.set_cookie("lenny_fixture_session", owner, httponly=True, samesite="lax", max_age=3600)
        return response

    @app.get("/api/evaluations/{evaluation_id}")
    async def get_evaluation(evaluation_id: str, request: Request):
        job = jobs.get(evaluation_id)
        if job is None or job["owner"] != request.cookies.get("lenny_fixture_session"):
            return error(404, "NOT_FOUND", "Evaluation not found.")
        job["polls"] += 1
        if job["polls"] == 1:
            body = {**copy.deepcopy(FIXTURES["queued"]), "status": "running"}
        elif job["completed"] is not None:
            return copy.deepcopy(job["completed"])
        else:
            try:
                scores = score_mock_submission(job["submission"], job["challenges"])
                ranked = rank_results(scores, pool, judge_version=MOCK_CONFIG["judge_version"])
                body = {**copy.deepcopy(FIXTURES["queued"]), "status": "completed", "result": {"challenge_results": ranked}}
            except (ValueError, ValidationError):
                body = {**copy.deepcopy(FIXTURES["failed"]), "error": {"code": "MOCK_EVALUATION_FAILED", "message": "The mock field evaluation failed validation.", "details": []}}
        body["evaluation_id"] = evaluation_id
        body["judge_version"] = MOCK_CONFIG["judge_version"]
        body["pool_version"] = MOCK_POOL_VERSION
        validate("EvaluationJob", body)
        if body["status"] in ("completed", "failed"):
            job["completed"] = copy.deepcopy(body)
            job["submission"] = None
        return body

    return app


# Explicit local mock mode only. The legacy fixture command is a compatible alias.
app = create_app(mock_mode=os.environ.get("LENNY_MODE") in {"mock", "fixture"})
