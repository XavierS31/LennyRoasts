// Adapted from the user-owned Figma Make project rmSpAlKuWy4ZPVhzoY8dXW.
// Original geometry, procedural textures, materials and architectural dimensions.
import * as THREE from "three";
import { batchExteriorWindows, createExteriorMaterials, framedWindow, stoneUVs } from "./exteriorMaterials";
import { addReferenceTower } from "./towerGeometry";


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
    texture.repeat.set(7, 7);
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
    if (material === creamMaterial) stoneUVs(mesh.geometry);
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
      if (material === creamMaterial) stoneUVs(geometry);
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
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
    sprite.position.set(...position);
    sprite.scale.set(20, 3.75, 1);
    scene.add(sprite);
  };

  // Approximately 150 m of campus around the map-derived footprint.
  box(scene, [150, 0.4, 130], [0, -0.3, 0], 0x527342);
  box(scene, [13, 0.16, 130], [-68, 0, 0], 0x3b4144);
  box(scene, [150, 0.16, 13], [0, 0, 58], 0x3b4144);
  box(scene, [3, 0.08, 130], [-59.5, 0.08, 0], 0xc8c5b8);
  box(scene, [130, 0.08, 3], [3, 0.08, 49.5], 0xc8c5b8);
  const diagonalWalk = box(scene, [88, 0.08, 3], [-4, 0.09, 35], 0xc8c5b8);
  diagonalWalk.rotation.y = -0.16;

  // One map-derived, connected lower footprint unifies Engineering I, II and the tower.
  const footprint = new THREE.Shape();
  const footprintPoints: Array<[number, number]> = [
    [-49, -44], [-29, -44], [-29, -25], [28, -25], [28, -17],
    [58, -17], [58, 30], [45, 30], [45, 24], [31.2, 24],
    [31.2, 19.7], [-25, 19.7], [-25, 15], [-49, 15],
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
  mass("Engineering II", 19, 52.5, 14.5, -39, -11.25, 0, 4);
  mass("Engineering II", 17, 18, 12, -39, -37, 0, 3);
  const angle = 0;
  mass("Engineering I", 70, 21, 17, 9, 8, angle, 4, false);
  // Filled perpendicular rear volume intersects the front bar at full depth.
  mass("Engineering I", 25, 49, 16, 7, -17, angle, 4);
  mass("Engineering I", 31, 29, 14, 34, -17, angle, 3);
  mass("Engineering I", 29, 24, 12, 47, 8, angle, 3);
  mass("Engineering I", 20, 17, 11, 48, 26, angle, 3);
  // Keep the connector behind the tower so its full polygonal silhouette remains visible.
  mass("Engineering I + II", 17, 10, 9, -21, 2, 0, 2);

  // The reference corner is the tower alone, with a recessed beige link to the wing.
  selectable.push(addReferenceTower(scene, exteriorMaterials));
  architecturalBox([5.8, 17, 9], [-28.9, 8.5, 10.5], creamMaterial);
  for (const y of [2, 6, 10, 14.5]) {
    const linkWindow = framedWindow(scene, 2.15, 2.65, exteriorMaterials);
    linkWindow.position.set(-27.7, y, 15.06);
  }

  // Glass classroom/connector wing visible at the right of the reference facade.
  const curtainWall = new THREE.Mesh(new THREE.BoxGeometry(23, 10.5, 0.3), glassMaterial);
  curtainWall.position.set(47, 10.3, 20.15);
  curtainWall.castShadow = true;
  scene.add(curtainWall);
  for (let x = 37; x <= 57; x += 4) box(scene, [0.22, 10.8, 0.38], [x, 10.3, 20.35], 0xd5d5ce);
  for (const y of [6.7, 10.2, 13.7]) box(scene, [23.2, 0.2, 0.38], [47, y, 20.35], 0xd5d5ce);
  // Projecting brick front block shown in the reference elevation.
  architecturalBox([52, 9, 1.25], [5, 8.1, 19.15], brickMaterial);
  architecturalBox([52.4, 0.5, 1.4], [5, 8.35, 19.2], creamMaterial);
  architecturalBox([52.4, 0.55, 1.5], [5, 12.55, 19.2], creamMaterial);
  // Framed panes carry sky reflection and slight roughness instead of flat black fills.
  for (const y of [5.6, 10.35]) {
    for (const x of [-15, -6.5, 2, 10.5, 19, 27.5]) {
      const win = framedWindow(scene, 2.4, 1.95, exteriorMaterials);
      win.position.set(x, y, 19.9);
    }
  }
  for (const x of [-17, -10, -3, 4, 11, 18, 25, 32]) {
    const win = framedWindow(scene, 3.5, 1.45, exteriorMaterials);
    win.position.set(x, 14.7, 18.72);
  }
  architecturalBox([52.4, 3.15, 1.35], [5, 1.58, 19.18], creamMaterial);
  for (const x of [-15, -6.5, 2, 10.5, 19, 27.5]) {
    const win = framedWindow(scene, 2.4, 1.95, exteriorMaterials);
    win.position.set(x, 1.55, 19.9);
  }
  for (const x of [-20, 31]) {
    const fixture = new THREE.PointLight(0xffe7b0, 2.2, 7);
    fixture.position.set(x, 11.8, 21);
    scene.add(fixture);
    box(scene, [0.3, 0.45, 0.3], [x, 11.8, 20.25], 0xe8dfc5);
  }

  // Cleaner roof planes and offsets visible in top and isometric views.
  const roofA = box(scene, [14, 1.1, 20], [7, 17.1, -19], 0x9fa49f);
  roofA.rotation.y = angle;
  const roofB = box(scene, [11, 1.4, 9], [34, 14.7, -17], 0xa9aba5);
  roofB.rotation.y = angle;
  sign("ENGINEERING", [7, 12.05, 20.35]);

  // Restrained Florida landscaping and campus context.
  const treePositions: Array<[number, number]> = [
    [-54, -43], [-54, -24], [-54, 8], [-53, 30], [-47, 47], [-25, 45],
    [0, 47], [25, 47], [52, 45], [64, 16], [61, -18], [50, -43],
  ];
  for (let i = 0; i < treePositions.length; i++) {
    const [x, z] = treePositions[i];
    box(scene, [0.45, 3.8, 0.45], [x, 1.9, z], 0x594430);
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.1 + (i % 3) * 0.45, 1),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x285c32 : 0x3f753e, roughness: 0.9 }),
    );
    crown.position.set(x, 5, z);
    crown.castShadow = true;
    scene.add(crown);
  }
  for (const x of [-48, -20, 8, 36, 60]) {
    box(scene, [0.16, 4.2, 0.16], [x, 2.1, 46], 0x50575a);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 0.25, 12), new THREE.MeshStandardMaterial({ color: 0xe9e1c4, emissive: 0x4c421e }));
    lamp.position.set(x, 4.25, 46);
    scene.add(lamp);
  }
  batchExteriorWindows(scene);
  return selectable;
}

export function addAtrium(scene: THREE.Scene, participantCount = 0) {
  box(scene, [48, 0.4, 54], [0, 0, 0], 0xd8d1c2);
  box(scene, [48, 28, 1], [0, 14, -27], 0x773e35);
  box(scene, [1, 28, 54], [-24, 14, 0], brick);
  box(scene, [1, 28, 54], [24, 14, 0], cream);
  for (let i = 0; i < 5; i++) {
    box(scene, [4.7, 10, 0.18], [-12 + i * 6, 17, -26.4], 0x82a7b0);
  }
  for (const x of [-17, -7, 7, 17]) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.95, 25, 12),
      new THREE.MeshStandardMaterial({ color: 0x2d3130, metalness: 0.45 }),
    );
    pillar.position.set(x, 12.5, -3);
    scene.add(pillar);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 4, 8),
      new THREE.MeshStandardMaterial({ color: gold, metalness: 0.5 }),
    );
    canopy.position.set(x, 24, -3);
    scene.add(canopy);
  }
  for (let i = 0; i < 9; i++) {
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.25, 24),
      new THREE.MeshStandardMaterial({ color: 0xe9e6dc }),
    );
    table.position.set(-14 + (i % 3) * 14, 1.5, -16 + Math.floor(i / 3) * 14);
    scene.add(table);
  }
  const people = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.28, 1.05, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x20252b, roughness: 0.8 }),
    200,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 200; i++) {
    const x = ((i * 17) % 430) / 10 - 21.5;
    const z = ((i * 31) % 490) / 10 - 24.5;
    matrix.makeTranslation(x, 1, z);
    people.setMatrixAt(i, matrix);
    people.setColorAt(i, new THREE.Color(i % 5 === 0 ? gold : i % 3 === 0 ? 0x683d7a : 0x1f2937));
  }
  people.count = Math.min(200, Math.max(0, participantCount));
  people.userData.fieldPopulation = true;
  scene.add(people);
}

export function addAuditorium(scene: THREE.Scene) {
  box(scene, [54, 0.5, 62], [0, 0, 0], 0x19191d);
  box(scene, [44, 1.2, 12], [0, 1, -24], 0x28262b);
  box(scene, [22, 9, 0.6], [0, 7, -29.5], 0x050505);
  box(scene, [18, 0.2, 0.3], [0, 7, -29.1], gold);
  const seats = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.35, 1.25, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x5a1f28, roughness: 0.7 }),
    200,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 200; i++) {
    const row = Math.floor(i / 20);
    const col = i % 20;
    matrix.makeTranslation(-18 + col * 1.9, 0.7 + row * 0.34, -9 + row * 4.1);
    seats.setMatrixAt(i, matrix);
  }
  scene.add(seats);
  for (let i = 0; i < 8; i++) {
    const light = new THREE.PointLight(gold, 18, 15);
    light.position.set(-21 + i * 6, 9, -18);
    scene.add(light);
  }
}
