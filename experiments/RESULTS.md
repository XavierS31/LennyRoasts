# Luna and Qwen smoke-test results — October 10, 2026

Decision: Luna through Codex for offline preparation; Qwen3-32B through Hugging Face/DeepInfra for both cached competitors and live user scoring. This is a small prototype check, not measured agreement with human judges.

## Luna

Ten unmodified mutations from synthetic inputs were generated in one Codex batch with requested model `gpt-6-luna` and medium reasoning. All ten passed schema, exact challenge ids, no copied 12-word span, renamed title/tagline, hidden-label and terse-length checks. Manual review found two substantive issues: a light mutation changed the core concept too far, and a weak-fit case left Databricks unused instead of incidental. One inspiration field unnecessarily referenced a prior tool. Heavy mutations visibly borrowed techniques from the second seed; broken/partial states were candid.

This was not a real-seed benchmark or direct Luna API test. Luna API latency and cost were not measured. Generated inputs/outputs and reviews remain local.

## Qwen

The initial synthetic 14B probe made 28 requests including stricter mutation follow-ups. JSON/schema checks passed, but mutation semantics were inconsistent. Strong/partial ordering, unrelated-track exclusion, injection resistance and reversed pairwise winners behaved as expected on the small synthetic set. Padded wording changed a synthetic score by 0.8/10. These checks motivated testing generation separately with Luna and judging with real-story inputs.

Real stories came from [CookQuest](https://devpost.com/software/cookquest), [KnightSource](https://devpost.com/software/knightsource) and [Virtual Foosball](https://devpost.com/software/virtual-foosball). Authors and award labels were removed; test categories were assigned for evaluation, not claimed as verified historical opt-ins. Gemini/ElevenLabs briefs paraphrased the [Knight Hacks IX page](https://knight-hacks-ix.devpost.com/); general-category definitions were our text-only adaptations.

A longer-output run attempted 20 of 26 planned cases, exposing malformed/truncated JSON, a timeout, inconsistent eligibility, non-exact evidence and incorrect game classification. Six cases were not attempted after the saved timeout stopped continuation. Failures were retained.

We then limited rationale to 500 characters, quotes to 120 characters and output to 1,200 tokens, and made gameplay fit explicit. No fine-tuning or provider fallback was used.

| Bounded follow-up | Qwen3-14B | Qwen3-32B |
| --- | --- | --- |
| JSON/schema checks | 10/10 | 13/13 |
| Schema plus relevance/eligibility consistency | 9/10 | 13/13 |
| Median observed request time | 3.6 seconds | 7.0 seconds |
| Non-game recipe assistant under explicit gameplay rule | Incorrectly eligible | Ineligible |
| Positive foosball game control | Eligible | Eligible |
| Responses containing non-exact evidence excerpts | 4/10 | 5/13 |

32B scored a disconnected Gemini core lower on Functionality while retaining high intended relevance. It rejected an unrelated ElevenLabs project with and without injected perfect-score instructions; both scored 4.0/10 and stayed ineligible. A rationale still mentioned an unsupported voice detail.

For real-input wording checks, original scores were [7.2, 6.8] and padded scores [6.8, 6.4]: means 7.0 versus 6.6, a 0.4/10 shift. Repeated scores also varied by 0.4, so this sample cannot isolate all change as wording bias. The bounded synthetic original/padded pair both scored 6.8.

Best Overall correctly omitted relevance: four-criterion total 14/20 normalized to 7.0/10. Other categories used five criteria out of 25. Totals were computed in Python.

## Implementation conditions and limits

Use the same frozen model/provider/prompt/rubric/settings for offline and live scoring. Compute totals and eligibility in code; validate quotes, bound output and preserve failures. Rescore the field whenever judge configuration changes. Review Luna scope/fit before accepting mutations. Keep fine-tuning out of the MVP.

The 3-winner/3-non-winner reference setup, complete BNY/Databricks official briefs, real-seed Luna mutations, three-run aggregation, a 109-project field, embeddings, human agreement, winner backtesting, implementation and deployment were not tested. Some requests ran concurrently; latency is an observed sample, not a controlled performance guarantee. Provider cost estimates are saved locally and are not verified account charges.

This summary and reusable scripts belong in Git. Credentials, copied stories, raw responses and generated outputs do not. A fresh checkout can reproduce the synthetic harness; real-story follow-ups require locally prepared inputs described in README.md.
