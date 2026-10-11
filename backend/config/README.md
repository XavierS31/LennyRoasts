# Shared Qwen config

`judge_config.json` is complete and contract-valid for all eight categories. It is **provisional**, awaiting Dev1 prompt review and bounded live validation. Do not cache the field until human owners approve the prompts and freeze a new judge version (remove the provisional suffix by creating a new config, never rewriting an imported version). All reference arrays are empty because no reviewed reference examples have been supplied.

The prompts use Dev1's collected KH IX briefs, including funny/goofy Most “Useful”, gameplay requirements for Best Game, and financial-services fit for BNY. Human handoff: Dev1 reviews all eight prompts and confirms reference availability; Dev2 freezes the accepted config before Dev1 scores the ten accepted projects.

Frozen protocol: Hugging Face router, exact `Qwen/Qwen3-32B:deepinfra` selector, schema output, 0.2 temperature, 1,200 tokens, `/no_think`, three validated independent runs. Raw response schemas are the contract's OverallJudgeResponse and CategoryJudgeResponse. The exact schemas are also embedded in each prompt so contract/schema changes change the config hash. No JSON repair or provider/model fallback.

Scores use arithmetic means over all three runs. Eligibility is relevance >=3 per run, majority >=2; Overall is always eligible and omits relevance (/20 versus /25). Rationale/evidence come from the run closest to mean total, ties by lowest index. Every run's quotes are checked against individual submission text fields and tags; invalid quotes become `not described` with warnings. No extra LLM prose aggregation.

Operational limits: three concurrent calls per scorer invocation, 45-second HTTP timeout, 360-second full evaluation timeout, at most two retries for transient HTTP/transport errors or invalid JSON. Permanent access/config errors cancel remaining work. A cancelled HTTP request may already have incurred provider cost. Live worker limits total active jobs separately.

```sh
.venv/bin/python -c 'from backend.app.judge_config import load_config, config_hash; print(config_hash(load_config()))'
.venv/bin/python -m backend.tools.judge_smoke --case overall
.venv/bin/python -m backend.tools.judge_smoke --case game-negative
.venv/bin/python -m backend.tools.judge_smoke --case game-positive
.venv/bin/python -m backend.tools.judge_smoke --case injection
```

Environment variables take precedence over ignored root `.env.local`. Server-only HF_TOKEN is loaded automatically for both offline/live. Set LENNY_JUDGE_DIAGNOSTICS=1 only for private diagnostic replay; raw responses are written with mode 0600 under ignored `.local-tests/judge-diagnostics/`. No tokens, request headers or submission inputs are logged. Responses may contain excerpts of private inputs; delete diagnostics after review.

Dev1 uses the existing command unchanged after config freeze:

```sh
.venv/bin/python -m offline.cli score --field kh9-smoke --judge-config backend/config/judge_config.json
.venv/bin/python -m offline.cli export --field kh9-smoke --judge-config backend/config/judge_config.json
```

Route/parameter references: [HF chat completion](https://huggingface.co/docs/inference-providers/tasks/chat-completion), [DeepInfra Qwen3-32B](https://deepinfra.com/Qwen/Qwen3-32B/api). Actual route support must be established by the bounded smoke, not documentation alone.
