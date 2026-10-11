import * as THREE from "three";
import { ATRIUM, columnRows, tableRows } from "./atriumLayout";

// Extends the Make atrium's columns, canopies and round tables using the six
// user-supplied photos. Textures are generated locally; no photo faces are used.
type V3 = [number, number, number];
type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; parent: THREE.Object3D };

function surface(draw: (ctx: CanvasRenderingContext2D) => void, repeat: [number, number] = [1, 1]) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  return texture;
}

function terrazzo(ctx: CanvasRenderingContext2D, base: string) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = i % 3 ? "rgba(66,55,43,.08)" : "rgba(255,255,244,.25)";
    ctx.fillRect((i * 97) % 512, (i * 193 + Math.floor(i / 512) * 37) % 512, 1 + i % 3, 1 + i % 2);
  }
}

export function addDetailedAtrium(scene: THREE.Scene, participantCount = 0) {
  const batches: Batch[] = [];
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const unitSphere = new THREE.SphereGeometry(1, 10, 6);
  const transform = new THREE.Object3D();
  const batch = (geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, scale: V3, rotation: V3 = [0, 0, 0], parent: THREE.Object3D = scene) => {
    let bucket = batches.find((item) => item.geometry === geometry && item.material === material && item.parent === parent);
    if (!bucket) { bucket = { geometry, material, matrices: [], parent }; batches.push(bucket); }
    transform.position.set(...position); transform.rotation.set(...rotation); transform.scale.set(...scale); transform.updateMatrix();
    bucket.matrices.push(transform.matrix.clone());
  };
  const cube = (size: V3, position: V3, material: THREE.Material, rotation: V3 = [0, 0, 0], parent = scene as THREE.Object3D) => batch(unitBox, material, position, size, rotation, parent);
  const pipe = (from: V3, to: V3, radius: number, material: THREE.Material, parent = scene as THREE.Object3D) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    transform.position.copy(a.add(b).multiplyScalar(.5));
    transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    transform.scale.set(radius, direction.length(), radius); transform.updateMatrix();
    let bucket = batches.find((item) => item.geometry === unitCylinder && item.material === material && item.parent === parent);
    if (!bucket) { bucket = { geometry: unitCylinder, material, matrices: [], parent }; batches.push(bucket); }
    bucket.matrices.push(transform.matrix.clone());
  };
  const material = (color: number, roughness = .7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const white = material(0xe4e1d4), cream = material(0xdcd4bc), dark = material(0x303738, .4, .5);
  const steel = material(0xb7c1c4, .29, .75), gold = material(0xe9b728, .36, .5), wood = material(0xab7646, .5);
  const screen = new THREE.MeshStandardMaterial({ color: 0x294b56, emissive: 0x16353f, emissiveIntensity: .6, roughness: .3 });
  const black = material(0x151b20, .65);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xb9d9dd, transparent: true, opacity: .22, roughness: .16, metalness: .1, side: THREE.DoubleSide, depthWrite: false });
  const brickMap = surface((ctx) => {
    ctx.fillStyle = "#a48673"; ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 32; row++) for (let col = -1; col < 9; col++) {
      ctx.fillStyle = `rgb(${115 + (row * 7 + col * 11 + 99) % 24}, ${61 + (row * 11 + col * 3 + 99) % 16}, ${43 + (row * 3 + col * 7 + 99) % 17})`;
      ctx.fillRect(col * 64 + (row % 2 ? 32 : 0) + 1, row * 16 + 1, 62, 14);
    }
  }, [30, 1]);
  const brick = new THREE.MeshStandardMaterial({ map: brickMap, roughness: .9 });
  const paleFloor = surface((ctx) => terrazzo(ctx, "#d5d2bc"), [12, 21]);
  const redFloor = surface((ctx) => terrazzo(ctx, "#9d6857"), [12, 21]);
  const polished = new THREE.MeshPhysicalMaterial({ map: paleFloor, color: 0xffffff, roughness: .23, metalness: .08, clearcoat: .55, clearcoatRoughness: .2 });
  const inlay = new THREE.MeshPhysicalMaterial({ map: redFloor, color: 0xffffff, roughness: .25, metalness: .08, clearcoat: .5 });

  cube([48, .3, 84], [0, -.15, 0], polished);
  // Red terrazzo ribbons establish the two table lanes and cross the full hall.
  for (const x of [-20, -12, 0, 12, 20]) cube([.9, .012, 84], [x, .012, 0], inlay);
  for (const z of [-35, -21, -7, 7, 21, 35]) cube([48, .012, .9], [0, .018, z], inlay);
  for (const z of [-28, 0, 28]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-24, .025, z - 6), new THREE.Vector3(-8, .025, z - 2), new THREE.Vector3(8, .025, z + 2), new THREE.Vector3(24, .025, z + 6)]);
    const ribbon = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, .35, 4, false), inlay);
    ribbon.scale.y = .02; ribbon.position.y = .025; scene.add(ribbon);
  }

  const boundary = (axis: "x" | "y" | "z", value: number, outward: number) => {
    const group = new THREE.Group(); group.userData.cutaway = { axis, value, outward }; scene.add(group); return group;
  };
  const brickWall = boundary("x", -24, -1), creamWall = boundary("x", 24, 1);
  const entrance = boundary("z", -42, -1), stairWall = boundary("z", 42, 1), roof = boundary("y", 32, 1);
  // Four continuous horizontal window bands on the brick side.
  for (const [bottom, top] of [[0, 3.2], [5.2, 10], [12, 17.8], [19.8, 25.6], [27.6, 32]]) {
    cube([.55, top - bottom, 84], [-24, (top + bottom) / 2, 0], brick, [0, 0, 0], brickWall);
  }
  for (const y of [4.2, 11, 18.8, 26.6]) {
    cube([.08, 2, 84], [-23.7, y, 0], glass, [0, 0, 0], brickWall);
    for (const z of [-42, -35, -28, -21, -14, -7, 0, 7, 14, 21, 28, 35, 42]) cube([.18, 2.1, .12], [-23.55, y, z], steel, [0, 0, 0], brickWall);
    for (const dy of [-1.05, 1.05]) cube([.2, .13, 84], [-23.55, y + dy, 0], steel, [0, 0, 0], brickWall);
  }
  cube([.6, 32, 84], [24, 16, 0], cream, [0, 0, 0], creamWall);
  cube([.64, 3.2, 84], [23.96, 1.6, 0], brick, [0, 0, 0], creamWall);
  for (const y of [9, 17, 25]) for (const z of [-33, -19, -5, 9, 23, 37]) {
    cube([.1, 2.7, 1.8], [23.62, y, z], steel, [0, 0, 0], creamWall);
    cube([.12, 2.45, 1.55], [23.54, y, z], screen, [0, 0, 0], creamWall);
    cube([.14, 2.5, .07], [23.45, y, z], white, [0, 0, 0], creamWall);
  }
  for (const z of [-31, -22, -13, -4, 5, 14, 23, 32]) {
    // Cream wall panel seams and low circular air vents.
    cube([.02, 29, .035], [23.65, 17, z], material(0xb8b3a5), [0, 0, 0], creamWall);
    batch(unitCylinder, dark, [23.55, 4.6, z], [.45, .1, .45], [0, 0, Math.PI / 2], creamWall);
  }
  for (const y of [7.5, 15, 22.5, 30]) cube([.03, .04, 84], [23.64, y, 0], dark, [0, 0, 0], creamWall);

  // Curtain wall at the entrance, as established by photos 1 and 2.
  cube([48, 32, .12], [0, 16, -42], glass, [0, 0, 0], entrance);
  for (let x = -24; x <= 24; x += 4) cube([.2, 32, .3], [x, 16, -41.82], steel, [0, 0, 0], entrance);
  for (let y = 0; y <= 32; y += 4) cube([48, .2, .3], [0, y, -41.82], steel, [0, 0, 0], entrance);
  for (const x of [-18, -10, 2, 10, 18]) for (const y of [10, 22]) cube([3.8, 3.75, .15], [x, y, -41.75], white, [0, 0, 0], entrance);
  for (const x of [-3, 3]) {
    cube([5.5, 4.2, .16], [x, 2.2, -41.65], glass, [0, 0, 0], entrance);
    for (const dx of [-2.8, 2.8]) cube([.16, 4.5, .22], [x + dx, 2.25, -41.5], steel, [0, 0, 0], entrance);
    cube([.09, 1, .14], [x + .8, 2.2, -41.3], dark, [0, 0, 0], entrance);
  }
  cube([12, .04, 3], [0, .04, -39.5], dark);
  // Daylit exterior glimpses behind the real window framing.
  cube([70, .2, 12], [0, -.12, -48], material(0x9fae8e));
  for (const x of [-18, 17]) batch(unitSphere, material(0x69845c), [x, 5, -47], [5, 4, 3]);

  // Cream lower columns, fluted silver shafts, collar rings and branching crowns.
  const leaf = new THREE.Shape();
  leaf.moveTo(0, .6); leaf.lineTo(.5, .05); leaf.lineTo(.18, .05); leaf.lineTo(.18, -.5); leaf.lineTo(-.18, -.5); leaf.lineTo(-.18, .05); leaf.lineTo(-.5, .05); leaf.closePath();
  const leafGeometry = new THREE.ShapeGeometry(leaf);
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0xeec437, roughness: .42, metalness: .35, side: THREE.DoubleSide });
  const shaftGeometry = new THREE.CylinderGeometry(.72, .72, 18, 20);
  const baseGeometry = new THREE.CylinderGeometry(.93, 1, 9, 24);
  for (const x of [-14, 14]) for (const z of columnRows) {
    batch(baseGeometry, cream, [x, 4.5, z], [1, 1, 1]);
    batch(shaftGeometry, steel, [x, 18, z], [1, 1, 1]);
    for (let n = 0; n < 16; n++) {
      const angle = n * Math.PI / 8;
      pipe([x + Math.cos(angle) * .74, 9, z + Math.sin(angle) * .74], [x + Math.cos(angle) * .74, 27, z + Math.sin(angle) * .74], .055, dark);
    }
    for (const y of [.15, 3, 8.6, 9.2, 14, 20, 26.8]) batch(unitCylinder, y < 9 ? dark : steel, [x, y, z], [y < 9 ? 1.02 : .88, .16, y < 9 ? 1.02 : .88]);
    batch(unitCylinder, steel, [x, 27.2, z], [1, .6, 1]);
    for (let n = 0; n < 18; n++) {
      const angle = n * Math.PI * 2 / 18;
      const endX = x + Math.cos(angle) * (3.3 + n % 3 * .3), endZ = z + Math.sin(angle) * (3.3 + n % 3 * .3);
      pipe([x + Math.cos(angle) * .4, 27.5, z + Math.sin(angle) * .4], [endX, 31.1, endZ], .045, steel);
      for (let j = 1; j <= 4; j++) {
        const t = j / 4;
        batch(leafGeometry, leafMaterial, [x + (endX - x) * t, 27.5 + 3.6 * t, z + (endZ - z) * t], [.75, .75, .75], [.15 * (n % 3), angle, n % 2 ? -.5 : .5]);
      }
    }
    // Warm illuminated column-base collar, not hundreds of dynamic point lights.
    const glow = new THREE.MeshStandardMaterial({ color: 0xffedaa, emissive: 0xffdc77, emissiveIntensity: 1.5 });
    for (const dx of [-.9, .9]) cube([.22, .65, .3], [x + dx, 8.1, z], glow);
    batch(unitCylinder, wood, [x, 2.4, z], [2, .16, 2]);
  }

  // Corrugated roof, cross beams, visible services and four framed skylights.
  const ceiling = material(0xdedfd6, .82);
  for (const x of [-18, 18]) cube([12, .28, 84], [x, 32, 0], ceiling, [0, 0, 0], roof);
  for (const z of [-39, -21, -3, 15, 33]) cube([24, .28, 8], [0, 32, z], ceiling, [0, 0, 0], roof);
  for (let z = -42; z <= 42; z += .7) for (const x of [-18, 18]) cube([12, .16, .13], [x, 31.8, z], white, [0, 0, 0], roof);
  for (const z of [-36, -18, 0, 18, 36]) cube([48, .7, .4], [0, 31.3, z], white, [0, 0, 0], roof);
  for (const x of [-12, 0, 12]) cube([.42, .75, 84], [x, 31.3, 0], white, [0, 0, 0], roof);
  const skylight = new THREE.MeshStandardMaterial({ color: 0xdbf7ff, emissive: 0xb1dcf1, emissiveIntensity: .7, side: THREE.DoubleSide });
  for (const z of [-30, -12, 6, 24]) {
    cube([11, .12, 8], [0, 32.1, z], skylight, [0, 0, 0], roof);
    for (const x of [-5.6, 5.6]) cube([.2, .55, 8.3], [x, 31.9, z], steel, [0, 0, 0], roof);
    for (const dz of [-4.1, 0, 4.1]) cube([11.4, .5, .14], [0, 31.9, z + dz], steel, [0, 0, 0], roof);
  }
  for (const x of [-19, 19]) {
    pipe([x, 29.8, -42], [x, 29.8, 42], .22, white, roof);
    pipe([x, 3, -38], [x, 29.8, -38], .14, steel);
  }
  for (const z of [-24, 0, 24]) pipe([-23, 30.1, z], [23, 30.1, z], .16, white, roof);

  // Opposite end: switchback stairs and open galleries across three levels.
  cube([48, 32, .6], [0, 16, 42], cream, [0, 0, 0], stairWall);
  const perforation = surface((ctx) => {
    ctx.fillStyle = "#c2c6c4"; ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = "destination-out";
    for (let y = 16; y < 512; y += 32) for (let x = 16; x < 512; x += 32) { ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = "source-over";
  }, [2, 1]);
  const railing = new THREE.MeshStandardMaterial({ map: perforation, transparent: true, alphaTest: .45, side: THREE.DoubleSide, metalness: .5, roughness: .4 });
  const stairTread = material(0xa3a9a4);
  const rail = (from: V3, to: V3) => {
    pipe(from, to, .06, dark);
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
    const mid = a.add(b).multiplyScalar(.5); mid.y -= .6;
    cube([delta.length(), 1.05, .045], [mid.x, mid.y, mid.z], railing, [0, 0, Math.atan2(delta.y, delta.x)]);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, p = new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), t);
      pipe([p.x, p.y - 1.2, p.z], [p.x, p.y, p.z], .05, dark);
    }
  };
  for (let level = 0; level < 3; level++) {
    const y = level * 7.5;
    for (let flight = 0; flight < 2; flight++) {
      const fromX = flight === 0 ? -10 : 10, toX = -fromX;
      const z = flight === 0 ? 34 : 38;
      const baseY = y + flight * 3.75;
      for (let step = 0; step < 22; step++) {
        const x = fromX + (toX - fromX) * (step + .5) / 22;
        cube([.94, .17, 3.2], [x, baseY + (step + 1) * 3.75 / 22, z], white);
        cube([.92, .035, 3.1], [x, baseY + (step + 1) * 3.75 / 22 + .09, z], stairTread);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(20, 3.75), .45, 3.25), white);
      beam.position.set(0, baseY + 1.75, z); beam.rotation.z = Math.atan2(3.75, toX - fromX); scene.add(beam);
      rail([fromX, baseY + 1.3, z - 1.65], [toX, baseY + 5.05, z - 1.65]);
      cube([5, .4, 7.3], [toX, baseY + 3.65, 36], white);
    }
    cube([48, .55, 4], [0, y + 7.4, 40], white);
    rail([-24, y + 8.7, 37.8], [24, y + 8.7, 37.8]);
    for (const x of [-20, -13, 13, 20]) {
      cube([3.5, 3.3, .18], [x, y + 9.3, 41.6], screen, [0, 0, 0], stairWall);
      cube([.12, 3.3, .22], [x, y + 9.3, 41.4], steel, [0, 0, 0], stairWall);
    }
  }
  for (const x of [-12, 12]) cube([.4, 25, .4], [x, 12.5, 37], white);

  // White oval collaboration tables, metal chairs and laptops in both lanes.
  const tableTop = new THREE.CylinderGeometry(1, 1, 1, 24);
  const tableMaterial = material(0xeceade, .32);
  const chair = (x: number, z: number, angle: number) => {
    batch(unitCylinder, black, [x, .9, z], [.48, .14, .45]);
    cube([.86, .85, .08], [x - Math.sin(angle) * .4, 1.36, z - Math.cos(angle) * .4], dark, [0, angle, 0]);
    for (const dx of [-.3, .3]) for (const dz of [-.3, .3]) pipe([x + dx, .05, z + dz], [x + dx, .88, z + dz], .035, dark);
  };
  const laptop = (x: number, z: number, angle: number) => {
    cube([.7, .05, .48], [x, 1.62, z], steel, [0, angle, 0]);
    cube([.7, .42, .04], [x, 1.83, z - .2], black, [-.15, angle, 0]);
    cube([.59, .31, .045], [x, 1.83, z - .17], screen, [-.15, angle, 0]);
  };
  for (const x of [-6, 6]) for (const z of tableRows) {
    batch(tableTop, tableMaterial, [x, 1.55, z], [2.3, .12, 1.85]);
    pipe([x, .12, z], [x, 1.5, z], .16, dark);
    for (const dx of [-1.25, 1.25]) pipe([x, .14, z], [x + dx, .14, z], .09, dark);
    for (let n = 0; n < 6; n++) {
      const angle = n * Math.PI / 3;
      chair(x + Math.sin(angle) * 2.8, z + Math.cos(angle) * 2.4, angle);
    }
    laptop(x - .6, z, 0); laptop(x + .7, z + .2, Math.PI);
    cube([.35, .035, .5], [x, 1.65, z + .75], gold);
  }
  // Workstations line the low windows on the brick wall.
  for (const z of [-32, -24, -16, -8, 0, 8, 16, 24]) {
    cube([3.6, .15, 5], [-21, 1.55, z], wood);
    for (const dz of [-1.3, 1.3]) {
      cube([.15, 1.5, .15], [-19.5, .75, z + dz], dark);
      cube([.12, 1.5, .12], [-22.4, .75, z + dz], dark);
      cube([.14, .9, 1.5], [-21.6, 2.12, z + dz], black);
      cube([.15, .72, 1.3], [-21.5, 2.12, z + dz], screen);
      chair(-18.4, z + dz, Math.PI / 2);
    }
    // Silver scalloped conduit running above the workstation windows.
    const wave = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => new THREE.Vector3(-23.2, 5.1 + Math.sin(i * Math.PI / 8) * .55, z - 4 + i * .5)));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(wave, 24, .055, 5, false), steel));
  }
  // Banners and flag provide orientation without copying identifiable portraits.
  const bannerMap = surface((ctx) => {
    ctx.fillStyle = "#232a2e"; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#e8bd32"; ctx.fillRect(0, 220, 512, 205);
    ctx.fillStyle = "#f5f1dc"; ctx.font = "bold 34px Georgia"; ctx.textAlign = "center";
    ctx.fillText("UCF ENGINEERING", 256, 90); ctx.fillText("KNIGHT HACKS", 256, 150);
    ctx.fillStyle = "#303332"; ctx.font = "bold 48px Georgia"; ctx.fillText("BUILD", 256, 325);
    ctx.fillStyle = "#e8e4d4"; ctx.font = "24px Georgia"; ctx.fillText("CREATE · COLLABORATE", 256, 470);
  });
  const bannerMaterial = new THREE.MeshStandardMaterial({ map: bannerMap, roughness: .9, side: THREE.DoubleSide });
  for (const z of [-21, 7]) cube([.04, 7, 4.2], [23.5, 15, z], bannerMaterial);
  const flagMap = surface((ctx) => {
    ctx.fillStyle = "#eee9d9"; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#853d3b"; for (let i = 0; i < 13; i += 2) ctx.fillRect(0, i * 512 / 13, 512, 512 / 13);
    ctx.fillStyle = "#263a50"; ctx.fillRect(0, 0, 230, 276);
    ctx.fillStyle = "#eee9d9"; for (let r = 0; r < 9; r++) for (let c = 0; c < 6; c++) { ctx.beginPath(); ctx.arc(18 + c * 36, 16 + r * 29, 3, 0, Math.PI * 2); ctx.fill(); }
  });
  cube([4, 6, .04], [-6, 20, 33.5], new THREE.MeshStandardMaterial({ map: flagMap, side: THREE.DoubleSide, roughness: 1 }));
  for (const z of [-35, 33]) {
    batch(unitCylinder, dark, [20, .65, z], [.55, 1.3, .55]);
    cube([1.5, 2.8, 1.2], [21.5, 1.4, z], black);
  }

  // Anonymous silhouettes represent only the API's returned eligible field count.
  for (const geometry of [new THREE.CapsuleGeometry(.24, .65, 3, 6), new THREE.SphereGeometry(.22, 8, 6)]) {
    const people = new THREE.InstancedMesh(geometry, material(0x303840), 200);
    for (let i = 0; i < 200; i++) {
      let x: number, z: number;
      if (i < 60) {
        const table = i % 10, angle = Math.floor(i / 10) * Math.PI / 3;
        x = (table < 5 ? -6 : 6) + Math.sin(angle) * 2.8;
        z = tableRows[table % 5] + Math.cos(angle) * 2.4;
      } else if (i < 76) {
        x = -18.4; z = -32 + Math.floor((i - 60) / 2) * 8 + (i % 2 ? 1.3 : -1.3);
      } else {
        // Additional field representatives occupy the circulation lanes.
        const index = i - 76;
        x = [-19, -11, 0, 11, 19][index % 5] + ((index * 7) % 5 - 2) * .25;
        z = -32 + Math.floor(index / 5) * 2.65;
      }
      const seated = i < 76;
      const matrix = new THREE.Matrix4().makeTranslation(x, geometry instanceof THREE.SphereGeometry ? seated ? 1.87 : 2.15 : seated ? 1.15 : 1.43, z);
      people.setMatrixAt(i, matrix);
      people.setColorAt(i, new THREE.Color(i % 7 === 0 ? 0xb29048 : i % 3 === 0 ? 0x737885 : 0x303840));
    }
    people.count = Math.min(200, Math.max(0, participantCount)); people.userData.fieldPopulation = true;
    people.castShadow = true; scene.add(people);
  }

  // Reuse geometries/materials and batch repeated parts to keep the large room light.
  for (const bucket of batches) {
    const mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.matrices.length);
    bucket.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.castShadow = bucket.material !== glass; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); bucket.parent.add(mesh);
  }
  // Broad daylight from the curtain wall and skylights, warm lower-column fill.
  const fill = new THREE.DirectionalLight(0xe0f2ff, 1.6); fill.position.set(0, 20, -45); fill.target.position.set(0, 9, 10); scene.add(fill, fill.target);
  const warm = new THREE.PointLight(0xffe7a7, 55, 65, 2); warm.position.set(0, 9, 0); scene.add(warm);
  return { width: ATRIUM.halfWidth * 2, length: ATRIUM.halfLength * 2, height: ATRIUM.height };
}
