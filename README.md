# LennyRoasts

Hackathon practice feedback against a frozen simulated competitor field. Built for Knight Hacks IX.

- [Start here: team handoff and conflict prevention](docs/TEAM_HANDOFF.md)
- [Dev1 agent prompt](docs/prompts/DEV1_OFFLINE.md), [Dev2 agent prompt](docs/prompts/DEV2_BACKEND.md), [Dev3 agent prompt](docs/prompts/DEV3_FRONTEND.md)
- [Plan and three-person 18-hour schedule](plan_draft.md)
- [Shared API/schema contract and handoff rules](contracts/README.md)
- [Agent ownership instructions](AGENTS.md)
- [Reusable local probes](experiments/README.md) and [recorded findings](experiments/RESULTS.md)

The repository includes the FastAPI/React API, shared Qwen judge, Neon storage/import, private background jobs and offline field pipeline. Dev1 completed the 106-project real-seed Luna field and shared-Qwen scoring/export in merged PR #38. Use `offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json`, pool `kh9-smoke-n106`, frozen judge `kh9-qwen32b-v6`, config SHA-256 `46a532c5938db8e4ffb67dfc966bfbfdfbbdb62e243f14aab2043244ef12da79`. Dev2 owns validated Neon import/activation and live integration; do not rescore competitors or change the judge. See [Dev2 evidence](docs/DEV2_STATUS.md) for verified behavior and remaining UI/deployment checks. Luna prepares competitors offline; Qwen scores cached competitors and live submissions with the same frozen config. Practice placement is not a prediction of real hackathon results.

PR #38 contains the agreed scored-field handoff; do not duplicate it. Commit source, synthetic fixtures and sanitized evidence. Keep credentials, new runtime inputs/reports and raw provider responses out of Git.

For local setup, follow [backend](backend/README.md), [frontend](frontend/README.md) and [offline](offline/README.md) instructions. Fixture results are synthetic and are never a fallback for live scoring.

The shared [mock field and saved rankings](contracts/mock/README.md) let everyone test inputs and placements immediately with `LENNY_MODE=mock`, using no inference credits.
