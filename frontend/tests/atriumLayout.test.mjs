import assert from "node:assert/strict";
import { test } from "node:test";
import { ATRIUM, atriumViews, projectStation, tableRows } from "../src/components/engineering/atriumLayout.ts";

test("named API projects occupy distinct furnished bays inside the room", () => {
  const stations = Array.from({ length: 10 }, (_, index) => projectStation(index));
  assert.equal(new Set(stations.map(String)).size, stations.length);
  for (const [x, z] of stations) {
    assert.ok(Math.abs(x) < ATRIUM.halfWidth - 4);
    assert.ok(Math.abs(z) < ATRIUM.halfLength - 8);
    assert.ok(tableRows.includes(z));
    assert.ok(x === -6 || x === 6);
  }
});

test("opposite-end cameras reconstruct the photo relationship and overhead cutaway", () => {
  assert.ok(atriumViews.entrance.target[2] < -ATRIUM.halfLength + 5);
  assert.ok(atriumViews.stairs.target[2] > ATRIUM.halfLength - 10);
  assert.ok(atriumViews.ceiling.target[1] > ATRIUM.height - 3);
  assert.ok(atriumViews.top.position[1] > ATRIUM.height);
  assert.ok(atriumViews.overview.position[1] < ATRIUM.height);
});
