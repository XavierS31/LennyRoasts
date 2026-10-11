# Shared Qwen config

`judge_config.json` is complete and contract-valid for all eight categories. It is the **frozen** judge for field caching: never rewrite it in place; any model, provider, prompt, rubric, schema, setting or aggregation change needs a new judge version and a full field rescore. All reference arrays are empty because no verified reference examples exist (Knight Hacks VII examples were never collected).

Frozen version: `kh9-qwen32b-v6`, prompt version `kh9-prompts-v6`, rubric version `kh9-text-rubric-v2`. Canonical hash: `46a532c5938db8e4ffb67dfc966bfbfdfbbdb62e243f14aab2043244ef12da79`. It replaces `kh9-qwen32b-v5` (`87c962cf…80af4a`), whose full 106-project field run showed lenient gates: every Gemini, ElevenLabs and Databricks opt-in qualified and 35 projects qualified for Best Game. Changes from v5:

- Sponsor relevance (Gemini, ElevenLabs, Databricks): 2 is a minor, optional, add-on, development-only or outside-the-main-flow use even when it works; 3 requires a step in the main product flow. A product designed to work the same without the sponsor, or one that calls the sponsor feature optional, scores at most 2; an intended central role that is not yet connected still counts. BNY: a finance side panel or theme scores 2 (PR #29 and this freeze).
- Best Game: relevance asks whether the product itself is a game; utility, learning, fitness, productivity and safety apps with points, coins, quests or companions score 2 ("remove the rewards and theme; if a useful tool remains, it is not a game"). Training games count when play under rules is the main experience.
- Judge-written improvements: each run also returns one to three concrete next steps for the submission (`improvements` in the raw response schema). The run nearest the mean supplies them with the rationale and evidence; live reports show them, falling back to criterion templates only when absent.

Bounded live checks on this exact config (one run each, three validated runs per category): 13 of 14 synthetic category controls pass (`python -m offline.cli controls --judge-config backend/config/judge_config.json`); `sponsor-minor-optional` (an optional Gemini summary button) still scores relevance 3 in all runs and was accepted as a known borderline case. All four `judge_smoke` cases pass: Overall 5.8/10; non-game ineligible for Best Game, playable game eligible; injected override ignored and ElevenLabs stayed ineligible. Re-judging 25 real field projects (v5 → v6): 5–6 of 8 Best Game non-games and 5 of 6 weak-fit sponsor opt-ins now ineligible, while all 7 real games and 4 strong-fit opt-ins stay eligible. The same prompts without improvements passed all 14 controls and rejected 7 of 8 non-games, so requesting improvements costs some consistency on borderline cases. These are synthetic and sampled checks, not human-judge agreement.

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
