// Adapted from the user-owned Figma Make project rmSpAlKuWy4ZPVhzoY8dXW.
// Original geometry, procedural textures, materials and architectural dimensions.
import * as THREE from "three";
import { batchExteriorWindows, createExteriorMaterials, framedWindow, stoneUVs } from "./exteriorMaterials";
import { addReferenceTower } from "./towerGeometry";
import { addDetailedAtrium } from "./atriumGeometry";
import { addReferenceWestWing } from "./westWingGeometry";
import { addCampusSite } from "./campusSite";
import { addHealthSciences } from "./healthSciencesGeometry";


const gold = 0xffc904;
const brick = 0x78382e;
const cream = 0xd8c8aa;

function box(
  scene: THREE.Scene,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  name = "",
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05 }),
  );
  mesh.position.set(...position);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addWindows(
  scene: THREE.Scene,
  startX: number,
  z: number,
  count: number,
  floors: number,
  reverse = false,
) {
  const material = new THREE.MeshStandardMaterial({
    color: 0x15252d,
    metalness: 0.55,
    roughness: 0.22,
  });
  for (let floor = 0; floor < floors; floor++) {
    for (let i = 0; i < count; i++) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.08), material);
      window.position.set(startX + i * 2.25, 2.1 + floor * 2.7, z);
      if (reverse) window.rotation.y = Math.PI;
      scene.add(window);
    }
  }
}

export function addExterior(scene: THREE.Scene) {
  const selectable: THREE.Mesh[] = [];
  const masonryTexture = (base: string, mortar: string, unitWidth: number, unitHeight: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = mortar;
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < Math.ceil(256 / unitHeight); row++) {
      const offset = row % 2 ? -unitWidth / 2 : 0;
      for (let x = offset; x < 256; x += unitWidth) {
        const variation = (row * 13 + x) % 9;
        context.fillStyle = base;
        context.globalAlpha = 0.9 + variation / 100;
        context.fillRect(x + 1.5, row * unitHeight + 1.5, unitWidth - 3, unitHeight - 3);
      }
    }
    context.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  };
  const brickTexture = masonryTexture("#78382e", "#b98a76", 32, 14);
  const exteriorMaterials = createExteriorMaterials();
  const brickMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: brickTexture, roughness: 0.9 });
  const creamMaterial = exteriorMaterials.stone;
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b6aa, roughness: 0.88 });
  const glassMaterial = exteriorMaterials.glass;
  const architecturalBox = (size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    if (material === creamMaterial || material === brickMaterial) stoneUVs(mesh.geometry, material === brickMaterial ? 1.6 : 4);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  const mass = (
    name: string,
    width: number,
    depth: number,
    height: number,
    x: number,
    z: number,
    rotation = 0,
    floors = 4,
    frontWindows = true,
  ) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    scene.add(group);
    const addLayer = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
      if (material === creamMaterial || material === brickMaterial) stoneUVs(geometry, material === brickMaterial ? 1.6 : 4);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      mesh.name = name;
      mesh.userData.building = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      selectable.push(mesh);
      return mesh;
    };
    addLayer(new THREE.BoxGeometry(width, 2.8, depth), creamMaterial, 1.4);
    addLayer(new THREE.BoxGeometry(width, height - 6.3, depth), brickMaterial, (height - 3.5) / 2 + 1.4);
    addLayer(new THREE.BoxGeometry(width + 0.2, 0.5, depth + 0.2), creamMaterial, height * .5);
    addLayer(new THREE.BoxGeometry(width + 0.3, 3.2, depth + 0.3), creamMaterial, height - 1.9);
    addLayer(new THREE.BoxGeometry(width + 0.7, 0.45, depth + 0.7), roofMaterial, height + 0.2);
    const frontCount = Math.max(2, Math.floor((width - 3) / 3.1));
    const sideCount = Math.max(2, Math.floor((depth - 3) / 3.1));
    for (let floor = 0; floor < floors; floor++) {
      const levels = floors === 4 ? [1.65, height * .33, height * .6, height - 2.1]
        : floors === 3 ? [1.65, height * .5, height - 2.1] : [1.65, height - 2.1];
      const y = levels[floor];
      for (let i = 0; i < frontCount; i++) {
        const wx = -width / 2 + 2 + i * ((width - 4) / Math.max(1, frontCount - 1));
        for (const wz of [-depth / 2 - .22, depth / 2 + .22]) {
          if (wz > 0 && !frontWindows) continue;
          const win = framedWindow(group, 1.35, 1.35, exteriorMaterials);
          win.position.set(wx, y, wz);
          if (wz < 0) win.rotation.y = Math.PI;
        }
      }
      for (let i = 0; i < sideCount; i++) {
        const wz = -depth / 2 + 2 + i * ((depth - 4) / Math.max(1, sideCount - 1));
        for (const wx of [-width / 2 - .22, width / 2 + .22]) {
          const win = framedWindow(group, 1.35, 1.35, exteriorMaterials);
          win.rotation.y = wx < 0 ? -Math.PI / 2 : Math.PI / 2;
          win.position.set(wx, y, wz);
        }
      }
    }
    return group;
  };

  const sign = (text: string, position: [number, number, number]) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.shadowColor = "rgba(55, 27, 0, .9)";
    context.shadowBlur = 2;
    context.shadowOffsetX = 5;
    context.shadowOffsetY = 5;
    context.strokeStyle = "#6f3b00";
    context.lineWidth = 3;
    context.fillStyle = "#c88708";
    context.font = "bold 46px Georgia, serif";
    context.textAlign = "center";
    context.strokeText(text, 256, 63);
    context.fillText(text, 256, 60);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const lettering = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    lettering.position.set(...position);
    scene.add(lettering);
  };

  addCampusSite(scene);
  addHealthSciences(scene, exteriorMaterials);

  // A connected lower footprint unifies the approximate rear campus volumes.
  const footprint = new THREE.Shape();
  const footprintPoints: Array<[number, number]> = [
    [-49, -44], [-29, -44], [-29, -25], [28, -25], [28, -17],
    [58, -17], [58, 30], [45, 30], [45, 24], [31.2, 24],
    [31.2, 19.7], [-25, 19.7], [-25, 14], [-49, 14],
  ];
  footprint.moveTo(footprintPoints[0][0], -footprintPoints[0][1]);
  footprintPoints.slice(1).forEach(([x, z]) => footprint.lineTo(x, -z));
  footprint.closePath();
  const footprintGeometry = new THREE.ExtrudeGeometry(footprint, { depth: 2.7, bevelEnabled: false });
  footprintGeometry.rotateX(-Math.PI / 2);
  const footprintMesh = new THREE.Mesh(stoneUVs(footprintGeometry), creamMaterial);
  footprintMesh.position.y = 0.02;
  footprintMesh.name = "Engineering I + II";
  footprintMesh.userData.building = "Engineering I + II";
  footprintMesh.castShadow = true;
  footprintMesh.receiveShadow = true;
  scene.add(footprintMesh);
  selectable.push(footprintMesh);

  // Western Engineering II bar and the continuous diagonal front facade.
  // Both wings terminate beside the tower; no rectangular mass projects through it.
  selectable.push(...addReferenceWestWing(scene, exteriorMaterials, brickMaterial, roofMaterial));
  const angle = 0;
  mass("Engineering I", 39, 21, 17.2, -6.5, 8, angle, 4, false);
  // Filled perpendicular rear volume intersects the front bar at full depth.
  mass("Engineering I", 25, 49, 16, 7, -17, angle, 4);
  mass("Engineering I", 31, 29, 14, 34, -17, angle, 3);
  mass("Engineering I", 29, 24, 9, 28, 8, angle, 3);
  mass("Engineering I", 24, 24, 12, 47, 8, angle, 3);
  mass("Engineering I", 20, 17, 11, 48, 26, angle, 3);
  // Keep the connector behind the tower so its full polygonal silhouette remains visible.
  mass("Engineering I + II", 17, 10, 9, -21, 2, 0, 2);

  // The reference corner is the tower alone, with a recessed beige link to the wing.
  selectable.push(addReferenceTower(scene, exteriorMaterials));
  architecturalBox([5.8, 17, 9], [-28.9, 8.5, 10.5], creamMaterial);
  for (const y of [1.7, 6, 10, 14.5]) {
    const linkWindow = framedWindow(scene, y === 1.7 ? 2.4 : 2.15, y === 1.7 ? 3.15 : 2.65, exteriorMaterials, y === 1.7 ? 1 : 2);
    linkWindow.position.set(-27.7, y, 15.1);
  }
  for (const x of [-27.85, -27.55]) architecturalBox([.055, .65, .07], [x, 1.65, 15.28], exteriorMaterials.metal);

  // Right glass wing sits above the lower brick volume, as seen in photos 1–3.
  const curtainWall = new THREE.Mesh(new THREE.BoxGeometry(22, 7.8, .15), glassMaterial);
  curtainWall.position.set(24, 13.2, 20.3); scene.add(curtainWall);
  for (let x = 13; x <= 35; x += 2.75) architecturalBox([.13, 7.95, .24], [x, 13.2, 20.43], exteriorMaterials.frame);
  for (const y of [9.3, 13.15, 17.1]) architecturalBox([22.2, .26, .24], [24, y, 20.43], exteriorMaterials.frame);
  for (const y of [11.1, 15]) architecturalBox([22.2, .065, .22], [24, y, 20.45], exteriorMaterials.frame);
  architecturalBox([22, 6, 1.2], [24, 6.3, 19.75], brickMaterial);
  architecturalBox([22, 3.3, 1.2], [24, 1.65, 19.75], creamMaterial);
  for (const x of [16, 21, 26, 31]) {
    const win = framedWindow(scene, 1.1, 1.15, exteriorMaterials);
    win.position.set(x, 6.4, 20.45);
    const ground = framedWindow(scene, 2.4, 2.95, exteriorMaterials);
    ground.position.set(x, 1.7, 20.45);
  }
  // Narrower five-bay signed brick panel. Its two brick stories already matched.
  architecturalBox([31, 9, 1.25], [-5.5, 8.1, 19.15], brickMaterial);
  architecturalBox([31.4, .36, 1.4], [-5.5, 8.1, 19.2], creamMaterial);
  architecturalBox([31.4, .25, 1.5], [-5.5, 12.62, 19.2], creamMaterial);
  for (const y of [5.5, 10.2]) {
    for (const x of [-17, -11, -5, 1, 7]) {
      const win = framedWindow(scene, 1.85, 2.65, exteriorMaterials);
      win.position.set(x, y, 19.9);
    }
  }
  for (const x of [-16, -11, -6, -1, 4, 9]) {
    const win = framedWindow(scene, 2.45, 1.25, exteriorMaterials);
    win.position.set(x, 15, 18.77);
  }
  const tallUpper = framedWindow(scene, 2.5, 2.8, exteriorMaterials);
  tallUpper.position.set(-22.5, 14.7, 18.77);
  architecturalBox([31.4, 3.15, 1.35], [-5.5, 1.58, 19.18], creamMaterial);
  for (const x of [-17, -11, -5, 1, 7]) {
    const win = framedWindow(scene, 2.7, 2.9, exteriorMaterials);
    win.position.set(x, 1.65, 19.9);
  }
  for (const x of [-20, 11]) architecturalBox([.18, .27, .18], [x, 11.7, 20], exteriorMaterials.frame);

  // Cleaner roof planes and offsets visible in top and isometric views.
  const roofA = box(scene, [14, 1.1, 20], [7, 17.1, -19], 0x9fa49f);
  roofA.rotation.y = angle;
  const roofB = box(scene, [11, 1.4, 9], [34, 14.7, -17], 0xa9aba5);
  roofB.rotation.y = angle;
  sign("Engineering", [-5.5, 12.05, 19.82]);

  batchExteriorWindows(scene);
  return selectable;
}

export function addAtrium(scene: THREE.Scene, participantCount = 0) {
  return addDetailedAtrium(scene, participantCount);
}
