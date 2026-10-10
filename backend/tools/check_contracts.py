"""Check the shared schemas, refs and synthetic integration examples."""
from backend.app.contracts import FIXTURES, SPEC, validate
from jsonschema import Draft202012Validator


def check_references(value):
    if isinstance(value, dict):
        if '$ref' in value:
            reference = value['$ref']
            assert reference.startswith('#/components/schemas/'), reference
            assert reference.split('/')[-1] in SPEC['components']['schemas'], reference
        for child in value.values():
            check_references(child)
    elif isinstance(value, list):
        for child in value:
            check_references(child)


for schema in SPEC['components']['schemas'].values():
    Draft202012Validator.check_schema(schema)
check_references(SPEC)
for key, value in FIXTURES.items():
    name = 'EvaluationRequest' if key == 'request' else 'ChallengeList' if key == 'challenges' else 'APIError' if key == 'validation_error' else 'EvaluationJob'
    validate(name, value)
print('Shared schemas, internal references and all API fixtures pass.')

# Large shared mock fixtures must conform to the same contracts too.
import json
from backend.app.contracts import ROOT
from backend.app.mock_field import load_mock_pool
load_mock_pool()
for filename, kind in [('judge_config.json', 'MockJudgeConfig'), ('rankings.json', 'MockRankings')]:
    validate(kind, json.loads((ROOT / 'contracts/mock' / filename).read_text()))
print('200-project mock field, semantic score checks, config and saved rankings pass.')
