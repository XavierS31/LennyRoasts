import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { agentRoster } from "../src/components/engineering/agentRoster.ts";
import { ballroomCapacity, ballroomSeat, winnerRoute, routePosition, createAwardsAudience, CEREMONY_SECONDS } from "../src/components/engineering/awardsAgents.ts";
import { confirmedTopThree, ceremonyLeaders, ceremonyCategories } from "../src/components/engineering/ceremonyResults.ts";

test("all 200 avatars fit unique chair cushions without blocking the central aisle", () => {
  assert.equal(ballroomCapacity, 208);
  const seats = Array.from({ length: 200 }, (_, index) => ballroomSeat(index));
  assert.equal(new Set(seats.map(String)).size, 200);
  for (const [x, z] of seats) { assert.ok(Math.abs(x) >= 3.4 && Math.abs(x) < 20); assert.ok(z >= -18.4 && z < 24); }
  const route = winnerRoute(seats[141]);
  assert.deepEqual(routePosition(route, 0).position.toArray(), [...[seats[141][0], 1.42, seats[141][1]]]);
  assert.deepEqual(routePosition(route, 1).position.toArray(), [3, 1.26, -27.2]);
  assert.ok(route.some((point) => point.x === 0), "Use the clear central aisle");
  assert.ok(route.some((point) => point.x === 11 && point.y === .8), "Use the stage steps");
});

test("the selected mesh keeps its appearance, collects the prize, leaves, and skips travel with reduced motion", async () => {
  const entries = agentRoster.map((appearance, index) => ({ key: `project-${index}`, appearance, position: [0, 0] }));
  const audience = createAwardsAudience(entries, "project-141");
  const sitting = audience.winner.children[0];
  assert.equal(sitting.userData.appearance, agentRoster[141]);
  assert.equal(sitting.scale.y, .86);
  const started = audience.start(false);
  const start = audience.winner.position.clone();
  audience.animate(1, false); assert.ok(audience.winner.position.distanceTo(start) > .1);
  audience.pause(); const paused = audience.winner.position.clone();
  audience.animate(5, false); assert.deepEqual(audience.winner.position.toArray(), paused.toArray());
  const resumed = audience.resume(); await started;
  audience.animate(CEREMONY_SECONDS - 1, false);
  assert.ok(audience.award.visible); assert.deepEqual(audience.winner.position.toArray(), [3, 1.26, -27.2]);
  audience.animate(8, false); await resumed; assert.equal(audience.winner.visible, false);
  const reduced = audience.start(true); audience.animate(0, true); await reduced;
  assert.ok(audience.award.visible && audience.winner.visible);
  assert.deepEqual(audience.winner.position.toArray(), [3, 1.26, -27.2]);
  audience.dispose();
  const geometries = new Set(), materials = new Set();
  audience.group.traverse((object) => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); materials.add(object.material); } });
  [...geometries, ...materials].forEach((resource) => resource.dispose());
});

test("ceremonies retain API identities and ratings and confirm only fully top-three placement ranges", () => {
  assert.deepEqual(ceremonyCategories.map((category) => category.id), ["gemini", "elevenlabs", "overall", "databricks", "bny"]);
  const rivals = [{ project_id: "a", score_10: 9 }, { project_id: "b", score_10: 8.5 }, { project_id: "c", score_10: 8 }];
  assert.deepEqual(ceremonyLeaders({ rivals }), [rivals[2], rivals[1], rivals[0]]);
  assert.equal(rivals[0].project_id, "a"); assert.deepEqual(ceremonyLeaders(undefined), []);
  for (const [best, worst, eligible, expected] of [[1, 3, true, true], [2, 2, true, true], [1, 4, true, false], [4, 6, true, false], [1, 2, false, false], [0, 3, true, false]]) {
    assert.equal(confirmedTopThree({ eligible, placement: { best_rank: best, worst_rank: worst } }), expected);
  }
  assert.equal(confirmedTopThree(undefined), false);
});
