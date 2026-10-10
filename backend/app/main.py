"""Explicit fixture API for integration; live scoring is fail-closed."""
import copy
import json
import os
import secrets
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .contracts import FIXTURES, GENERAL_IDS, SPEC, validate, validator


def create_app(*, fixture_mode: bool = False) -> FastAPI:
    app = FastAPI(title="LennyRoasts bootstrap")
    app.openapi = lambda: copy.deepcopy(SPEC)
    # Fixture-only, process-local state. Person 2 replaces this with Neon jobs.
    jobs: dict[str, dict[str, Any]] = {}

    def error(status: int, code: str, message: str, details=None):
        body = {"code": code, "message": message, "details": details or []}
        validate("APIError", body)
        return JSONResponse(body, status_code=status)

    @app.get("/api/challenges")
    async def challenges():
        body = copy.deepcopy(FIXTURES["challenges"])
        body["field_ready"] = fixture_mode
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
        if not fixture_mode:
            return error(503, "FIELD_NOT_READY", "Live judging and the frozen field are not configured.")
        owner = request.cookies.get("lenny_fixture_session") or secrets.token_urlsafe(32)
        identifier = secrets.token_urlsafe(18)
        jobs[identifier] = {"owner": owner, "polls": 0, "challenges": body["submission"]["challenges"] + list(GENERAL_IDS)}
        response_body = {**copy.deepcopy(FIXTURES["queued"]), "evaluation_id": identifier}
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
        else:
            body = copy.deepcopy(FIXTURES["completed"])
            templates = {result["challenge_id"]: result for result in body["result"]["challenge_results"]}
            results = []
            for track in job["challenges"]:
                result = copy.deepcopy(templates.get(track, templates["gemini"]))
                result["challenge_id"] = track
                results.append(result)
            body["result"]["challenge_results"] = results
        body["evaluation_id"] = evaluation_id
        validate("EvaluationJob", body)
        return body

    return app


# Only an explicit local fixture command enables invented example scores.
app = create_app(fixture_mode=os.environ.get("LENNY_MODE") == "fixture")
