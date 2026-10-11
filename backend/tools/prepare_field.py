"""Freeze a small private accepted-project snapshot for the existing offline scorer."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

from backend.app.contracts import validate, validator
from backend.app.field_import import validate_project_metadata
from backend.app.judge_config import canonical_json
from offline import artifact, config


def digest(record):
    return hashlib.sha256(canonical_json(record).encode('utf-8')).hexdigest()


def private_json(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)


def prepare_snapshot(accepted_dir, field_id='kh9-integration-10', count=10):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,59}', field_id) or field_id.startswith(('mock', 'fixture')):
        raise ValueError('Use a distinct bounded live snapshot field id.')
    if not 1 <= count <= 10:
        raise ValueError('Start with at most ten projects before expanding.')
    source = Path(accepted_dir).resolve()
    if not source.is_dir():
        raise ValueError('Accepted-project directory is unavailable; private handoff is required.')
    destination = config.require_local(config.field_dir(field_id))
    manifest_path = destination / 'handoff_snapshot.json'
    if destination.exists():
        if not manifest_path.is_file():
            raise ValueError('Destination already exists without a handoff snapshot; choose a new field id.')
        manifest = config.load_json(manifest_path)
        if manifest['field_id'] != field_id or manifest['count'] != count:
            raise ValueError('Snapshot selection is immutable; choose a new field id.')
        filenames = [entry['filename'] for entry in manifest['records']]
        if len(filenames) != count or len(set(filenames)) != count:
            raise ValueError('Invalid snapshot receipt.')
    else:
        manifest = None
        filenames = [p.name for p in sorted(source.glob('*.json'))[:count]]
    if len(filenames) != count:
        raise ValueError('Fewer accepted projects than requested; no snapshot was written.')
    records = []
    for filename in filenames:
        if not re.fullmatch(r't\d+\.json', filename):
            raise ValueError('Expected accepted team files named tNNN.json.')
        record = config.load_json(source / filename)
        if record['team_id'] != Path(filename).stem:
            raise ValueError('Team id differs from its accepted filename.')
        project_schema = validator('PoolProject')
        project_schema.evolve(schema=project_schema.schema['properties']['project_id']).validate(record['project_id'])
        validate('Submission', record['submission'])
        validate_project_metadata(record['submission'], artifact.project_meta(record, f'{field_id}-n{count}'), f'{field_id}-n{count}')
        records.append(record)
    if len({r['project_id'] for r in records}) != count:
        raise ValueError('Duplicate accepted project ids.')
    receipt = dict(field_id=field_id, count=count, records=[
        dict(filename=name, sha256=digest(record)) for name, record in zip(filenames, records)
    ])
    if manifest is not None:
        if receipt != manifest or set(p.name for p in (destination/'accepted').glob('*.json')) != set(filenames):
            raise ValueError('Snapshot inputs changed; choose a new field id.')
        for filename, record in zip(filenames, records):
            if digest(config.load_json(destination/'accepted'/filename)) != digest(record):
                raise ValueError('Snapshot contents changed; scoring/export refused.')
        return receipt
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = Path(tempfile.mkdtemp(prefix='.handoff-', dir=destination.parent))
    try:
        (temporary/'accepted').mkdir(mode=0o700)
        for filename, record in zip(filenames, records):
            private_json(temporary/'accepted'/filename, record)
        private_json(temporary/'handoff_snapshot.json', receipt)
        temporary.rename(destination)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--accepted-dir', required=True)
    parser.add_argument('--field-id', default='kh9-integration-10')
    parser.add_argument('--count', type=int, default=10)
    args = parser.parse_args()
    try:
        receipt = prepare_snapshot(args.accepted_dir, args.field_id, args.count)
    except ValueError as error:
        # JSON parsing errors can quote private input; expose only our bounded messages.
        if isinstance(error, json.JSONDecodeError):
            raise SystemExit('Snapshot rejected: invalid accepted-project JSON.') from None
        raise SystemExit(str(error)) from None
    except Exception:
        raise SystemExit('Snapshot rejected: check accepted-project files, schemas and metadata privately.') from None
    print(json.dumps(dict(field_id=receipt['field_id'], projects=receipt['count'], prepared=True,
                          snapshot_sha256=digest(receipt), scoring_performed=False)))


if __name__ == '__main__':
    main()
