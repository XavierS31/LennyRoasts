import * as THREE from "three";
import { framedWindow, stoneUVs, type ExteriorMaterials } from "./exteriorMaterials";

// Only the projecting two-storey wing in the four supplied photographs.
// The road-facing service elevation is east (+X); the palm-lined arcade is south
// (+Z). Proportions and placement are inferred, not a surveyed campus model.
export const healthSciencesOrigin = [-106, -6] as const;

function brickMap(relief = false) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = relief ? "#676767" : "#ab9680"; ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 32; row++) {
    for (let col = -1; col < 11; col++) {
      const x = col * 48 + (row % 2) * 24, y = row * 16;
      const shade = ((row * 73 + col * 31) % 19 + 19) % 19;
      ctx.fillStyle = relief ? `rgb(${168 + shade},${168 + shade},${168 + shade})` : `rgb(${105 + shade},${61 + shade * .6},${43 + shade * .5})`;
      ctx.fillRect(x + 1, y + 1, 46, 14);
      ctx.fillStyle = relief ? "#999" : "rgba(43,25,16,.22)";
      ctx.fillRect(x + 1, y + 13, 46, 2);
      for (let fleck = 0; fleck < 20; fleck++) {
        ctx.fillStyle = fleck % 2 ? "rgba(231,193,143,.15)" : "rgba(39,20,10,.16)";
        ctx.fillRect(x + 3 + (fleck * 17 + row * 7) % 42, y + 3 + (fleck * 7) % 10, 1, 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  if (!relief) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function foliageMap() {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#36552c"; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = i % 3 ? "#50703b" : "#233c23";
    ctx.beginPath(); ctx.ellipse(i * 47 % 128, i * 29 % 128, 2.5, 1.1, i, 0, Math.PI * 2); ctx.fill();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; return map;
}

export function addHealthSciences(scene: THREE.Scene, materials: ExteriorMaterials) {
  const wing = new THREE.Group(); wing.name = "Health Sciences · projecting wing";
  wing.position.set(healthSciencesOrigin[0], 0, healthSciencesOrigin[1]); scene.add(wing);
  const brick = new THREE.MeshStandardMaterial({ color: 0xffffff, map: brickMap(), bumpMap: brickMap(true), bumpScale: .035, roughness: .94 });
  const roof = new THREE.MeshStandardMaterial({ color: 0xa4a497, roughness: .96 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x272d27, roughness: .92 });
  const green = new THREE.MeshStandardMaterial({ color: 0x365648, roughness: .78, metalness: .15 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a968, roughness: .48, metalness: .55 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe2bc39, roughness: .82 });
  const mulch = new THREE.MeshStandardMaterial({ color: 0x6b5038, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0xffffff, map: foliageMap(), roughness: .98 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x827059, roughness: .98 });

  // These static details join the exterior material batches once, including the
  // shared window frames, so fine detail doesn't cost one draw call per brick/leaf.
  const part = (size: [number, number, number], at: [number, number, number], material: THREE.Material, name: string) => {
    const mesh = new THREE.Mesh(stoneUVs(new THREE.BoxGeometry(...size), material === brick ? 2 : 4), material);
    mesh.position.set(...at); mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.exteriorWindowDetail = true;
    wing.add(mesh); return mesh;
  };
  const round = (geometry: THREE.BufferGeometry, at: [number, number, number], material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...at);
    mesh.castShadow = mesh.receiveShadow = true; mesh.userData.exteriorWindowDetail = true; wing.add(mesh); return mesh;
  };
  const window = (width: number, height: number, at: [number, number, number], side = false) => {
    const pane = framedWindow(wing, width, height, materials, 2); pane.position.set(...at);
    if (side) pane.rotation.y = Math.PI / 2;
    const sillSize: [number, number, number] = side ? [.3, .3, width + .4] : [width + .4, .3, .3];
    part(sillSize, [at[0], at[1] - height / 2 - .22, at[2]], materials.stone, "Limestone window sill");
  };

  // Upper block floats over actual recessed bays, rather than painting dark
  // rectangles onto a solid first-floor wall. Cream coping follows each setback.
  part([20, 6.1, 29], [0, 7.45, 0], brick, "Six-window service elevation");
  part([13, 4.4, 25], [-3.5, 2.2, -2], brick, "Recessed ground floor");
  part([8, .14, 29], [6.1, .04, 0], materials.stone, "Paved service bay floor");
  part([21.8, .14, 4], [-1, .04, 13.7], materials.stone, "Paved arcade floor");
  part([20.5, .5, 29.5], [0, 10.7, 0], materials.stone, "Cream parapet coping");
  part([19, .14, 27.8], [0, 10.99, 0], roof, "Inset flat roof");
  part([8, 10.9, 12], [-6, 5.45, -19], brick, "Stepped connecting corner");
  part([8.4, .5, 12.4], [-6, 11.1, -19], materials.stone, "Higher corner coping");
  part([5.5, 11.6, 9], [-12.5, 5.8, -16], brick, "Rear setback");
  part([5.9, .45, 9.4], [-12.5, 11.8, -16], materials.stone, "Rear coping");
  for (const z of [-11.3, -6.8, -2.3, 2.2, 6.7, 11.2]) window(1.55, 2.85, [10.06, 7.8, z], true);
  for (const z of [-14.1, -9.1, -4.3, 1, 8.2, 14.1]) part([2.2, 4.4, .65], [8.9, 2.2, z], brick, "Service bay pier");
  part([.3, 1, 29], [10.03, 3.96, 0], brick, "Service bay lintels");
  part([.1, 3.5, 3.6], [3.1, 1.8, -6.7], dark, "Louvered utility door");
  for (let y = .25; y < 3.45; y += .14) part([.14, .035, 3.45], [3.16, y, -6.7], materials.metal, "Door louvers");
  part([.14, 2.7, 1.1], [3.14, 1.4, 11], dark, "Recessed personnel door");
  part([.08, .1, .24], [3.25, 1.45, 11.32], materials.frame, "Door handle");

  // The circular corner windows in photo 3 sit on two perpendicular elevations.
  const oculus = (at: [number, number, number], side: boolean) => {
    const pane = round(new THREE.CircleGeometry(.78, 32), at, materials.glass);
    const ring = round(new THREE.TorusGeometry(.82, .075, 8, 32), at, materials.stone);
    if (side) { pane.rotation.y = ring.rotation.y = Math.PI / 2; }
    part(side ? [.1, 1.55, .065] : [.065, 1.55, .1], at, materials.frame, "Oculus vertical mullion");
    part(side ? [.1, .065, 1.55] : [1.55, .065, .1], at, materials.frame, "Oculus crossbar");
  };
  oculus([-1.96, 7.9, -19], true); oculus([-6, 7.9, -12.96], false);

  // Photo 2: pale arcade, inset glazing, square red medallions and a tall
  // two-storey glazed strip framed by limestone beside the palms.
  part([20, 1.8, .5], [0, 3.65, 14.56], materials.stone, "Arcade stone spandrel");
  for (const x of [-9.4, -5.7, -2, 1.7, 5.4, 9.3]) {
    part([.55, 4.4, .75], [x, 2.2, 14.48], materials.stone, "Arcade limestone pier");
    part([.35, .35, .08], [x, 3.75, 14.86], brick, "Red brick medallion");
  }
  for (const x of [-7.7, -3.9, 0, 3.9, 7.7]) {
    window(1.6, 2.65, [x, 7.45, 14.56]);
    window(2.8, 2.75, [x, 1.65, 12.56]);
    part([2.05, .18, .65], [x, 5.96, 14.73], materials.stone, "Projecting window ledge");
  }
  part([3.8, 10.7, 3.6], [-11.4, 5.35, 13.3], materials.stone, "Tall limestone entrance frame");
  window(2.4, 8.6, [-11.4, 5.15, 15.16]);
  for (let y = 2; y < 9; y += 1.75) part([2.42, .075, .15], [-11.4, y, 15.27], materials.frame, "Tall glazing transom");

  // Photo 4: open service court, brick screen walls with stone post caps,
  // dumpsters, green electrical cabinets, yellow bollards and a recessed cart.
  part([.7, 2.2, 16], [17, 1.1, 1], brick, "Service enclosure facing Engineering");
  part([7.5, 2.2, .7], [13.6, 1.1, 9], brick, "Enclosure return");
  for (const z of [-7, 9]) {
    part([1.15, 2.3, 1.15], [17, 1.15, z], brick, "Brick enclosure post");
    part([1.45, .18, 1.45], [17, 2.39, z], materials.stone, "Stone post cap");
  }
  for (const z of [-10, -14]) {
    part([2.25, 1.6, 2.75], [13.2, .85, z], green, "Service dumpster");
    part([2.45, .16, 2.95], [13.2, 1.72, z], dark, "Dumpster lid");
    part([.05, .5, .8], [14.36, 1.1, z], materials.frame, "Dumpster label");
  }
  part([1.8, 1.65, 2.6], [17.8, .88, -18.4], green, "Electrical cabinets");
  for (const z of [-17.7, -19.1]) part([.04, 1.2, .06], [18.72, .85, z], dark, "Cabinet seams");
  for (const z of [-17, -11, -6]) for (const x of [10.6, 20.3]) {
    round(new THREE.CylinderGeometry(.1, .13, 1.1, 8), [x, .6, z], yellow);
  }
  part([3, .25, 1.55], [7.1, .65, 5], dark, "Utility cart chassis");
  part([2.1, .16, 1.75], [7.1, 2.05, 5], green, "Utility cart canopy");
  for (const x of [6.2, 8]) for (const z of [4.4, 5.6]) {
    const tire = round(new THREE.CylinderGeometry(.3, .3, .18, 12), [x, .35, z], dark); tire.rotation.x = Math.PI / 2;
    part([.06, 1.3, .06], [x, 1.4, z], materials.metal, "Cart canopy supports");
  }
  // Small rooftop services and the visible horizontal duct above the court.
  const duct = round(new THREE.CylinderGeometry(.35, .35, 2.6, 12), [10.35, 4.7, -9], brass); duct.rotation.x = Math.PI / 2;
  for (const z of [-9.85, -8.15]) part([.3, .65, .12], [10.15, 4.37, z], materials.metal, "Duct support");
  for (const z of [-9, 3]) {
    part([2.8, .8, 1.7], [-3, 11.4, z], roof, "Roof air handling unit");
    for (let i = 0; i < 9; i++) part([.08, .5, .03], [-4.15 + i * .28, 11.42, z + .87], dark, "HVAC fins");
  }
  for (const z of [-10, 10]) part([.18, 9.7, .18], [-10.08, 4.85, z], materials.metal, "Rainwater downpipe");

  // Clipped rectangular hedges carry a dense leaf surface and irregular small
  // edge clusters. Their service enclosure relationship matches photos 3–4.
  const hedgeSites: Array<[number, number, number, number, number]> = [
    [18, 12, 3, 3.1, 4], [18, -5, 3.4, 3.1, 3.5], [20, 5, 3, 2.7, 7],
    [-1, 19, 22, 1.5, 1.8], [-14, -19, 2, 1.7, 13],
  ];
  const hedgeClusters = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leaves, hedgeSites.length * 48);
  const matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  hedgeSites.forEach(([x, z, width, height, depth], index) => {
    part([width + .5, .05, depth + .5], [x, .025, z], mulch, "Hedge mulch bed");
    part([width, height, depth], [x, height / 2, z], leaves, "Clipped box hedge");
    for (let i = 0; i < 48; i++) {
      const u = (i * .6180339887) % 1, v = (i * .41421356) % 1;
      const px = x + (u - .5) * width, pz = z + (v - .5) * depth;
      // Smaller, tightly clipped tips follow the top plane, not a pile of balls.
      matrix.compose(new THREE.Vector3(px, height - .045 + (i % 3) * .025, pz), rotation, new THREE.Vector3(.18, .09, .18));
      hedgeClusters.setMatrixAt(index * 48 + i, matrix);
      hedgeClusters.setColorAt(index * 48 + i, new THREE.Color(i % 3 ? 0xabc48c : 0x6a875d));
    }
  });
  hedgeClusters.castShadow = hedgeClusters.receiveShadow = true; wing.add(hedgeClusters);

  // Three fan palms on the arcade lawn: ringed trunks, curved stems and many
  // narrow leaflets. Geometry is instanced instead of transparent billboard trees.
  const palms = [[-8, 23, 8.5], [1, 23.5, 9.3], [-4.2, 26, 6.8]];
  const leaflets = new THREE.InstancedMesh(new THREE.ConeGeometry(.13, 1, 3), leaves, palms.length * 12 * 18);
  let leafIndex = 0;
  palms.forEach(([x, z, h]) => {
    round(new THREE.CylinderGeometry(.17, .29, h, 9), [x, h / 2, z], bark);
    for (let y = .25; y < h - .5; y += .23) round(new THREE.TorusGeometry(.24 - y / h * .06, .023, 3, 9), [x, y, z], bark).rotation.x = Math.PI / 2;
    for (let frond = 0; frond < 12; frond++) {
      const a = frond * Math.PI / 6, length = 2.9 + frond % 3 * .3;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, h, z), new THREE.Vector3(x + Math.sin(a) * length * .5, h + 1.15, z + Math.cos(a) * length * .5), new THREE.Vector3(x + Math.sin(a) * length, h - .9, z + Math.cos(a) * length));
      round(new THREE.TubeGeometry(curve, 8, .035, 3, false), [0, 0, 0], leaves);
      for (let j = 1; j <= 9; j++) for (const side of [-1, 1]) {
        const t = j / 10, center = curve.getPoint(t);
        const direction = new THREE.Vector3(Math.sin(a) * .3 + Math.cos(a) * side, -.22 - t * .2, Math.cos(a) * .3 - Math.sin(a) * side).normalize();
        const span = .85 * Math.sin(Math.PI * t) + .18;
        rotation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        matrix.compose(center.addScaledVector(direction, span / 2), rotation, new THREE.Vector3(1, span, 1));
        leaflets.setMatrixAt(leafIndex++, matrix);
        leaflets.setColorAt(leafIndex - 1, new THREE.Color(frond % 3 ? 0x8ba85c : 0x697c43));
      }
    }
    part([1.8, .04, 1.8], [x, .025, z], mulch, "Palm mulch ring");
  });
  leaflets.castShadow = leaflets.receiveShadow = true; wing.add(leaflets);

  // Turquoise hydrant and small irrigation riser visible on the corner lawn.
  round(new THREE.CylinderGeometry(.12, .15, .8, 10), [23, .45, 16], green);
  round(new THREE.SphereGeometry(.16, 10, 6), [23, .9, 16], brass);
  const hydrantBar = round(new THREE.CylinderGeometry(.09, .09, .55, 8), [23, .65, 16], green); hydrantBar.rotation.z = Math.PI / 2;
  round(new THREE.CylinderGeometry(.05, .06, .45, 6), [24, .25, 20], dark);
  return wing;
}
