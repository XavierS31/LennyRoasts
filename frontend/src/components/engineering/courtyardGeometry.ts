import * as THREE from "three";
import { curtainGrid, framedWindow, stoneUVs, type ExteriorMaterials } from "./exteriorMaterials";
import type { addCampusSite } from "./campusSite";

// Photos 4–6: a tall glazed entrance behind a low projecting brick pavilion,
// with a deeper, simpler brick business wing to its right. Photo-derived scale.
export function addEngineeringCourtyard(scene: THREE.Scene, materials: ExteriorMaterials, brick: THREE.Material, site: ReturnType<typeof addCampusSite>) {
  const selected: THREE.Mesh[] = [];
  const group = new THREE.Group(); group.name = "Engineering glass entrance and courtyard"; scene.add(group);
  const part = (size: [number, number, number], at: [number, number, number], material: THREE.Material, name: string, building = false) => {
    const geometry = stoneUVs(new THREE.BoxGeometry(...size), material === brick ? 1.6 : 4);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...at); mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    if (building) { mesh.userData.building = "Engineering I"; selected.push(mesh); }
    else mesh.userData.exteriorWindowDetail = true;
    return mesh;
  };
  // The backing is inset from both glazed faces; glazing wraps the corner.
  part([21.4, 17.55, 18.4], [24.1, 8.775, 10.9], materials.recess, "Glass entrance backing", true);
  const front = curtainGrid(group, 22, 17.1, materials, 8, 12, .48, .7);
  front.position.set(24, 8.85, 20.32); front.name = "Floor-to-roof courtyard glazing";
  const side = curtainGrid(group, 10.2, 17.1, materials, 4, 12, .48, .7);
  side.rotation.y = Math.PI / 2; side.position.set(35.13, 8.85, 15.1);
  side.name = "Glazed corner return";
  for (const y of [4.5, 8.8, 13.1]) {
    part([22.2, .42, .5], [24, y, 20.44], materials.frame, "Glazed floor spandrel");
    part([.5, .42, 10.6], [35.25, y, 15.1], materials.frame, "Return floor spandrel");
  }
  part([23.1, .75, 19.95], [24, 17.65, 10.9], materials.metal, "Glazed hall silver roof edge");
  // A curved brick nose sits ahead of the glazing, with real curved side walls.
  const outline = new THREE.Shape(); outline.moveTo(12.9, -15.8); outline.lineTo(19.7, -15.8);
  outline.lineTo(19.7, -20.1); outline.quadraticCurveTo(19.7, -23.4, 16.4, -23.4);
  outline.lineTo(12.9, -23.4); outline.closePath();
  const curvedLayer = (height: number, y: number, material: THREE.Material, name: string) => {
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: height, bevelEnabled: false, curveSegments: 20 });
    geometry.rotateX(-Math.PI / 2); stoneUVs(geometry, material === brick ? 1.6 : 4);
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = y; mesh.name = name;
    mesh.userData.building = "Engineering I"; mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh); selected.push(mesh);
  };
  curvedLayer(6.85, .15, brick, "Low projecting curved brick pavilion");
  curvedLayer(.65, 7, materials.stone, "Pavilion pale curved cornice");
  curvedLayer(.16, 7.65, materials.metal, "Pavilion metal coping");
  for (const x of [14.2, 16.7]) {
    const window = framedWindow(group, 1.6, 1.55, materials, 2); window.position.set(x, 5.5, 23.5);
  }
  const pavilionDoor = framedWindow(group, 2.15, 3.2, materials, 1);
  pavilionDoor.position.set(15.5, 1.9, 23.5); pavilionDoor.name = "Pavilion ground-floor entrance";
  // Clear double doors at the foot of the tall window wall and a shallow canopy.
  for (const x of [26.55, 28.35]) {
    const door = framedWindow(group, 1.75, 3.15, materials, 1); door.position.set(x, 1.9, 20.68);
    part([.06, .65, .12], [x + (x < 27 ? .53 : -.53), 1.8, 20.88], materials.metal, "Glass entrance pull handle");
  }
  part([6.4, .27, 2.3], [27.45, 3.95, 21.2], materials.metal, "Glass entrance canopy");

  // The right wing projects farther into the lawn, stepping down toward the
  // foreground business entrance. Its broad brick panels stay deliberately simple.
  part([24.6, 13.6, 24.2], [47.7, 6.8, 17], brick, "Projecting business wing", true);
  part([20.8, 15.15, 8], [47.7, 7.575, 1], brick, "Taller business rear volume", true);
  part([25, .25, 24.6], [47.7, 13.72, 17], materials.metal, "Business parapet coping");
  part([21.2, .25, 8.4], [47.7, 15.28, 1], materials.metal, "Business rear coping");
  for (const y of [5.55, 9.35]) {
    const ribbon = curtainGrid(group, 21.3, 1.3, materials, 10, 1, .16, .28);
    ribbon.position.set(47.7, y, 29.2); ribbon.name = "Business horizontal window ribbon";
    part([21.7, .33, .68], [47.7, y - .82, 29.2], materials.metal, "Business silver ribbon sill");
  }
  for (const x of [43, 47.7, 52.4]) {
    const door = framedWindow(group, 3.55, 3.6, materials, 2); door.position.set(x, 2, 29.24);
  }
  part([14.8, .55, 2.6], [47.7, 4.25, 29.5], materials.metal, "Business entrance projecting canopy");
  for (const x of [40.65, 54.75]) part([.4, 4, .4], [x, 2, 30.15], materials.stone, "Business entrance column");
  // Side elevation stays modeled when viewed from the courtyard's left path.
  for (const y of [5.55, 9.35]) {
    const returnWindow = curtainGrid(group, 11.6, 1.3, materials, 6, 1, .16, .28);
    returnWindow.rotation.y = -Math.PI / 2; returnWindow.position.set(35.3, y, 22.5);
  }
  // Small, grounded campus furniture uses the site's existing materials.
  const furniture = new THREE.MeshStandardMaterial({ color: 0x394239, roughness: .8, metalness: .3 });
  for (const [x, z] of [[40.3, 34], [47.3, 34], [54.3, 34]]) {
    part([2.4, .13, 1.3], [x, .95, z], furniture, "Courtyard picnic tabletop");
    for (const dz of [-1, 1]) {
      part([2.4, .12, .4], [x, .52, z + dz], furniture, "Courtyard picnic bench");
      for (const dx of [-.85, .85]) part([.07, .48, .08], [x + dx, .24, z + dz], furniture, "Picnic bench leg");
    }
    for (const dx of [-.85, .85]) part([.1, .85, .9], [x + dx, .43, z], furniture, "Picnic table support");
  }
  for (let i = 0; i < 7; i++) {
    const rack = new THREE.Mesh(new THREE.TorusGeometry(.45, .045, 6, 16, Math.PI), site.paleMetal);
    rack.position.set(36.3 + i * 1.05, .4, 31.8); rack.rotation.y = Math.PI / 2;
    rack.castShadow = true; rack.userData.exteriorWindowDetail = true; group.add(rack);
    for (const dz of [-.45, .45]) part([.07, .42, .07], [36.3 + i * 1.05, .21, 31.8 + dz], site.paleMetal, "Bike rack foot");
  }
  return selected;
}
