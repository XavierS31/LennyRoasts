"""Offline helpers over the shared contract loader in backend.app.contracts.

Schemas come from contracts/openapi.json through the backend loader, so offline
output stays in lockstep with the backend and frontend.
"""
import hashlib
import json

from backend.app.contracts import SPEC, validator


def contract_version():
    return SPEC["info"]["version"]


def schema(name):
    return SPEC["components"]["schemas"][name]


def errors(name, instance):
    """Readable schema errors, empty when the instance is valid."""
    return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}"
            for e in sorted(validator(name).iter_errors(instance), key=lambda e: list(map(str, e.absolute_path)))]


def judge_config_sha256(judge_config):
    """SHA-256 of the UTF-8 JSON with sorted keys, compact separators and unescaped Unicode."""
    encoded = json.dumps(judge_config, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
