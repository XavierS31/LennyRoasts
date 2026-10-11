# Shared Qwen config

`judge_config.json` is complete and contract-valid for all eight categories. It is the **frozen** judge for field caching: never rewrite it in place; any model, provider, prompt, rubric, schema, setting or aggregation change needs a new judge version and a full field rescore. All reference arrays are empty because no verified reference examples exist (Knight Hacks VII examples were never collected).

Frozen version: `kh9-qwen32b-v5`, prompt version `kh9-prompts-v5`, rubric version `kh9-text-rubric-v2`. Canonical hash: `87c962cfcaeb6da15575fb837009f88f915fea9f283d696f28d002170480af4a`. It is the provisional v4 config (`658d9aed…8d074`) with only the eight prompts and version labels changed, adopting Dev1's reviewed candidate `offline/config/judge_config_candidate.json` ([issue #10](https://github.com/XavierS31/LennyRoasts/issues/10), PR #19). Main changes: Best Game requires a goal or challenge with rules or a win/loss condition (exploring alone is 2); ElevenLabs/Databricks score a described central role despite incompleteness and a bare tag as 1; per-category clarifications for Gemini, BNY, Best AI, Most “Useful” and Overall; missing evidence is named in the rationale and candour supports technical understanding.

Bounded live checks on this exact config (one run each, three validated runs per category): all ten synthetic category controls passed (`python -m offline.cli controls --judge-config backend/config/judge_config.json`; v4 passed eight, admitting a VR walkthrough to Best Game), and the four `judge_smoke` cases passed — Overall 5.0/10; non-game ineligible for Best Game, playable game eligible; injected override ignored and ElevenLabs stayed ineligible at 4.3/10 with one suppressed quote. These are synthetic smoke checks, not human-judge agreement or field results.

The prompts use Dev1's collected KH IX briefs, including funny/goofy Most “Useful”, gameplay requirements for Best Game, and financial-services fit for BNY.

Frozen protocol: Hugging Face router, exact `Qwen/Qwen3-32B:deepinfra` selector, schema output, 0.2 temperature, 1,200 tokens, `/no_think`, three validated independent runs. Raw response keys/types are the contract's OverallJudgeResponse and CategoryJudgeResponse. The provider grammar narrows rationale to one sentence via a punctuation pattern; server validation enforces that grammar and the authoritative schema. This is within the contract's two-sentence maximum and avoids abbreviated/decimal prose. The exact schemas are also embedded in each prompt so contract/schema changes change the config hash. No JSON repair or provider/model fallback.

Scores use arithmetic means over all three runs. Eligibility is relevance >=3 per run, majority >=2; Overall is always eligible and omits relevance (/20 versus /25). Rationale/evidence come from the run closest to mean total, ties by lowest index. Every run's quotes are checked against individual submission text fields and tags; invalid quotes become `not described` with warnings. No extra LLM prose aggregation.

Operational limits: three concurrent calls per scorer invocation, 45-second HTTP timeout, 360-second full evaluation timeout, at most two retries for transient HTTP/transport errors or invalid JSON. Permanent access/config errors cancel remaining work. A cancelled HTTP request may already have incurred provider cost. Live worker limits total active jobs separately.

```sh
.venv/bin/python -c 'from backend.app.judge_config import load_config, config_hash; print(config_hash(load_config()))'
.venv/bin/python -m backend.tools.judge_smoke --case overall
.venv/bin/python -m backend.tools.judge_smoke --case game-negative
.venv/bin/python -m backend.tools.judge_smoke --case game-positive
.venv/bin/python -m backend.tools.judge_smoke --case injection
```

Environment variables take precedence over ignored root `.env.local`. Server-only HF_TOKEN is loaded automatically for both offline/live. Raw provider diagnostics are retained privately by default for one hour; set LENNY_JUDGE_DIAGNOSTICS=0 to disable them. The scorer prunes old files on each invocation and live maintenance prunes every minute; raw responses are written with mode 0600 under ignored `.local-tests/judge-diagnostics/`. No tokens, request headers or submission inputs are logged. Responses may contain excerpts of private inputs. Cleanup resumes on the next invocation/startup if the server is stopped; delete them manually after review if needed.

Dev1 uses the existing command unchanged after config freeze:

```sh
.venv/bin/python -m offline.cli score --field kh9-smoke --judge-config backend/config/judge_config.json
.venv/bin/python -m offline.cli export --field kh9-smoke --judge-config backend/config/judge_config.json
```

Route/parameter references: [HF chat completion](https://huggingface.co/docs/inference-providers/tasks/chat-completion), [DeepInfra Qwen3-32B](https://deepinfra.com/Qwen/Qwen3-32B/api). Actual route support must be established by the bounded smoke, not documentation alone.
