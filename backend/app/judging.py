"""Stable offline/live import boundary. Person 2 implements Qwen here."""
from typing import Any


class LiveScoringNotReady(RuntimeError):
    pass


async def score_submission(
    submission: dict[str, Any],
    challenge_ids: list[str],
    judge_config: dict[str, Any],
) -> list[dict[str, Any]]:
    """Return contract ChallengeResults before ranking enrichment.

    Exactly three validated Qwen runs per category, same config offline/live.
    No fixture or model fallback. See contracts/README.md for the semantics.
    """
    raise LiveScoringNotReady("Qwen scoring is not implemented in the bootstrap.")
