"""Live cache validation; no offline dependency and no alternate scoring rules."""
from collections import Counter
from datetime import datetime
import re

from .contracts import GENERAL_IDS, validate
from .judge_config import config_hash, validate_config
from .scoring_contract import validate_score_result


def validate_project_metadata(submission, meta, pool_version):
    validate('ProjectMeta', meta)
    if meta['pool_version'] != pool_version or set(meta['fit']) != set(submission['challenges']):
        raise ValueError('Project metadata pool/fit mismatch.')
    expected_count = 2 if meta['mutation'] == 'heavy' else 1
    if len(meta['seed_ids']) != expected_count or len(meta['source_urls']) != expected_count or len(set(meta['seed_ids'])) != expected_count:
        raise ValueError('Seed provenance does not match the mutation.')
    try:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})', meta['created_at']):
            raise ValueError('Invalid timestamp shape')
        datetime.fromisoformat(meta['created_at'].replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('Invalid project timestamp.') from None


def validate_artifact(artifact, config):
    validate_config(config)
    validate('PoolArtifact', artifact)
    if any(label in config['judge_version'].lower() for label in ('provisional', 'candidate', 'draft')):
        raise ValueError('Freeze a reviewed judge version before importing the field.')
    if artifact['pool_version'].lower().startswith(('mock', 'fixture')):
        raise ValueError('Mock fields cannot be imported for live use.')
    if artifact['judge_version'] != config['judge_version'] or artifact['judge_config_sha256'] != config_hash(config):
        raise ValueError('Judge version/config hash mismatch.')
    ids = [p['project_id'] for p in artifact['projects']]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate project ids.')
    for project in artifact['projects']:
        submission, meta = project['submission'], project['meta']
        validate_project_metadata(submission, meta, artifact['pool_version'])
        expected = submission['challenges'] + list(GENERAL_IDS)
        results = project['challenge_results']
        if Counter(r['challenge_id'] for r in results) != Counter(expected):
            raise ValueError('Exact category coverage is required.')
        for result in results:
            validate_score_result(result, submission)
            if result['placement'] is not None or result['rivals']:
                raise ValueError('Imported scores must be unenriched.')
    return artifact


def field_counts(artifact):
    return {cid: {'considered': sum(r['challenge_id'] == cid for p in artifact['projects'] for r in p['challenge_results']),
                  'eligible': sum(r['challenge_id'] == cid and r['eligible'] for p in artifact['projects'] for r in p['challenge_results'])}
            for cid in ('gemini','elevenlabs','databricks','bny',*GENERAL_IDS)}
