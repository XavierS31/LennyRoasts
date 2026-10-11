"""Validated atomic live field import and activation."""
import argparse
import json
from pathlib import Path
from jsonschema.exceptions import ValidationError

from backend.app.database import Store, make_engine
from backend.app.field_import import field_counts, validate_artifact
from backend.app.judge_config import load_config


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--artifact',required=True)
    parser.add_argument('--judge-config',required=True)
    parser.add_argument('--validate-only',action='store_true')
    parser.add_argument('--no-activate',action='store_true')
    args=parser.parse_args();engine=None
    try:
        artifact=json.loads(Path(args.artifact).read_text());config=load_config(args.judge_config)
        validate_artifact(artifact,config)
        if args.validate_only:
            result={'validated':True,'pool_version':artifact['pool_version'],'judge_version':config['judge_version']}
        else:
            engine=make_engine();result=Store(engine).import_field(artifact,config,activate=not args.no_activate)
        print(json.dumps({**result,'projects':len(artifact['projects']),'counts':field_counts(artifact)}))
    except ValidationError as error:
        path='.'.join(map(str,error.path)) or 'artifact/config'
        raise SystemExit(f'Field import rejected: {path}: {error.validator} constraint failed.') from None
    except ValueError as error:
        raise SystemExit('Field import rejected: '+str(error)) from None
    except Exception:
        raise SystemExit('Field import rejected. Check schemas, frozen versions/hash, score arithmetic/evidence and database settings. No input or credentials are logged.') from None
    finally:
        if engine: engine.dispose()


if __name__=='__main__': main()
