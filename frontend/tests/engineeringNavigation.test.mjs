import assert from "node:assert/strict";
import { test } from "node:test";
import { sceneLocation, scenePath } from "../src/components/engineering/navigation.ts";

test("refresh and browser history reconstruct the Make interior and auditorium routes", () => {
  for (const kind of ["campus", "atrium", "awards"]) {
    for (const building of ["Engineering I", "Engineering II"]) {
      const state = { kind, building };
      const restored = sceneLocation(new URL(scenePath(state), "https://example.com"));
      assert.equal(restored.kind, kind);
      if (kind !== "campus") assert.equal(restored.building, building);
    }
  }
});

test("unknown routes and query values safely open the campus", () => {
  assert.deepEqual(sceneLocation(new URL("https://example.com/?scene=unknown&building=bad")), { kind: "campus", building: "Engineering II" });
  assert.equal(scenePath({ kind: "atrium", building: "Engineering I" }), "/interior.html?building=eng1");
});
