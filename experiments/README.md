# Local Luna/Qwen checks

Standalone experiments, separate from app code. Python runs locally but sends inference requests to Hugging Face's hosted router; this is not local model inference. The selected judging route is `Qwen/Qwen3-32B:deepinfra`. See [RESULTS.md](RESULTS.md) for completed checks, failures and limits, and [the shared contract](../contracts/README.md) for the planned production interface.

Commit the reusable scripts, synthetic baseline fixtures embedded in the harness, and sanitized results summary. Keep credentials, copied Devpost stories, generated mutations, request manifests and raw responses under ignored `.env.local`/`.local-tests/`. The historical case builders require local story inputs; a fresh checkout can run the synthetic baseline immediately, but does not contain the real-story benchmark data.

## Setup and safe preview

Use Python 3.10+ with `python3 -m pip install -r experiments/requirements.txt` (a virtual environment is recommended). Put your own key in ignored `.env.local` as `HF_TOKEN=...`, or set the environment variable without putting it in shell history. Never commit tokens. Inference requires provider permission and available credits; these scripts do not change billing settings or buy credits.

```sh
python3 experiments/hf_probe.py --help
python3 experiments/hf_probe.py --dry-run --output .local-tests/preview
python3 experiments/hf_probe.py --preflight
# Explicit live inference, limited to one new attempt:
python3 experiments/hf_probe.py --max-calls 1 --output .local-tests/access-check
# Baseline judging suite, at most 18 new attempts:
python3 experiments/hf_probe.py --phase judge --max-calls 18 --output .local-tests/baseline-32b
```

The default phase is judging. It checks strong/partial/irrelevant fixtures for Databricks and Gemini, repeated scores, padded wording, injection and reversed pairwise order. Baseline briefs are synthetic proxies; it has no historical reference examples. Baseline prompts are exploratory and do not implement the final bounded evidence contract or three-run aggregation.

`--phase all` includes six historical Qwen mutation probes (24 total cases); Qwen mutation is not the selected generation architecture. `--explicit-profiles --phase mutation` tests stricter target precedence. The Luna test used a requested `gpt-6-luna` Codex subagent to generate one batch of ten synthetic mutations; this harness does not reproduce a Luna API test or require an OpenAI API key.

## Real-story bounded follow-up

The committed case builders retain the prompts used in the follow-up and accept explicit local input/output paths. They do not fetch stories, assert historical opt-ins or include copied story text.

1. Prepare `.local-tests/qwen-real-inputs.json` with `projects` (objects containing `id` and a shared-schema `submission`) and `briefs` (a map from `gemini`/`elevenlabs` to objects containing `text`). The historical builders expect project ids `cookquest` and `knightsource`. Remove author/award labels and retain provenance locally. See the source links in RESULTS.md.
2. Build the original longer-output cases, then the bounded subset:

```sh
python3 experiments/prepare_judge_check.py --input .local-tests/qwen-real-inputs.json
python3 experiments/prepare_bounded_judge_check.py --input .local-tests/qwen-v2-casebook.json
python3 experiments/hf_probe.py --case-file .local-tests/qwen-v3-casebook.json --dry-run --output .local-tests/bounded-preview
# Explicit live bounded test:
python3 experiments/hf_probe.py --case-file .local-tests/qwen-v3-casebook.json --max-calls 9 --output .local-tests/bounded-32b
```

The bounded subset has nine cases, rationale ≤500 characters, evidence ≤120 characters and max output 1,200 tokens. The recorded 13-case 32B results also used separate local repeat/injection and positive-game casebooks; these are not automatically reconstructed by these nine cases. The builders and harness preserve the historical model eligibility flag to detect contradictions; the production raw-model contract instead computes eligibility exclusively in code.

## Recording and interpreting results

Output stays under `.local-tests/`. The harness saves payloads, responses, timing and provider-reported usage, computes totals in code and distinguishes schema validation from directional checks and semantic review. Exact-quote mismatches are warnings, not silently accepted evidence.

An existing output folder resumes completed JSON responses without spending again, including content-validation failures. Changing the model, prompt or protocol requires a new output folder. Access/timeout/malformed-JSON failures stay visible; deliberate retry requires a new folder. No automatic retries or provider/model/protocol fallback.

Schema mode is the default. If a provider rejects it, diagnose before explicitly testing `--output-mode json` in a new directory. `/no_think` requests non-thinking for the tested Qwen3 route; check actual raw JSON/finish reasons rather than assuming support. No chain-of-thought is required for this evaluation.

Smoke-test success is not human-judge agreement, field realism, original invention or winner-prediction evidence. Review generated scope/fit and use exact official briefs before building the field. Provider availability and latency may change.

Sources: [HF chat completion](https://huggingface.co/docs/inference-providers/en/tasks/chat-completion), [HF structured output](https://huggingface.co/docs/inference-providers/en/guides/structured-output), [Qwen3-32B](https://huggingface.co/Qwen/Qwen3-32B).
