"""Load the authoritative contract; don't define a competing schema here."""
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads((ROOT / "contracts/openapi.json").read_text())
FIXTURES = json.loads((ROOT / "contracts/fixtures.json").read_text())
GENERAL_IDS = ("overall", "best_ai", "best_game", "most_useful")


def validator(name: str) -> Draft202012Validator:
    return Draft202012Validator({**SPEC, "$ref": f"#/components/schemas/{name}"})


def validate(name: str, value: object) -> None:
    validator(name).validate(value)
