import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { RoomVisitSimulation, visitCategories, visitPose, visitRoute, roomDoor, ROOM_STAY_SECONDS } from "../src/components/engineering/roomVisits.ts";
import { agentRoster, agentStation } from "../src/components/engineering/agentRoster.ts";
import { createAgentField } from "../src/components/engineering/agentMeshes.ts";

function tick(simulation, seconds, reduced = false) {
  for (let n = 0; n < Math.round(seconds * 10); n++) simulation.advance(.1, reduced);
}
test("assignments use returned identities and saved category ids, with Overall-only unknowns", () => {
  const results = [{ challenge_id: "gemini", rivals: [{ project_id: "a" }] }, { challenge_id: "best_ai", rivals: [{ project_id: "a" }] }, { challenge_id: "bny", rivals: [{ project_id: "b" }] }];
  assert.deepEqual(visitCategories("a", results), ["gemini", "best_ai", "overall"]);
  assert.deepEqual(visitCategories("unknown", results), ["overall"]);
  assert.deepEqual(visitCategories("saved", results, ["bny", "bny", "neon"]), ["bny", "overall"]);
  assert.deepEqual(visitCategories("user", results), ["gemini", "best_ai", "bny", "overall"]);
});
test("visits preserve identity across snapshots, dwell ten seconds, pause and return before advancing", () => {
  const simulation = new RoomVisitSimulation([{ key: "a", name: "A", position: [2.2, -30], categories: ["gemini", "overall"] }, { key: "b", name: "B", position: [-2.2, -32], categories: ["gemini", "overall"] }]);
  simulation.playing = true; simulation.advance(0);
  let visit = simulation.visits.get("gemini");
  assert.equal(visit.key, "a");
  assert.deepEqual(visitPose(visit).position, [2.2, .6, -30]);
  while (visit.phase === "outbound") simulation.advance(.1);
  assert.equal(visit.phase, "inside");
  assert.equal(simulation.snapshot()[0].key, "a");
  simulation.playing = false; tick(simulation, 20);
  assert.equal(visit.elapsed, 0);
  simulation.playing = true; tick(simulation, ROOM_STAY_SECONDS - .1);
  assert.equal(visit.phase, "inside");
  tick(simulation, .2); assert.equal(visit.phase, "returning");
  assert.ok(Math.hypot(...visitPose(visit).position.map((n, i) => n - roomDoor("gemini")[i])) < .8);
  assert.equal(simulation.visits.get("gemini").key, "a");
  while (simulation.visits.get("gemini")?.key === "a") simulation.advance(.1);
  assert.equal(simulation.visits.get("gemini").key, "b");
  assert.equal(simulation.visits.get("overall").key, "a");
});
test("200 participants complete all assigned categories without duplicates or starvation", () => {
  const ids = ["gemini", "bny", "elevenlabs", "databricks", "overall"];
  const participants = Array.from({ length: 200 }, (_, i) => ({ key: `p${i}`, name: `P${i}`, position: agentStation(i), categories: [ids[i % 5], "best_ai", "best_game", "most_useful", "overall"].filter((id, index, list) => list.indexOf(id) === index) }));
  const simulation = new RoomVisitSimulation(participants); simulation.playing = true;
  const seen = new Set();
  for (let i = 0; i < 100000 && seen.size < participants.reduce((n, p) => n + p.categories.length, 0); i++) {
    simulation.advance(.1, true);
    const visits = simulation.snapshot();
    assert.ok(visits.length <= 5);
    assert.equal(new Set(visits.map((visit) => visit.key)).size, visits.length);
    for (const visit of visits) {
      assert.ok(participants.find((p) => p.key === visit.key).categories.includes(visit.category));
      if (visit.phase === "inside") seen.add(`${visit.key}:${visit.category}`);
    }
  }
  assert.equal(seen.size, participants.reduce((n, p) => n + p.categories.length, 0));
});
test("empty queues and degenerate routes remain finite; reduced motion skips walking", () => {
  const empty = new RoomVisitSimulation([]); empty.playing = true; tick(empty, 60); assert.deepEqual(empty.snapshot(), []);
  const simulation = new RoomVisitSimulation([{ key: "a", name: "A", position: [0, -36], categories: ["overall"] }]);
  simulation.playing = true; simulation.advance(0, true); simulation.advance(.1, true);
  const visit = simulation.visits.get("overall"); assert.equal(visit.phase, "inside");
  assert.ok(visitPose(visit, true).position.every(Number.isFinite));
  assert.ok(visitRoute([0, -36], "overall").every((point) => point.every(Number.isFinite)));
});
test("moving and hiding an instanced avatar preserves appearance and restores its exact matrices", () => {
  const field = createAgentField([{ key: "a", appearance: agentRoster[0], position: [2.2, -30] }]);
  const mesh = field.targets[0], original = new THREE.Matrix4(), moved = new THREE.Matrix4();
  mesh.getMatrixAt(0, original);
  field.move("a", [-17.5, .6, -25], Math.PI);
  mesh.getMatrixAt(0, moved); assert.notDeepEqual(moved.elements, original.elements);
  assert.deepEqual(field.positions.get("a").toArray(), [-17.5, 2, -25]);
  field.move("a", [-17.5, .6, -25], 0, false); mesh.getMatrixAt(0, moved);
  assert.equal(moved.determinant(), 0);
  field.move("a"); mesh.getMatrixAt(0, moved); assert.deepEqual(moved.elements, original.elements);
  assert.deepEqual(field.positions.get("a").toArray(), [2.2, 2, -30]);
  for (const target of field.targets) { target.geometry.dispose(); target.material.dispose(); target.dispose(); }
});
