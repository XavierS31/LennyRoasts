import copy
import asyncio

import pytest
from fastapi.testclient import TestClient

from backend.app.contracts import FIXTURES, validate
from backend.app.judging import LiveScoringNotReady, score_submission
from backend.app.main import create_app


def test_submit_poll_contract_and_session_isolation():
    app = create_app(fixture_mode=True)
    with TestClient(app) as client, TestClient(app) as stranger:
        config = client.get("/api/challenges").json()
        validate("ChallengeList", config)
        assert config["field_ready"]
        request = copy.deepcopy(FIXTURES["request"])
        request["submission"]["challenges"] = ["gemini", "elevenlabs", "databricks", "bny"]
        response = client.post("/api/evaluations", json=request)
        assert response.status_code == 202
        queued = response.json()
        validate("EvaluationJob", queued)
        assert queued["status"] == "queued"
        path = "/api/evaluations/" + queued["evaluation_id"]
        assert stranger.get(path).status_code == 404
        running = client.get(path).json()
        validate("EvaluationJob", running)
        assert running["status"] == "running"
        completed = client.get(path).json()
        validate("EvaluationJob", completed)
        assert completed["status"] == "completed"
        assert len(completed["result"]["challenge_results"]) == 8
        assert {r["challenge_id"] for r in completed["result"]["challenge_results"]} == {c["id"] for c in config["challenges"]}
        game = next(r for r in completed["result"]["challenge_results"] if r["challenge_id"] == "best_game")
        assert not game["eligible"] and game["placement"] is None


@pytest.mark.parametrize("body", [{}, {**FIXTURES["request"], "contract_version": "wrong"}])
def test_invalid_contract_payload(body):
    with TestClient(create_app(fixture_mode=True)) as client:
        response = client.post("/api/evaluations", json=body)
        assert response.status_code == 422
        validate("APIError", response.json())


def test_unconfigured_live_mode_never_returns_fixture_scores():
    with TestClient(create_app()) as client:
        assert not client.get("/api/challenges").json()["field_ready"]
        response = client.post("/api/evaluations", json=FIXTURES["request"])
        assert response.status_code == 503
        validate("APIError", response.json())
    with pytest.raises(LiveScoringNotReady):
        asyncio.run(score_submission(FIXTURES["request"]["submission"], ["gemini"], {}))


def test_general_only_and_malformed_json():
    with TestClient(create_app(fixture_mode=True)) as client:
        response = client.post("/api/evaluations", content="{", headers={"content-type": "application/json"})
        assert response.status_code == 422
        validate("APIError", response.json())
        body = copy.deepcopy(FIXTURES["request"])
        body["submission"]["challenges"] = []
        job = client.post("/api/evaluations", json=body).json()
        path = "/api/evaluations/" + job["evaluation_id"]
        client.get(path)
        done = client.get(path).json()
        assert len(done["result"]["challenge_results"]) == 4
