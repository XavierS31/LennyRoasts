# kh9-smoke field data

Committed with Dev2's agreement so the field is handed off through Git instead of a private transfer. Copied unchanged from Dev1's ignored `.local-tests/offline/fields/kh9-smoke/`.

| Path | Contents |
| --- | --- |
| `accepted/` | 106 Luna (`gpt-6-luna` via Codex) mutations accepted on automatic checks, one `t###.json` per team: `submission` plus hidden metadata (seed ids and Devpost source URLs, mutation, persona, fit, generator provenance, similarity) |
| `pool_report.json` | 109 sampled teams: 106 accepted, 3 skipped after three failed attempts; per-challenge team counts and seed use |
| `scores/kh9-qwen32b-v6/` | Shared-judge results for every accepted project under the frozen `kh9-qwen32b-v6` config (SHA-256 `46a532c5938db8e4ffb67dfc966bfbfdfbbdb62e243f14aab2043244ef12da79`): three validated Qwen3-32B runs per sponsor opt-in and general category, with the rationale, evidence and judge-written improvements from the run nearest the mean |
| `kh9-smoke-n106__kh9-qwen32b-v6.json` | The validated `PoolArtifact` built from the two folders above, ready for `backend.tools.import_field` |

Eligible / considered per category under v6: Overall 106/106, Best AI 95/106, Best Game 14/106, Most “Useful” 13/106, Gemini 47/51, ElevenLabs 41/45, Databricks 20/30, BNY 32/43. All 106 projects scored with 0 failures; `offline.cli validate-artifact` and `backend.tools.import_field --validate-only` both pass.

Known limits: every project is an AI rewrite of a real student Devpost project, not an original submission, and automatic checks do not establish realism. The hidden `fit` labels are generation targets, not ground truth; several rewrites describe a planned strong or medium sponsor as an unconnected experiment, and the judge scores the text. Most “Useful” occasionally rates earnest projects (for example an accessibility tool) as having an absurd premise. Scores are Qwen judge outputs, not human-judge results. Raw provider responses are not included.

Import, validating first:

```sh
.venv/bin/python -m backend.tools.import_field \
  --artifact offline/data/kh9-smoke/kh9-smoke-n106__kh9-qwen32b-v6.json \
  --judge-config backend/config/judge_config.json --validate-only
```

To use the projects and scores with the offline CLI, copy them into the ignored field folder:

```sh
mkdir -p .local-tests/offline/fields/kh9-smoke
cp -R offline/data/kh9-smoke/accepted offline/data/kh9-smoke/scores offline/data/kh9-smoke/pool_report.json .local-tests/offline/fields/kh9-smoke/
```

`export --field kh9-smoke` then reads only `accepted/` and the scores. The sampling state `field.json` is not committed; it is needed only to extend the field.
