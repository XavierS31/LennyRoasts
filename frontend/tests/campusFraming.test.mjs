import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { engineeringFrame } from "../src/components/engineering/campusFraming.ts";

test("full Engineering bounds stay beside the dashboard at desktop viewport sizes", () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-50, 0, -45), new THREE.Vector3(60, 24, 35));
  for (const [width, height] of [[901,620], [1280,720], [1440,900], [1920,1080]]) {
    const dashboardRight = 20 + Math.min(500, width * .38), headerBottom = 92;
    const view = engineeringFrame(bounds, width, height, dashboardRight, headerBottom);
    const camera = new THREE.PerspectiveCamera(48, width / height, .1, 800);
    camera.setViewOffset(width, height, view.offsetX, view.offsetY, width, height);
    camera.position.copy(view.position); camera.lookAt(view.target); camera.updateMatrixWorld(true);
    for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) {
      const point = new THREE.Vector3(x,y,z).project(camera);
      const screenX = (point.x + 1) * width / 2, screenY = (1 - point.y) * height / 2;
      assert(screenX >= dashboardRight + 28 && screenX <= width - 28, `${width}: clipped/covered horizontal bound ${screenX}`);
      assert(screenY >= headerBottom + 28 && screenY <= height - 90, `${width}: clipped vertical bound ${screenY}`);
      assert(point.z > -1 && point.z < 1, "the building must remain inside the depth range");
    }
  }
});
