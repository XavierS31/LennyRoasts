"""Load and verify the saved mock field once; never mutate it with user submissions."""
import json
from functools import lru_cache

from .contracts import ROOT, validate
from .mock_scoring import MOCK_CONFIG, MOCK_POOL_VERSION, config_hash
from .scoring_contract import validate_score_result


@lru_cache(maxsize=1)
def load_mock_pool():
    pool = json.loads((ROOT / "contracts/mock/pool.json").read_text())
    validate("PoolArtifact", pool)
    if pool["judge_version"] != MOCK_CONFIG["judge_version"] or pool["pool_version"] != MOCK_POOL_VERSION:
        raise ValueError("Mock field version mismatch.")
    if pool["judge_config_sha256"] != config_hash() or len(pool["projects"]) != 200:
        raise ValueError("Mock field config or size mismatch.")
    identifiers = [project["project_id"] for project in pool["projects"]]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("Mock project ids must be unique.")
    for project in pool['projects']:
        expected = set(project['submission']['challenges']) | {'overall', 'best_ai', 'best_game', 'most_useful'}
        actual = [score['challenge_id'] for score in project['challenge_results']]
        if set(actual) != expected or len(actual) != len(expected):
            raise ValueError('Mock field has missing or duplicate category scores.')
        if project['meta']['pool_version'] != pool['pool_version']:
            raise ValueError('Mock metadata pool version mismatch.')
        for score in project['challenge_results']:
            validate_score_result(score, project['submission'])
    return pool
