Person 1 owns reviewed challenge definitions, generation profiles and offline judge-prompt drafts here. Use the exact challenge IDs in `contracts/openapi.json`. Coordinate the reviewed prompt/config handoff with Person 2 before the judge freeze.

Do not place copied story inputs, generated outputs or credentials here; those stay under `.local-tests/`.

`judge_config_candidate.json` is Dev1's reviewed prompt candidate for the shared judge ([issue #10](https://github.com/XavierS31/LennyRoasts/issues/10)). It is the backend's `kh9-qwen32b-v4-provisional` config with only the eight prompts and the version labels changed; model, provider, settings, schemas and empty reference arrays are identical (enforced by `offline/tests/test_judge_candidate.py`). It is not a frozen judge: Dev2 copies it into `backend/config/` under a final judge version, and the field is scored only with that frozen config.
