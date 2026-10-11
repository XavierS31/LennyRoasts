// Adapted from the user-owned Figma Make project rmSpAlKuWy4ZPVhzoY8dXW.
// Original geometry, procedural textures, materials and architectural dimensions.
import * as THREE from "three";
import { addDetailedAtrium } from "./atriumGeometry";


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
  const creamTexture = masonryTexture("#d8c8aa", "#eee5d4", 46, 18);
  const brickMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: brickTexture, roughness: 0.9 });
  const creamMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: creamTexture, roughness: 0.82 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b6aa, roughness: 0.88 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x244653, metalness: 0.35, roughness: 0.18, transparent: true, opacity: 0.9 });
  const windowGeometry = new THREE.BoxGeometry(1.35, 1.35, 0.12);
  const architecturalBox = (size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
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
  ) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    scene.add(group);
    const addLayer = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
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
    addLayer(new THREE.BoxGeometry(width + 0.2, 0.5, depth + 0.2), creamMaterial, Math.min(8.5, height - 5));
    addLayer(new THREE.BoxGeometry(width + 0.3, 3.2, depth + 0.3), creamMaterial, height - 1.9);
    addLayer(new THREE.BoxGeometry(width + 0.7, 0.45, depth + 0.7), roofMaterial, height + 0.2);
    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x19343f, metalness: 0.5, roughness: 0.2 });
    const frontCount = Math.max(2, Math.floor((width - 3) / 3.1));
    const sideCount = Math.max(2, Math.floor((depth - 3) / 3.1));
    for (let floor = 0; floor < floors; floor++) {
      const y = 2 + floor * ((height - 3) / floors);
      for (let i = 0; i < frontCount; i++) {
        const wx = -width / 2 + 2 + i * ((width - 4) / Math.max(1, frontCount - 1));
        for (const wz of [-depth / 2 - 0.07, depth / 2 + 0.07]) {
          const win = new THREE.Mesh(windowGeometry, windowMaterial);
          win.position.set(wx, y, wz);
          group.add(win);
        }
      }
      for (let i = 0; i < sideCount; i++) {
        const wz = -depth / 2 + 2 + i * ((depth - 4) / Math.max(1, sideCount - 1));
        for (const wx of [-width / 2 - 0.07, width / 2 + 0.07]) {
          const win = new THREE.Mesh(windowGeometry, windowMaterial);
          win.rotation.y = Math.PI / 2;
          win.position.set(wx, y, wz);
          group.add(win);
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
    [58, -17], [58, 30], [45, 30], [45, 24], [-25, 24],
    [-25, 37], [-49, 37],
  ];
  footprint.moveTo(footprintPoints[0][0], -footprintPoints[0][1]);
  footprintPoints.slice(1).forEach(([x, z]) => footprint.lineTo(x, -z));
  footprint.closePath();
  const footprintGeometry = new THREE.ExtrudeGeometry(footprint, { depth: 2.7, bevelEnabled: false });
  footprintGeometry.rotateX(-Math.PI / 2);
  const footprintMesh = new THREE.Mesh(footprintGeometry, creamMaterial);
  footprintMesh.position.y = 0.02;
  footprintMesh.name = "Engineering I + II";
  footprintMesh.userData.building = "Engineering I + II";
  footprintMesh.castShadow = true;
  footprintMesh.receiveShadow = true;
  scene.add(footprintMesh);
  selectable.push(footprintMesh);

  // Western Engineering II bar and the continuous diagonal front facade.
  mass("Engineering II", 19, 63, 14.5, -39, -6, 0, 4);
  mass("Engineering II", 17, 18, 12, -39, -37, 0, 3);
  const angle = 0;
  mass("Engineering I", 86, 21, 17, 1, 8, angle, 4);
  // Filled perpendicular rear volume intersects the front bar at full depth.
  mass("Engineering I", 25, 49, 16, 7, -17, angle, 4);
  mass("Engineering I", 31, 29, 14, 34, -17, angle, 3);
  mass("Engineering I", 29, 24, 12, 47, 8, angle, 3);
  mass("Engineering I", 20, 17, 11, 48, 26, angle, 3);
  // Keep the connector behind the tower so its full polygonal silhouette remains visible.
  mass("Engineering I + II", 17, 10, 9, -21, 2, 0, 2);

  // Tall polygonal tower at the bottom-left/front of the map footprint.
  const towerGroup = new THREE.Group();
  towerGroup.position.set(-36, 0, 15);
  scene.add(towerGroup);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 25, 8), creamMaterial);
  tower.position.y = 12.5;
  tower.name = "Engineering II";
  tower.userData.building = "Engineering II";
  tower.castShadow = true;
  tower.receiveShadow = true;
  towerGroup.add(tower);
  selectable.push(tower);
  for (const x of [-2.2, 0, 2.2]) {
    const glassBay = new THREE.Mesh(new THREE.BoxGeometry(1.55, 14, 0.2), glassMaterial);
    glassBay.position.set(x, 16.5, 6.12);
    towerGroup.add(glassBay);
    for (let floor = 0; floor < 4; floor++) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.23), creamMaterial);
      mullion.position.set(x, 11.2 + floor * 3.2, 6.25);
      towerGroup.add(mullion);
    }
  }
  for (const x of [-1.8, 1.8]) {
    const lowerWindow = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.55, 0.2), glassMaterial);
    lowerWindow.position.set(x, 6, 6.18);
    towerGroup.add(lowerWindow);
  }
  const towerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(5.5, 3.2, 4),
    new THREE.MeshStandardMaterial({ color: 0xd8ddda, metalness: 0.38, roughness: 0.35 }),
  );
  towerRoof.position.y = 26.7;
  towerRoof.rotation.y = Math.PI / 4;
  towerGroup.add(towerRoof);

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
  // Two precise rows of framed windows across the brick facade.
  for (const y of [5.6, 10.35]) {
    for (const x of [-15, -6.5, 2, 10.5, 19, 27.5]) {
      box(scene, [2.75, 2.25, 0.18], [x, y, 19.86], cream);
      box(scene, [2.25, 1.78, 0.22], [x, y, 19.98], 0x19343f);
      box(scene, [0.1, 1.8, 0.24], [x, y, 20.11], 0xc8cbc7);
      box(scene, [2.28, 0.1, 0.24], [x, y, 20.11], 0xc8cbc7);
    }
  }
  // Narrow windows across the cream upper floor.
  for (const x of [-17, -10, -3, 4, 11, 18, 25, 32]) {
    box(scene, [3.5, 1.45, 0.2], [x, 14.7, 18.72], 0x203c47);
    box(scene, [0.12, 1.5, 0.24], [x, 14.7, 18.85], 0xd0d2cd);
  }
  // Beige fourth/ground floor with framed windows matching the upper levels.
  architecturalBox([52.4, 3.15, 1.35], [5, 1.58, 19.18], creamMaterial);
  for (const x of [-15, -6.5, 2, 10.5, 19, 27.5]) {
    box(scene, [2.75, 2.25, 0.18], [x, 1.55, 19.86], cream);
    box(scene, [2.25, 1.78, 0.22], [x, 1.55, 19.98], 0x19343f);
    box(scene, [0.1, 1.8, 0.24], [x, 1.55, 20.11], 0xc8cbc7);
    box(scene, [2.28, 0.1, 0.24], [x, 1.55, 20.11], 0xc8cbc7);
  }
  for (const x of [-38, -34]) box(scene, [2.4, 3, 0.2], [x, 1.6, 21.25], 0x17313b);
  box(scene, [10, 0.35, 2.5], [-36, 3.65, 21.65], 0xb0b1aa);
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
  return selectable;
}

export function addAtrium(scene: THREE.Scene, participantCount = 0) {
  return addDetailedAtrium(scene, participantCount);
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
