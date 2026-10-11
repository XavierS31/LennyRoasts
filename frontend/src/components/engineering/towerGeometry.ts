import * as THREE from "three";
import { framedWindow, stoneUVs, type ExteriorMaterials } from "./exteriorMaterials";

// Reference 1: glazing/stone trim; 2: front facets; 3: hip roof; 4: wing setbacks.
export function addReferenceTower(scene: THREE.Scene, materials: ExteriorMaterials) {
  const group = new THREE.Group();
  group.name = "Engineering II reference tower";
  group.position.set(-36, 0, 17);
  scene.add(group);
  const radius = 5.1, apothem = radius * Math.cos(Math.PI / 8);
  const body = new THREE.Mesh(stoneUVs(new THREE.CylinderGeometry(radius, radius, 24.5, 8)), materials.stone);
  body.rotation.y = -Math.PI / 8;
  body.position.y = 12.25;
  body.name = "Engineering II"; body.userData.building = "Engineering II";
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const band = (radius: number, height: number, y: number, material: THREE.Material, name: string) => {
    const mesh = new THREE.Mesh(stoneUVs(new THREE.CylinderGeometry(radius, radius, height, 8)), material);
    mesh.rotation.y = -Math.PI / 8; mesh.position.y = y; mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
    return mesh;
  };
  band(5.18, .19, 9.72, materials.stone, "Continuous glazing sill");
  band(5.16, .15, 9.53, new THREE.MeshStandardMaterial({ color: 0x9c7661, roughness: .85 }), "Thin warm sill trim");
  band(5.17, .17, 23.85, materials.stone, "Stone cornice");
  band(5.34, 1.15, 24.94, materials.metal, "Octagonal silver parapet");
  band(5.4, .13, 25.58, materials.frame, "Projecting metal coping");
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.29, 1.75, 8), materials.metal);
  roof.rotation.y = -Math.PI / 8; roof.position.y = 26.505;
  roof.name = "Shallow eight-sided hip roof"; roof.castShadow = true; group.add(roof);
  // Each bay sits on its own face plane, rather than floating across a curved wall.
  for (const index of [0, 1, 2, 6, 7]) {
    const angle = index * Math.PI / 4;
    const face = new THREE.Group();
    face.rotation.y = angle;
    face.position.set(Math.sin(angle) * (apothem + .035), 0, Math.cos(angle) * (apothem + .035));
    face.name = `Tower facade ${index}`; group.add(face);
    const bay = framedWindow(face, 3.05, 12.5, materials, 8);
    bay.position.y = 16.2; bay.name = "Tall two-column curtain window";
    // Wider pale spandrels occur at the floor lines in all four references.
    for (const y of [13.05, 16.2, 19.35]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.96, .6, .1), materials.frame);
      panel.position.set(0, y, .045); face.add(panel);
    }
    const small = framedWindow(face, 1.25, 1.3, materials, 2);
    small.position.y = 6.6; small.name = "Small lower-story window";
    const ground = framedWindow(face, 2.9, 3.15, materials, 2);
    ground.position.y = 1.9; ground.name = "Ground-floor divided window";
    const ornament = new THREE.Mesh(new THREE.ConeGeometry(.23, .38, 4), materials.frame);
    ornament.rotation.z = Math.PI; ornament.position.set(0, 4.92, .12);
    face.add(ornament);
  }
  // Vertical standing seams on the silver cap, aligned with the stone facets.
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(.035, 1.12, .055), materials.frame);
    seam.rotation.y = angle;
    seam.position.set(Math.sin(angle) * 5.34 * Math.cos(Math.PI / 8), 24.94, Math.cos(angle) * 5.34 * Math.cos(Math.PI / 8));
    group.add(seam);
  }
  return body;
}
