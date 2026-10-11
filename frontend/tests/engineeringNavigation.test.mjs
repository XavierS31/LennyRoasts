import assert from "node:assert/strict";
import { test } from "node:test";
import { sceneLocation, scenePath } from "../src/components/engineering/navigation.ts";
import { sponsorRooms } from "../src/components/engineering/classroomLayout.ts";

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

test("each sponsor room survives reload and returns to its originating atrium", () => {
  for (const sponsor of sponsorRooms) for (const building of ["Engineering I", "Engineering II"]) {
    const state = { kind: "classroom", building, sponsor: sponsor.id };
    assert.deepEqual(sceneLocation(new URL(scenePath(state), "https://example.com")), state);
    assert.deepEqual(sceneLocation(new URL(scenePath({ kind: "atrium", building }), "https://example.com")), { kind: "atrium", building });
  }
  assert.equal(sceneLocation(new URL("https://example.com/interior.html?room=neon")).kind, "atrium");
  assert.equal(sceneLocation(new URL("https://example.com/?room=bny")).kind, "campus");
});

test("unknown routes and query values safely open the campus", () => {
  assert.deepEqual(sceneLocation(new URL("https://example.com/?scene=unknown&building=bad")), { kind: "campus", building: "Engineering II" });
  assert.equal(scenePath({ kind: "atrium", building: "Engineering I" }), "/interior.html?building=eng1");
});
