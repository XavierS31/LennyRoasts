import assert from "node:assert/strict";
import { mock, test } from "node:test";
import * as THREE from "three";
import { addLennyCharacters } from "../src/components/engineering/lennyCharacters.ts";
import { lennyPresenter, lennySponsors, sponsorLennyHeight } from "../src/components/engineering/lennyLayout.ts";

function fixture(kind, sponsor) {
  const pending = [];
  const load = mock.method(THREE.TextureLoader.prototype, "load", (url, ready) => {
    const texture = new THREE.Texture();
    pending.push({ url, texture, ready }); return texture;
  });
  const scene = new THREE.Scene();
  const controller = addLennyCharacters(scene, kind, sponsor);
  load.mock.restore();
  return { scene, controller, pending, hosts: scene.children[0].children };
}

test("a classroom has one correctly branded Lenny at student scale, without a trophy", () => {
  for (const sponsor of lennySponsors) {
    const { scene, hosts, pending } = fixture("classroom", sponsor.id);
    assert.equal(hosts.length, 1);
    assertSolid(hosts[0], .03, 2.35);
    assert.deepEqual(pending.map(({ url }) => url), [`/assets/lenny/logos/${sponsor.id}.png`]);
    assert.ok(hosts[0].getObjectByName(`${sponsor.id} shirt print`));
    assert.equal(hosts[0].getObjectByName("Gold award trophy"), undefined);
    release(scene);
  }
});

function release(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry); materials.add(object.material);
    if (object.material.map) textures.add(object.material.map);
  });
  for (const resource of [...textures, ...materials, ...geometries]) resource.dispose();
}

test("overall judging uses regular solid Lenny without sponsor logos or a trophy", () => {
  const { scene, hosts, pending } = fixture("classroom", "regular");
  assert.equal(hosts.length, 1); assert.equal(pending.length, 0);
  assertSolid(hosts[0], .03, 2.35);
  assert.ok(hosts[0].getObjectByName("Regular Lenny judging"));
  assert.equal(hosts[0].getObjectByName("Solid shirt torso"), undefined);
  assert.equal(hosts[0].getObjectByName("Gold award trophy"), undefined);
  release(scene);
});

function assertSolid(host, floor, height) {
  const bounds = new THREE.Box3().setFromObject(host);
  assert.ok(Math.abs(bounds.min.y - floor) < .00001, "Feet must meet the room floor or stage");
  assert.ok(Math.abs(bounds.max.y - floor - height) < .00001, "Character must fit its scene height");
  assert.ok(bounds.max.z - bounds.min.z > height * .35, "Silhouette must have real depth");
  let meshes = 0;
  host.traverse((object) => {
    assert.ok(!(object instanceof THREE.Sprite), "Character must not contain billboards");
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    assert.notEqual(object.geometry.type, "PlaneGeometry");
    assert.ok(object.material instanceof THREE.MeshStandardMaterial, "Parts must respond to scene lighting");
    assert.ok(object.castShadow && object.receiveShadow);
    const vertices = object.geometry.getAttribute("position").array;
    assert.ok(vertices.every(Number.isFinite), `${object.name} vertices must be finite`);
    assert.ok(object.geometry.getAttribute("normal").array.every(Number.isFinite));
  });
  assert.ok(meshes > 50, "Head, body, wings and limbs must be separate solid parts");
}

test("award presenter is a solid lit model anchored to the stage, including its trophy", () => {
  const { scene, hosts, pending } = fixture("awards");
  assert.equal(hosts.length, 1); assert.equal(pending.length, 0);
  assertSolid(hosts[0], lennyPresenter.position[1], lennyPresenter.height);
  assert.ok(hosts[0].getObjectByName("Gold award trophy"));
  assert.ok(hosts[0].getObjectByName("Curled dragon tail"));
  const cup = hosts[0].getObjectByName("Hollow trophy cup");
  assert.ok(cup.material.metalness > .5);
  release(scene);
});

test("four solid sponsor hosts share geometry and have individual curved shirt prints", () => {
  const { scene, hosts, pending } = fixture("atrium");
  assert.equal(hosts.length, 4);
  assert.deepEqual(pending.map(({ url }) => url), lennySponsors.map(({ id }) => `/assets/lenny/logos/${id}.png`));
  hosts.forEach((host, index) => {
    const sponsor = lennySponsors[index];
    assertSolid(host, .03, sponsorLennyHeight);
    assert.equal(host.position.x, sponsor.position[0]); assert.equal(host.position.z, sponsor.position[1]);
    assert.equal(host.rotation.y, 0, "Character orientation must stay fixed as the camera orbits");
    const shirt = host.getObjectByName("Solid shirt torso");
    assert.ok(shirt); assert.equal(shirt.geometry, hosts[0].getObjectByName("Solid shirt torso").geometry);
    const print = host.getObjectByName(`${sponsor.id} shirt print`);
    assert.equal(print.material.map, pending[index].texture);
    const depth = new THREE.Box3().setFromBufferAttribute(print.geometry.getAttribute("position"));
    assert.ok(depth.max.z - depth.min.z > .05, "Logo must wrap around the shirt surface");
    assert.ok(!host.getObjectByName("Gold award trophy"));
  });
  release(scene);
});

test("logo decoding after leaving the room releases the late texture", () => {
  const { scene, controller, pending } = fixture("atrium");
  controller.dispose();
  for (const { texture, ready } of pending) {
    let released = false; texture.addEventListener("dispose", () => { released = true; });
    ready(texture); assert.ok(released);
  }
  release(scene);
});
