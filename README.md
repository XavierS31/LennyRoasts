# LennyRoasts

Hackathon practice feedback against a frozen simulated competitor field. Built for Knight Hacks IX.

- [Start here: team handoff and conflict prevention](docs/TEAM_HANDOFF.md)
- [Plan and three-person 18-hour schedule](plan_draft.md)
- [Shared API/schema contract and handoff rules](contracts/README.md)
- [Agent ownership instructions](AGENTS.md)
- [Reusable local probes](experiments/README.md) and [recorded findings](experiments/RESULTS.md)

The repository includes a shared FastAPI/React bootstrap with a fixture-based submit/poll flow. Live Qwen judging, Neon storage and offline field generation remain to be implemented. Luna prepares projects offline; Qwen3-32B scores cached competitors and live submissions using the same judge configuration. Practice placement is not a prediction of real hackathon results.

Commit source and synthetic fixtures. Keep credentials, copied project stories, generated field data and raw test responses local and out of Git.

For local setup, follow [backend](backend/README.md), [frontend](frontend/README.md) and [offline](offline/README.md) instructions. Fixture results are synthetic and are never a fallback for live scoring.
