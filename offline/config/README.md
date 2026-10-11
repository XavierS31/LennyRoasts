Person 1 owns reviewed challenge definitions, generation profiles and offline judge-prompt drafts here. Use the exact challenge IDs in `contracts/openapi.json`. Coordinate the reviewed prompt/config handoff with Person 2 before the judge freeze.

Do not place copied story inputs, generated outputs or credentials here; those stay under `.local-tests/`.

`judge_config_candidate.json` is Dev1's next prompt candidate for the shared judge. It is the frozen backend `kh9-qwen32b-v5` config with only the prompts and version labels changed (now `kh9-qwen32b-v6r2-candidate`): sponsor relevance scales score minor, optional, add-on or development-only use as 2, and Best Game scores utility apps with game-like rewards as 2. Model, provider, settings, schemas and empty reference arrays are identical (enforced by `offline/tests/test_judge_candidate.py`). It is not a frozen judge: Dev2 copies it into `backend/config/` under a final judge version, and the field is scored only with that frozen config.
