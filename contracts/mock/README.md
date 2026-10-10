# 200-project synthetic development field

These committed files are synthetic fixtures for every developer to use immediately. They contain no copied Devpost stories, real entrants, credentials, Luna outputs or Qwen judgments.

- `pool.json`: 200 unique project submissions plus hidden synthetic metadata and cached three-run mock scores. Matches `PoolArtifact` / `PoolProject`.
- `judge_config.json`: fixed `MockJudgeConfig`, explicitly different from the live Qwen `JudgeConfig`.
- `rankings.json`: all considered projects' computed per-category placements. Matches `MockRankings`; ineligible entries have null placement.

Generate exactly the same artifacts from the repository root:

```sh
.venv/bin/python -m backend.tools.generate_mock_field
```

The generator uses templates and fixed seed 109200, with no inference calls. Every project is considered in the four general categories; sponsor opt-ins vary. Mock scores use described completion/connections/category keywords plus stable synthetic originality/run variation. They are for integration testing, not a measure of quality or winner prediction.

| Category | Considered | Eligible |
| --- | --- | --- |
| Gemini | 65 | 51 |
| ElevenLabs | 69 | 51 |
| Databricks | 71 | 58 |
| BNY | 62 | 51 |
| Overall | 200 | 200 |
| AI | 200 | 112 |
| Game | 200 | 40 |
| Useful | 200 | 180 |

Start the API with `LENNY_MODE=mock` (the old `fixture` value is a compatible alias). Existing submit/poll endpoints score a new project with the same mock rules and compare it with these cached scores. The new user is not added to the field. Overall placement is out of 201; category placements use eligible competitors + user. Ineligible users have no placement. Cached competitors' own placements exclude themselves, so Overall is out of 200 in rankings.json.

Rank ranges include exact-score ties and the spread across corresponding runs. Code computes normalized scores (/20 Overall, /25 elsewhere), eligibility, rankings and rival summaries. No model-generated ranking is trusted.

PoolArtifact's capacity has been relaxed from 109 to 200 for this requested mock field; the API wire format and contract_version 1.0.0 remain unchanged. The historical 109-project calibration is still the initial live-field target, not the mock fixture size.

Live imports must reject these mock versions/configs; do not compare Qwen user scores against this heuristic field. Real Luna mutations and cached Qwen judgments will be a separate field/version. Generated real stories/responses remain local; these explicitly synthetic fixtures are the Git exception.
