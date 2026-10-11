"""One frozen Qwen protocol for saved competitors and live submissions."""
import asyncio
import json
import os
import re
import secrets
import time
from statistics import mean
from typing import Any

import httpx
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

from .contracts import ROOT, validate
from .judge_config import config_hash, validate_config, provider_schema
from .scoring_contract import validate_score_result
from .settings import load_environment

ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions'
CALL_TIMEOUT = 45
JOB_TIMEOUT = 360
CONCURRENCY = 3
RETRIES = 2


class LiveScoringNotReady(RuntimeError):
    """Kept for callers written against the bootstrap."""


class JudgeFailure(LiveScoringNotReady):
    """Sanitized error, safe to expose without provider body or credentials."""


def parse_response(response, schema_name):
    try:
        if response.get('model') != 'Qwen/Qwen3-32B':
            raise ValueError('Missing/unexpected model metadata')
        choice = response['choices'][0]
        if choice['finish_reason'] != 'stop':
            raise ValueError('Incomplete output')
        # No fence stripping, thinking stripping or JSON repair.
        raw = json.loads(choice['message']['content'])
        validate(schema_name, raw)
        Draft202012Validator(provider_schema(schema_name)).validate(raw)
        keys = set(raw) - {'rationale', 'evidence', 'improvements'}
        if any(type(raw[key]) is not int for key in keys):
            raise ValueError('Criteria must be JSON integers')
        sentences = [s for s in re.split(r'[.!?]+(?:\s+|$)', raw['rationale'].strip()) if s.strip()]
        if len(sentences) > 2:
            raise ValueError('Rationale exceeds two sentences')
        return raw
    except (KeyError, IndexError, TypeError, ValueError, ValidationError):
        raise JudgeFailure('Provider returned invalid or incomplete judge JSON.') from None


def aggregate(challenge_id, raw_runs, submission):
    criteria = list(raw_runs[0]['evidence'])
    maximum = 20 if challenge_id == 'overall' else 25
    runs = []
    warnings = []
    quotes = [v for v in submission.values() if isinstance(v, str)] + submission['built_with']
    evidence = []
    for i, raw in enumerate(raw_runs):
        total = sum(raw[k] for k in criteria)
        runs.append(dict(run=i, criteria={k: raw[k] for k in criteria}, total=total,
                         max_total=maximum, score_10=10 * total / maximum,
                         eligible=challenge_id == 'overall' or raw['relevance'] >= 3))
        displayed = {}
        for key, quote in raw['evidence'].items():
            valid = quote == 'not described' or any(quote in text for text in quotes)
            displayed[key] = quote if valid else 'not described'
            if not valid:
                warnings.append(f'Run {i}: {key} evidence was not an exact quote; replaced with not described.')
        evidence.append(displayed)
    if len({r['eligible'] for r in runs}) > 1:
        warnings.append('Runs disagree on category eligibility; the two-of-three rule was applied.')
    total = mean(r['total'] for r in runs)
    selected = min(range(3), key=lambda i: (abs(runs[i]['total'] - total), i))
    result = dict(challenge_id=challenge_id, eligible=sum(r['eligible'] for r in runs) >= 2,
                  criteria={k: mean(r[k] for r in raw_runs) for k in criteria}, total=total,
                  max_total=maximum, score_10=mean(r['score_10'] for r in runs), runs=runs,
                  rationale=raw_runs[selected]['rationale'], evidence=evidence[selected],
                  warnings=warnings, placement=None, rivals=[], improvements=raw_runs[selected]['improvements'])
    validate_score_result(result, submission)
    return result


def save_diagnostic(identifier, challenge_id, run, attempt, response, config):
    # Private raw diagnostics expire after an hour. Never write input/authorization.
    if os.getenv('LENNY_JUDGE_DIAGNOSTICS', '1') != '1':
        return
    directory = ROOT / '.local-tests/judge-diagnostics' / identifier
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = directory / f'{challenge_id}-{run}-{attempt}.json'
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump({'judge_config_sha256': config_hash(config), 'response': response}, f, ensure_ascii=False)


def expire_diagnostics():
    base = ROOT / '.local-tests/judge-diagnostics'
    if not base.exists(): return
    cutoff = time.time() - 3600
    for directory in base.iterdir():
        if directory.is_symlink() or not directory.is_dir() or directory.stat().st_mtime >= cutoff: continue
        for path in directory.glob('*.json'):
            try:
                if not path.is_symlink() and path.stat().st_mtime < cutoff: path.unlink()
            except FileNotFoundError: pass
        try: directory.rmdir()
        except OSError: pass


async def _score(submission, challenge_ids, judge_config):
    load_environment()
    expire_diagnostics()
    token = os.getenv('HF_TOKEN', '').strip()
    if not token:
        raise JudgeFailure('HF_TOKEN is not configured.')
    semaphore = asyncio.Semaphore(CONCURRENCY)
    identifier = secrets.token_hex(12)
    async with httpx.AsyncClient(timeout=CALL_TIMEOUT, trust_env=False) as client:
        async def one(cid, run):
            name = 'OverallJudgeResponse' if cid == 'overall' else 'CategoryJudgeResponse'
            payload = {'model': judge_config['model'] + ':' + judge_config['provider'],
                       'temperature': judge_config['temperature'], 'max_tokens': judge_config['max_output_tokens'],
                       'stream': False, 'messages': [
                           {'role': 'system', 'content': judge_config['prompts'][cid]},
                           {'role': 'user', 'content': '<submission>\n' + json.dumps(submission, ensure_ascii=False) + '\n</submission>\n/no_think'}],
                       'response_format': {'type': 'json_schema', 'json_schema': {
                           'name': name, 'strict': True, 'schema': provider_schema(name)}}}
            for attempt in range(RETRIES + 1):
                try:
                    async with semaphore:
                        response = await client.post(ROUTER_URL, headers={'Authorization': 'Bearer ' + token}, json=payload)
                    if response.status_code >= 400:
                        if response.status_code not in {408, 429, 500, 502, 503, 504}:
                            raise JudgeFailure(f'Judge provider configuration/access failed (HTTP {response.status_code}).')
                        if attempt == RETRIES:
                            raise JudgeFailure('Judge provider is temporarily unavailable.')
                    else:
                        try:
                            body = response.json()
                            if not isinstance(body, dict): body = {}
                        except ValueError:
                            body = {}
                        save_diagnostic(identifier, cid, run, attempt, body, judge_config)
                        if body.get('model') is not None and body['model'] != judge_config['model']:
                            raise JudgeFailure('Provider returned an unexpected model; scoring was refused.')
                        try:
                            return parse_response(body, name)
                        except JudgeFailure:
                            if attempt == RETRIES:
                                raise
                except httpx.TransportError:
                    if attempt == RETRIES:
                        raise JudgeFailure('Judge provider connection timed out or failed.') from None
                await asyncio.sleep(min(2 ** attempt, 4))
            raise JudgeFailure('Judge run failed.')

        tasks = [asyncio.create_task(one(cid, run)) for cid in challenge_ids for run in range(3)]
        try:
            outputs = await asyncio.gather(*tasks)
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    return [aggregate(cid, outputs[i*3:i*3+3], submission) for i, cid in enumerate(challenge_ids)]


async def score_submission(submission: dict[str, Any], challenge_ids: list[str], judge_config: dict[str, Any]) -> list[dict[str, Any]]:
    """Exact shared interface. Three successes per category or fail the whole call."""
    validate('Submission', submission)
    try:
        validate_config(judge_config)
    except ValidationError:
        raise JudgeFailure('A complete contract-valid JudgeConfig is required.') from None
    if not challenge_ids or len(challenge_ids) != len(set(challenge_ids)) or set(challenge_ids) - set(judge_config['prompts']):
        raise JudgeFailure('Challenge ids must be unique, known and nonempty.')
    try:
        async with asyncio.timeout(JOB_TIMEOUT):
            return await _score(submission, challenge_ids, judge_config)
    except TimeoutError:
        raise JudgeFailure('The complete judge evaluation timed out.') from None
