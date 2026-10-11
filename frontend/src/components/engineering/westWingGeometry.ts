import * as THREE from "three";
import { framedWindow, stoneUVs, type ExteriorMaterials } from "./exteriorMaterials";

// The long wing is shown most clearly in the across-lawn photo (#2).
// Photo #4 establishes that its upper cream floor meets the right wing's height.
export function addReferenceWestWing(scene: THREE.Scene, materials: ExteriorMaterials, brick: THREE.Material, roof: THREE.Material) {
  const selected: THREE.Mesh[] = [];
  const group = new THREE.Group();
  group.name = "Engineering II long left wing";
  scene.add(group);
  const layer = (size: [number, number, number], at: [number, number, number], material: THREE.Material) => {
    const geometry = stoneUVs(new THREE.BoxGeometry(...size), material === brick ? 1.6 : 4);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...at); mesh.name = "Engineering II";
    mesh.userData.building = "Engineering II";
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh); selected.push(mesh); return mesh;
  };
  // Four floors, with two taller brick stories and a cream clerestory above.
  // Photo 2: tower, recessed beige link, then a shallower projecting brick end.
  // Stop the full-width bar behind the link; a thin overlay would leave the
  // original masonry blocking both the setback and its ground-level entrance.
  layer([17, 3.4, 47.8], [-40.5, 1.7, -14.1], materials.stone);
  layer([17, 9.85, 47.8], [-40.5, 8.325, -14.1], brick);
  layer([17.16, .36, 47.96], [-40.5, 8, -14.1], materials.stone);
  layer([17.18, 3.95, 47.98], [-40.5, 15.225, -14.1], materials.stone);
  layer([17.45, .19, 48.05], [-40.5, 17.23, -14.1], roof);
  layer([4.8, 3.4, 4.6], [-46.6, 1.7, 12.05], materials.stone);
  layer([4.8, 9.85, 4.6], [-46.6, 8.325, 12.05], brick);
  layer([4.96, .36, 4.76], [-46.6, 8, 12.05], materials.stone);
  layer([4.98, 3.95, 4.78], [-46.6, 15.225, 12.05], materials.stone);
  layer([5.08, .19, 4.88], [-46.6, 17.23, 12.05], roof);
  const link = layer([4.6, 17.65, 5.8], [-41.9, 8.825, 9.05], materials.stone);
  link.userData.towerConnector = "west";
  layer([1.35, 17.65, 4.3], [-40.05, 8.825, 11.6], materials.stone);
  layer([4.85, .22, 6.05], [-41.9, 17.7, 9.05], materials.stone);
  for (const y of [1.8, 5.9, 10.3, 14.8]) {
    const win = framedWindow(group, 1.85, y === 1.8 ? 3.2 : 2.4, materials, y === 1.8 ? 1 : 2);
    win.position.set(-42.35, y, 12.04);
  }
  // A cream vertical circulation panel and lower blank brick end, with oculi.
  layer([.28, 17.2, 3.5], [-49.12, 8.6, -35.4], materials.stone);
  layer([17, 3.4, 12], [-40.5, 1.7, -44], materials.stone);
  layer([17, 8.35, 12], [-40.5, 7.575, -44], brick);
  layer([17.2, .3, 12.2], [-40.5, 11.82, -44], materials.stone);

  const westWindow = (z: number, y: number, w: number, h: number) => {
    const win = framedWindow(group, w, h, materials);
    win.rotation.y = -Math.PI / 2;
    win.position.set(-49.23, y, z);
    return win;
  };
  for (let bay = 0; bay < 11; bay++) {
    const z = -29.5 + bay * 3.9;
    westWindow(z, 1.9, 2.05, 3);
    westWindow(z, 5.65, 1.55, 2.65);
    westWindow(z, 10.55, 1.55, 2.65);
    westWindow(z, 15, 2.15, 1.9);
    // The inner side remains articulated in orbit/top views.
    for (const y of [1.9, 5.65, 10.55, 15]) {
      const win = framedWindow(group, 1.55, y === 15 ? 1.9 : 2.65, materials);
      win.rotation.y = Math.PI / 2; win.position.set(-31.77, y, z);
    }
  }
  for (const x of [-46.6]) {
    for (const y of [1.9, 5.65, 10.55, 15]) {
      const win = framedWindow(group, 1.7, y === 15 ? 1.9 : 2.65, materials);
      win.position.set(x, y, 14.48);
    }
  }
  westWindow(-35.4, 1.85, 1.65, 3.6);
  for (const y of [6.1, 10.7]) westWindow(-35.4, y, 1.65, 2.9);
  const roundWindow = (z: number, y: number, radius: number, x = -49.26) => {
    const pane = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), materials.glass);
    pane.rotation.y = -Math.PI / 2; pane.position.set(x, y, z); group.add(pane);
    const surround = new THREE.Mesh(new THREE.TorusGeometry(radius + .05, .075, 6, 24), materials.stone);
    surround.rotation.y = -Math.PI / 2; surround.position.set(x - .03, y, z); group.add(surround);
    for (const size of [[.06, radius * 1.8, .055], [.06, .055, radius * 1.8]] as Array<[number, number, number]>) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(...size), materials.frame);
      mullion.position.set(x - .05, y, z); group.add(mullion);
    }
  };
  roundWindow(-35.4, 15.15, .58, -49.3);
  for (const z of [-48, -45.2, -42.4, -39.6]) roundWindow(z, 8.65, .57);
  for (const z of [-47, -43, -39]) westWindow(z, 1.85, 2.1, 2.9);
  return selected;
}
