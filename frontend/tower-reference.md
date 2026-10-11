# Engineering II tower reference update

The four supplied exterior photographs establish the front-left tower corner. The previous rectangular base and west/front brick masses continued through that corner, and its windows occupied a single plane. The revised footprint stops beside the tower; the tower is narrower, projects beyond the wings, and has five exposed octagonal faces with face-aligned glazing.

- Reference 1 supplies the tall two-column window bays, broad pale floor spandrels, small lower windows, divided ground-floor glazing, continuous warm sill trim, and inverted triangular wall accents.
- Reference 2 supplies the front-facing facets and the tall, narrow proportions.
- Reference 3 supplies the shallow eight-sided hip roof and projecting silver parapet/coping.
- Reference 4 supplies the adjoining brick wing setbacks and recessed beige connector.

Dimensions are inferred from the photographs, not surveyed measurements. Beige surfaces use locally generated mottled stone color and bump maps with consistent course spacing. Exterior windows use soft sky reflection color, roughness detail, pale mullions, and projecting sills. The references are not copied into the repository or requested at runtime. Window geometry is combined into three shared material batches. The existing exterior camera controls gain a campus-only **Tower detail** view.

Validation after syncing the merged atrium update from main: production build/typecheck, all seven existing frontend tests, regenerated OpenAPI types without drift, frontend ownership check, and desktop browser inspection of front/tower/top views and building entry. An ignored local geometry check verifies the exposed corner, five tower facades, eight-sided roof, retained tower selection target, visible ground-floor glass, and three window batches. This is visual model work; it does not verify live judging or deployment.
