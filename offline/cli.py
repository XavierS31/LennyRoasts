"""Offline field pipeline CLI: python -m offline.cli <command> --help."""
import argparse
import json
from pathlib import Path

from backend.app.contracts import validate
from offline import collect, config, field, generate, scoring


def cmd_validate(args):
    validate(args.kind, json.loads(args.path.read_text()))
    print(f"Valid {args.kind}. This checks schema only, not realism or scoring correctness.")


def cmd_prizes(args):
    for prize in collect.prizes(args.hackathon):
        print(f"{prize['id']}\t{prize['name']}")


def cmd_optins(args):
    for project in collect.opt_ins(args.hackathon, args.prize_id):
        print(f"{'W' if project['winner_badge'] else ' '} {project['url']}\t{project['name']}\t{project['tagline']}")


def cmd_fetch_seeds(args):
    stored, problems = collect.fetch_seeds(refresh=args.refresh)
    print(f"{len(stored)} seeds stored under .local-tests/offline/seeds/")
    for problem in problems:
        print(f"SKIPPED {problem}")


def cmd_sample(args):
    state = field.sample(args.field, args.teams)
    for team in state["teams"]:
        print(f"{team['team_id']} {team['status']:9} primary={team['primary_pool']:10} "
              f"challenges={','.join(team['challenges']) or '-':28} mutation={team['mutation']:6} "
              f"seeds={','.join(team['seed_ids'] or ['-'])}")


def cmd_prepare(args):
    folder = field.prepare_batch(args.field, args.size)
    print(f"Batch written: {folder}\n  prompt: {folder / 'prompt.md'}\n  output schema: {folder / 'output_schema.json'}")
    print(f"Next: python -m offline.cli generate --field {args.field} --batch {folder.name}")


def print_outcomes(outcomes):
    for team_id, status, problems in outcomes:
        print(f"{team_id} {status}")
        for problem in problems:
            print(f"    - {problem}")


def cmd_ingest(args):
    print_outcomes(field.ingest(args.field, args.batch, args.output, args.model))


def cmd_generate(args):
    generator = config.settings()["generator"]
    answer = generate.run_batch(args.field, args.batch, generator)
    print(f"Luna answer saved: {answer}")
    print_outcomes(field.ingest(args.field, args.batch, answer, generator["model"]))


def cmd_review(args):
    print(f"Review sheet: {field.review_sheet(args.field)}")


def cmd_reject(args):
    print(f"{args.team} is now {field.reject(args.field, args.team, args.reason)}")


def cmd_report(args):
    print(json.dumps(field.report(args.field), indent=2))


def cmd_score(args):
    done, failures, remaining = scoring.score_field(args.field, args.judge_config, args.limit)
    print(f"scored {len(done)}; failed {len(failures)}; not attempted {remaining}")
    for failure in failures:
        print(f"FAILED {failure['project_id']}: {failure['problems'][:3]}")


def cmd_export(args):
    path, built = scoring.export(args.field, args.judge_config, args.pool_version)
    print(f"Exported {len(built['projects'])} projects as pool_version={built['pool_version']} "
          f"judge_version={built['judge_version']} sha256={built['judge_config_sha256']}\n  {path}")


def cmd_validate_artifact(args):
    problems = scoring.validate_file(args.artifact, args.judge_config)
    print("\n".join(problems) if problems else "Artifact is valid against the contract.")
    raise SystemExit(1 if problems else 0)


def main():
    parser = argparse.ArgumentParser(prog="python -m offline.cli", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("validate", help="Validate a local artifact against the shared contract")
    p.add_argument("kind", choices=["Submission", "JudgeConfig", "PoolArtifact"])
    p.add_argument("path", type=Path)
    p.set_defaults(func=cmd_validate)

    p = sub.add_parser("prizes", help="List a hackathon's Devpost prize filter ids")
    p.add_argument("--hackathon", required=True, help="Devpost subdomain, e.g. shellhacks2024")
    p.set_defaults(func=cmd_prizes)

    p = sub.add_parser("optins", help="List every project submitted to one prize")
    p.add_argument("--hackathon", required=True)
    p.add_argument("--prize-id", required=True, type=int)
    p.set_defaults(func=cmd_optins)

    p = sub.add_parser("fetch-seeds", help="Fetch seed write-ups listed in config/seed_manifest.json")
    p.add_argument("--refresh", action="store_true", help="Re-fetch seeds already stored locally")
    p.set_defaults(func=cmd_fetch_seeds)

    p = sub.add_parser("sample", help="Create or extend a field's team plans (challenges, persona, seeds)")
    p.add_argument("--field", required=True)
    p.add_argument("--teams", required=True, type=int)
    p.set_defaults(func=cmd_sample)

    p = sub.add_parser("prepare", help="Write the next generator batch for pending teams")
    p.add_argument("--field", required=True)
    p.add_argument("--size", type=int, default=5)
    p.set_defaults(func=cmd_prepare)

    p = sub.add_parser("generate", help="Run a prepared batch through Luna via Codex, then ingest it")
    p.add_argument("--field", required=True)
    p.add_argument("--batch", required=True)
    p.set_defaults(func=cmd_generate)

    p = sub.add_parser("ingest", help="Validate a batch answer; accept passing teams, retry the rest")
    p.add_argument("--field", required=True)
    p.add_argument("--batch", required=True)
    p.add_argument("--output", required=True, help="JSON answer matching the batch output_schema.json")
    p.add_argument("--model", required=True, help="Model that generated the answer, recorded in metadata")
    p.set_defaults(func=cmd_ingest)

    p = sub.add_parser("review", help="Write a semantic review sheet of accepted projects")
    p.add_argument("--field", required=True)
    p.set_defaults(func=cmd_review)

    p = sub.add_parser("reject", help="Reject an accepted project after review (spends a retry)")
    p.add_argument("--field", required=True)
    p.add_argument("--team", required=True)
    p.add_argument("--reason", required=True)
    p.set_defaults(func=cmd_reject)

    p = sub.add_parser("report", help="Write and print the pool report")
    p.add_argument("--field", required=True)
    p.set_defaults(func=cmd_report)

    p = sub.add_parser("score", help="Score accepted projects with backend.app.judging.score_submission")
    p.add_argument("--field", required=True)
    p.add_argument("--judge-config", required=True, help="Frozen JudgeConfig JSON from the backend owner")
    p.add_argument("--limit", type=int, help="Score at most this many new projects")
    p.set_defaults(func=cmd_score)

    p = sub.add_parser("export", help="Write the validated PoolArtifact")
    p.add_argument("--field", required=True)
    p.add_argument("--judge-config", required=True)
    p.add_argument("--pool-version", help="Defaults to <field>-n<accepted count>")
    p.set_defaults(func=cmd_export)

    p = sub.add_parser("validate-artifact", help="Check a PoolArtifact file against the contract")
    p.add_argument("--artifact", required=True)
    p.add_argument("--judge-config", required=True)
    p.set_defaults(func=cmd_validate_artifact)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
