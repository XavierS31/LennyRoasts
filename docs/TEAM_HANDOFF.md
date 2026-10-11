# Start here: three agents, one foundation

Everyone pulls current main before continuing. Dev1 completed the 106-project real-seed Luna field and shared-Qwen scoring/export in merged PR #38. Use `offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json`, pool `kh9-smoke-n106`, frozen judge `kh9-qwen32b-v6`, config SHA-256 `46a532c5938db8e4ffb67dfc966bfbfdfbbdb62e243f14aab2043244ef12da79`. Dev2 owns validated Neon import/activation and live integration; do not rescore competitors or change the judge. See [Dev2 evidence](DEV2_STATUS.md) for verified behavior and remaining UI/deployment checks. The 200-project mock field stays separate from live Qwen scoring.

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
| Shared mock field | `contracts/mock/pool.json`; saved scores and per-category `rankings.json`; `LENNY_MODE=mock` |
| Runtime inputs/exports | Ignored `.local-tests/`; no secrets or copied stories in Git |

## Copyable prompts for each agent

Each developer pastes the **entire assigned file** into their agent. These replace the earlier short common prompt plus role paragraph. They include current implementation state, owned paths, schemas/API, dependencies, commands and acceptance checks.

| Developer | Full prompt | First useful handoff |
| --- | --- | --- |
| Dev1 — offline/data | [DEV1_OFFLINE.md](prompts/DEV1_OFFLINE.md) | Completed: 106 accepted/scored v6 projects and artifact in PR #38. Further field work stays with Dev1. |
| Dev2 — backend/integrator | [DEV2_BACKEND.md](prompts/DEV2_BACKEND.md) | Validate/import/activate the complete v6 field and verify live jobs, rankings, restart persistence and session privacy. |
| Dev3 — frontend | [DEV3_FRONTEND.md](prompts/DEV3_FRONTEND.md) | Complete the full input/report/failure flow against mock mode, then use the unchanged API with the live field. |

The scorer/config/field handoff is complete. Dev2 supplies verified live startup and API evidence; Dev3 finishes browser checks under #12. Field semantic spot checks are optional under PR #9. No owner creates a second judge or patches another owner's package to bypass a dependency.

The real handoff sequence is:

1. Dev1 gives Dev2 reviewed briefs, prompt drafts and honest reference availability. Review the collected Most “Useful” brief's funny/goofy definition before freezing live scoring; mock heuristics are not authoritative rubric definitions.
2. Dev2 gives Dev1 one complete frozen `JudgeConfig`, its canonical hash and the implemented async scorer. Changes after caching require a new judge version and full rescore.
3. Completed in PR #38: Dev1 exported the validated 106-project v6 `PoolArtifact`, with matching config/hash/versions and actual category counts. This agreed Git handoff supersedes the private ten-project instructions.
4. Dev2 imports and activates the matching field/config pair in Neon and supplies the verified live startup/API to Dev3. `result.challenge_results` uses the existing contract; no new endpoint is needed.
5. Dev3 verifies the same frontend against the real field and reports actual mode/counts. Dev2 integrates small reviewed PRs serially.

Keep runtime artifacts under ignored `.local-tests/` or the team's agreed private channel. Agents do not send teammates messages or publish artifacts automatically. Human owners coordinate transfers and review their agent's output.

## Integration rules

- Person 2 is the sole integrator. Owners stay inside assigned paths; root docs/environment/CI changes go to Person 2. A branch name does not replace human ownership/review.
- Agent branch prefixes are `codex/offline-*`, `codex/backend-*`, `codex/frontend-*`. The initial `codex/shared-bootstrap` PR is the only cross-folder scaffolding exception.
- CI checks changed-file ownership, backend fixture/contract behavior, generated-type drift and frontend compilation. Person 2 may include regenerated `frontend/src/api/contract.d.ts` in a coordinated contract change; handwritten frontend changes still belong to Person 3. All owners agree the new contract before using it. Do not independently rename fields/routes.
- Commit work before syncing. On a feature branch, fetch main and merge `origin/main`, resolve only conflicts you own, then rerun checks. Never resolve a shared contract disagreement by guessing or discarding another owner's change.
- Review and merge small PRs one at a time. After every merge, run the fixture flow; after real components integrate, also run one real submit-to-report flow. Checkpoints every 2-3 hours: what merged, what works, what each owner needs next.
- Avoid broad formatting sweeps, root dependency files or shared document rewrites in feature PRs. Each package has its own dependencies/lockfile. Update only files needed for the assigned increment.

We cannot guarantee zero conflicts or zero integration bugs. These boundaries make accidental overlap detectable and keep integration early, while there is still time to fix it.

## Deadline checkpoints

Use the remaining time in the original 18-hour budget; pulling this update does not restart the clock. By hour 4, frontend and backend communicate and the shared judge scores one category. By hour 8, integrate a ten-project real-seed field. Expand only after that works. Freeze features at hour 15 and use the last three hours for blockers, deployment configuration and rehearsal. Show actual accepted counts; 109 is an expansion target.

## Mock data is ready now

All owners can use the same 200-project field and saved ranking files immediately. The API computes new-user mock placements rather than returning the old fixed one-project report. Use `backend.app.ranking.rank_results` and `backend.app.scoring_contract.validate_score_result` for reusable ranking/calculation semantics. Keep mock and live judge/pool versions separate. The UI prototype labels should refer to mock scoring against 200 synthetic projects, not fixed example scores.

## Current handoff issues

- [#10](https://github.com/XavierS31/LennyRoasts/issues/10): done; v6 is frozen. No judge change or competitor rescore is needed.
- [#11](https://github.com/XavierS31/LennyRoasts/issues/11): Dev2 imports/activates PR #38's complete 106-project v6 artifact and verifies real Qwen submit/poll, actual counts, separate-session 404 and restart persistence. See backend/README.md and DEV2_STATUS.md.
- [#12](https://github.com/XavierS31/LennyRoasts/issues/12): Dev3 owns remaining UI/failure/responsive/rehearsal checks against the imported live field.

These issues do not authorize cross-owner edits. Manual semantic review of Luna mutations is optional after PR #9; automatic acceptance and score/cache validation remain required. New runtime data stays private; do not duplicate PR #38's agreed dataset.
