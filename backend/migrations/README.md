# Neon schema and import

Run from the repository root, with server-only DATABASE_URL (pooled) and DATABASE_URL_DIRECT (direct) in the environment or ignored .env.local. Use Neon Console TLS settings. Never paste credentials into commands, logs, Git or PRs.

```sh
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m backend.tools.migrate
.venv/bin/python -m backend.tools.import_field --artifact .local-tests/handoff/pool.json --judge-config backend/config/judge_config.json --validate-only
.venv/bin/python -m backend.tools.import_field --artifact .local-tests/handoff/pool.json --judge-config backend/config/judge_config.json
```

The supplied config must be reviewed/frozen, not provisional. --validate-only runs without a database. Default imports and activates transactionally; --no-activate preserves the active version. Validation rejects schema, hash/version, category/run/arithmetic, quote, metadata/provenance and enrichment mismatches. Imports are content-idempotent; changed content under reused versions is rejected. Imports serialize with PostgreSQL transaction locks.

SQL migrations are applied once, checksum-checked and transactional through the direct connection. Add a new migration rather than editing an applied file. Migration 001 stores frozen JSONB configs/field manifests/projects and per-run scores; job/input tables retain only private session hashes. Frozen-table triggers reject updates/deletes. The runtime never creates tables. Old fields remain available to captured jobs.

Only source/configs/migrations/synthetic tests belong in Git. Real scored fields and provider diagnostics remain private. The live job API is a separate increment; see backend/README.md for worker, expiry and deployment limits when it lands.
