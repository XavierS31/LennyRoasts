# Offline preparation — Person 1

Use the root Python environment installed from `backend/requirements.txt`. From the repo root:

```sh
.venv/bin/python -m offline.cli --help
.venv/bin/python -m offline.cli validate PoolArtifact .local-tests/pool.json
```

The current CLI only validates a supplied local artifact against the shared schema. Person 1 implements collection, generation, semantic/copy checks, pool reporting, scoring and export here. Reviewed challenge configuration and prompt drafts belong in `offline/config/`; copied stories and generated outputs stay under ignored `.local-tests/`.

The shared import is `backend.app.judging.score_submission`; it is async and takes `(submission, challenge_ids, judge_config)`. Wait for Person 2's implemented module only for the scoring step. Collection, Luna mutation preparation and validation can proceed now. Do not implement a second Qwen client, calculation scheme or database schema.

Build a validated ten-project field first and conform to PoolArtifact, PoolProject, ProjectMeta and JudgeConfig. Person 2 supplies the database import command. Report actual accepted counts; do not claim a complete 109-project field before generation and checks succeed.
