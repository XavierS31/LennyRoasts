"""Initial offline entrypoint. Person 1 adds generation/score/export commands."""
import argparse
import json
from pathlib import Path

from backend.app.contracts import validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    check = subcommands.add_parser("validate", help="Validate a local artifact against the shared contract")
    check.add_argument("kind", choices=["Submission", "JudgeConfig", "PoolArtifact"])
    check.add_argument("path", type=Path)
    args = parser.parse_args()
    validate(args.kind, json.loads(args.path.read_text()))
    print(f"Valid {args.kind}. This checks schema only, not realism or scoring correctness.")


if __name__ == "__main__":
    main()
