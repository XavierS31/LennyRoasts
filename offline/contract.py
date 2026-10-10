"""Validate offline data against the shared contract in contracts/openapi.json.

The schemas are read from the contract file rather than copied, so offline output
stays in lockstep with the backend and frontend.
"""
import hashlib
import json
from functools import cache

from jsonschema import Draft202012Validator

from offline.config import ROOT

CONTRACT_PATH = ROOT / "contracts" / "openapi.json"


@cache
def _components():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))["components"]


def contract_version():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))["info"]["version"]


@cache
def validator(name):
    """Draft 2020-12 validator for one named component schema; $refs resolve within the contract."""
    return Draft202012Validator({"$ref": f"#/components/schemas/{name}", "components": _components()})


def schema(name):
    return _components()["schemas"][name]


def errors(name, instance):
    """Readable schema errors, empty when the instance is valid."""
    return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}"
            for e in sorted(validator(name).iter_errors(instance), key=lambda e: list(map(str, e.absolute_path)))]


def judge_config_sha256(judge_config):
    """SHA-256 of the UTF-8 JSON with sorted keys, compact separators and unescaped Unicode."""
    encoded = json.dumps(judge_config, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
