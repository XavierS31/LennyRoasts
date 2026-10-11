# LennyRoasts

Hackathon practice feedback against a frozen simulated competitor field. Built for Knight Hacks IX.

- [Start here: team handoff and conflict prevention](docs/TEAM_HANDOFF.md)
- [Dev1 agent prompt](docs/prompts/DEV1_OFFLINE.md), [Dev2 agent prompt](docs/prompts/DEV2_BACKEND.md), [Dev3 agent prompt](docs/prompts/DEV3_FRONTEND.md)
- [Plan and three-person 18-hour schedule](plan_draft.md)
- [Shared API/schema contract and handoff rules](contracts/README.md)
- [Agent ownership instructions](AGENTS.md)
- [Reusable local probes](experiments/README.md) and [recorded findings](experiments/RESULTS.md)

The repository includes a shared FastAPI/React bootstrap with a mock submit/poll flow backed by 200 synthetic projects and computed rankings. The offline collection/generation/review/scoring-export pipeline is implemented; its README reports ten accepted Luna mutations held locally by Dev1. Dev2 implements shared Qwen judging, Neon storage/import and private background jobs; the config review/freeze and real ten-project field integration remain pending. See [verified Dev2 status](docs/DEV2_STATUS.md) and the [backend README](backend/README.md). Luna prepares projects offline; Qwen3-32B scores cached competitors and live submissions using the same judge configuration. Practice placement is not a prediction of real hackathon results.

Commit source and synthetic fixtures. Keep credentials, copied project stories, generated field data and raw test responses local and out of Git.

For local setup, follow [backend](backend/README.md), [frontend](frontend/README.md) and [offline](offline/README.md) instructions. Fixture results are synthetic and are never a fallback for live scoring.

The shared [mock field and saved rankings](contracts/mock/README.md) let everyone test inputs and placements immediately with `LENNY_MODE=mock`, using no inference credits.
