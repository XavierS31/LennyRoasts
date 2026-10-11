"""Private snapshot tests use authored synthetic records and make no provider calls."""
import copy
import json
import stat

import pytest
from jsonschema.exceptions import ValidationError

from backend.app.field_import import validate_artifact
from backend.tests.live_helpers import replay_field
from backend.tools.prepare_field import prepare_snapshot
from offline import config


@pytest.fixture
def handoff(tmp_path, monkeypatch):
    monkeypatch.setattr(config, 'ROOT', tmp_path)
    monkeypatch.setattr(config, 'LOCAL_DIR', tmp_path/'.local-tests/offline')
    source = tmp_path/'private-handoff'
    source.mkdir()
    project = replay_field()[0]['projects'][0]
    record = {k:v for k,v in project['meta'].items() if k != 'pool_version'}
    record.update(team_id='t001', project_id=project['project_id'], submission=project['submission'])
    (source/'t001.json').write_text(json.dumps(record))
    return source, record


def test_snapshot_is_private_idempotent_and_does_not_grow_with_source(handoff):
    source, record = handoff
    first = prepare_snapshot(source, 'integration-test', 1)
    destination = config.field_dir('integration-test')
    assert stat.S_IMODE((destination/'accepted/t001.json').stat().st_mode) == 0o600
    assert stat.S_IMODE(destination.stat().st_mode) == 0o700
    assert config.load_json(destination/'accepted/t001.json') == record
    added = copy.deepcopy(record)
    added.update(team_id='t000', project_id='another-synthetic-project')
    (source/'t000.json').write_text(json.dumps(added))
    assert prepare_snapshot(source, 'integration-test', 1) == first
    assert [p.name for p in (destination/'accepted').glob('*.json')] == ['t001.json']


@pytest.mark.parametrize('location', ['source', 'snapshot'])
def test_changed_source_or_snapshot_is_refused(handoff, location):
    source, record = handoff
    prepare_snapshot(source, 'integration-test', 1)
    path = source/'t001.json' if location == 'source' else config.field_dir('integration-test')/'accepted/t001.json'
    record['submission']['name'] = 'Altered synthetic record'
    path.write_text(json.dumps(record))
    with pytest.raises(ValueError, match='changed'):
        prepare_snapshot(source, 'integration-test', 1)


def test_invalid_metadata_or_missing_count_writes_nothing(handoff):
    source, record = handoff
    with pytest.raises(ValueError, match='Fewer'):
        prepare_snapshot(source, 'integration-test', 2)
    record['fit'] = {}
    (source/'t001.json').write_text(json.dumps(record))
    with pytest.raises(ValueError, match='metadata'):
        prepare_snapshot(source, 'integration-test', 1)
    assert not config.field_dir('integration-test').exists()


def test_invalid_project_id_is_rejected_before_snapshot_or_scoring(handoff):
    source, record = handoff
    record['project_id'] = ''
    (source/'t001.json').write_text(json.dumps(record))
    with pytest.raises(ValidationError):
        prepare_snapshot(source, 'integration-test', 1)
    assert not config.field_dir('integration-test').exists()


@pytest.mark.parametrize('field_id,count', [('../escape',1),('mock-field',1),('valid',11),('valid',0)])
def test_snapshot_rejects_path_traversal_mock_name_and_expansion(handoff, field_id, count):
    with pytest.raises(ValueError):
        prepare_snapshot(handoff[0], field_id, count)


@pytest.mark.parametrize('label', ['provisional', 'candidate', 'draft'])
def test_unfinished_judge_configs_cannot_be_imported(label):
    artifact, judge = replay_field()
    judge['judge_version'] = f'kh9-qwen32b-v6-{label}'
    with pytest.raises(ValueError, match='Freeze'):
        validate_artifact(artifact, judge)
