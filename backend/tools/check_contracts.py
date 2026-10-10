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
