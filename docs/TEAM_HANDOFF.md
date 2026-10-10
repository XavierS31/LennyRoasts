# Start here: three agents, one foundation

Everyone pulls the merged bootstrap before implementation. It contains working local fixture routes, generated frontend types, a submit/poll UI and an offline validation CLI. Live Qwen, Neon storage and field generation remain assigned implementation work.

## Kickoff

1. Claim exactly one role and record names in the team chat: Person 1 data, Person 2 backend/integrator, Person 3 frontend.
2. Each developer uses a separate clone/worktree and assigned branch. Start from main after the bootstrap merges; do not independently regenerate an app template over the scaffold.
3. Run the fixture flow locally once. Install Python dependencies from `backend/requirements.txt`, frontend dependencies with `npm ci`, then use the commands in the package READMEs.
4. Read `AGENTS.md`, the plan and all contract docs. Use the existing files/imports/endpoints; preserve contract v1.
5. Start independent implementation and send a first small PR within 2-3 hours.

Canonical foundation:

| Boundary | Fixed location/behavior |
| --- | --- |
| API entrypoint | `backend.app.main:app` |
| Scoring import | `backend.app.judging.score_submission`; async `(submission, challenge_ids, judge_config)` |
| Contract authority | `contracts/openapi.json`; fixtures in `contracts/fixtures.json` |
| Frontend types | `frontend/src/api/contract.d.ts`, generated; never hand-edit |
| Frontend fetch wrappers | `frontend/src/api/client.ts` |
| Offline command | `python -m offline.cli`; configuration under `offline/config/` |
| Local backend / frontend | `127.0.0.1:8110` / `127.0.0.1:5173`; `/api` proxy |
| Runtime inputs/exports | Ignored `.local-tests/`; no secrets or copied stories in Git |

## Give your agent this common instruction

```text
Read AGENTS.md, plan_draft.md, docs/TEAM_HANDOFF.md, your package README
and contracts/README.md, openapi.json and fixtures.json before editing.
Continue the existing bootstrap; do not replace it with a new template.

Implement only my assigned workstream in its owned paths, on the assigned
codex/ branch. Use the exact shared schema, endpoints, scoring import and
versioning rules. Deliver a working small increment before expansion.

Use fixtures for early integration, visibly labeled as synthetic. Never
substitute them for unavailable live judging. Keep credentials/raw runtime
data out of Git. If another owner's module is missing, report the precise
dependency and continue independent work; do not implement a duplicate.

Run the relevant checks, commit, push and open a small PR. Sync main before
final PR verification. Report actual working behavior, tests and blockers.
Do not merge: Person 2 integrates serially. Do not change the contract or
another owner's files without a coordinated handoff to that owner.
```

## Append the assigned role

**Person 1:** branch `codex/offline-field`; owns `offline/` and `experiments/`. Collect a small verified seed set, provenance and reviewed challenge configs; prepare Luna batches; validate mutations and produce ten accepted projects first. Export PoolArtifact using the shared async scoring module when Person 2 implements it. Record config hashes and versions. Do not create a second judge client or database schema. First handoff: reviewed seeds/config and accepted mutation examples. Later handoff: scored, validated field artifact and preparation commands.

**Person 2:** branch `codex/backend-judge`; owns `backend/`, `contracts/`, shared root files, `.github/` and this document. Implement the existing judging stub with Qwen3-32B, code-derived scores/eligibility, evidence checks, bounded failures and matching offline/live protocol. Replace process-local fixture jobs with Neon persistence and version-checked cache import/ranking. Preserve the contracted endpoints. First handoff: working shared scoring module plus its config requirements and a documented field-import command. Merge PRs serially after checks pass.

**Person 3:** branch `codex/frontend`; owns `frontend/`. Continue the starter form, fetch wrappers and generated types. Design the final input/report layout; implement criterion scores, evidence/warnings, rivals/improvements, honest ranges and failure states. Verify the real API when Person 2 supplies it; keep the fixture marker until actual live behavior is verified. First handoff: usable fixture flow with the intended UI. No frontend HF or database credentials.

## Integration rules

- Person 2 is the sole integrator. Owners stay inside assigned paths; root docs/environment/CI changes go to Person 2. A branch name does not replace human ownership/review.
- Agent branch prefixes are `codex/offline-*`, `codex/backend-*`, `codex/frontend-*`. The initial `codex/shared-bootstrap` PR is the only cross-folder scaffolding exception.
- CI checks changed-file ownership, backend fixture/contract behavior, generated-type drift and frontend compilation. Person 2 may include regenerated `frontend/src/api/contract.d.ts` in a coordinated contract change; handwritten frontend changes still belong to Person 3. All owners agree the new contract before using it. Do not independently rename fields/routes.
- Commit work before syncing. On a feature branch, fetch main and merge `origin/main`, resolve only conflicts you own, then rerun checks. Never resolve a shared contract disagreement by guessing or discarding another owner's change.
- Review and merge small PRs one at a time. After every merge, run the fixture flow; after real components integrate, also run one real submit-to-report flow. Checkpoints every 2-3 hours: what merged, what works, what each owner needs next.
- Avoid broad formatting sweeps, root dependency files or shared document rewrites in feature PRs. Each package has its own dependencies/lockfile. Update only files needed for the assigned increment.

We cannot guarantee zero conflicts or zero integration bugs. These boundaries make accidental overlap detectable and keep integration early, while there is still time to fix it.

## Deadline checkpoints

By hour 4, frontend and backend communicate and the shared judge scores one category. By hour 8, integrate a ten-project real-seed field. Expand only after that works. Freeze features at hour 15 and use the last three hours for blockers, deployment configuration and rehearsal. Show actual accepted counts; 109 is an expansion target.
