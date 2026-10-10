# LennyRoasts

Hackathon practice feedback against a frozen simulated competitor field. Built for Knight Hacks IX.

- [Plan and three-person 18-hour schedule](plan_draft.md)
- [Shared API/schema contract and handoff rules](contracts/README.md)
- [Agent ownership instructions](AGENTS.md)
- [Reusable local probes](experiments/README.md) and [recorded findings](experiments/RESULTS.md)

The repository currently contains the plan, contracts and experiments; the app is not implemented yet. The planned backend is FastAPI with Neon-hosted PostgreSQL. Luna prepares projects offline; Qwen3-32B scores cached competitors and live submissions using the same judge configuration. Practice placement is not a prediction of real hackathon results.

Commit source and synthetic fixtures. Keep credentials, copied project stories, generated field data and raw test responses local and out of Git.
