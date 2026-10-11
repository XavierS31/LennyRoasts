"""Canonical, contract-valid judge configs used by offline and live callers."""
import copy
import hashlib
import json
from pathlib import Path
from .contracts import ROOT, SPEC, validate

DEFAULT_CONFIG = ROOT / 'backend/config/judge_config.json'


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def config_hash(value):
    return hashlib.sha256(canonical_json(value).encode('utf-8')).hexdigest()


def provider_schema(name):
    schema = copy.deepcopy(SPEC['components']['schemas'][name])
    # A narrower provider grammar enforces the documented prose bound without
    # changing contract keys/types. Decimal/abbreviated prose is intentionally avoided.
    schema['properties']['rationale']['pattern'] = r'^[^.!?]+[.!?]?$'
    return schema


def validate_config(config):
    validate('JudgeConfig', config)
    if config['judge_version'].lower().startswith(('mock', 'fixture')):
        raise ValueError('Mock configs cannot be used for live judging.')
    # Schema bytes are frozen in the prompt/config hash, not just in deployed code.
    for cid, prompt in config['prompts'].items():
        name = 'OverallJudgeResponse' if cid == 'overall' else 'CategoryJudgeResponse'
        schema = canonical_json(provider_schema(name))
        if not prompt.endswith('Response schema: ' + schema):
            raise ValueError('Frozen prompt response schema differs from the current contract.')
    return config


def load_config(path=DEFAULT_CONFIG):
    return validate_config(json.loads(Path(path).read_text()))
