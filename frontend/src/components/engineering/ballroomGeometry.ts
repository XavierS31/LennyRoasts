import * as THREE from "three";
import { BALLROOM } from "./ballroomLayout";

type V3 = [number, number, number];
type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; parent: THREE.Object3D; matrices: THREE.Matrix4[] };

function fabric(base: string, repeat: [number, number], patterned = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 25000; i++) {
      ctx.fillStyle = i % 3 ? "rgba(255,245,222,.07)" : "rgba(18,14,9,.12)";
      ctx.fillRect((i * 97) % 512, (i * 193 + Math.floor(i / 512) * 31) % 512, 1, 2);
    }
    if (patterned) {
      ctx.strokeStyle = "rgba(10,9,8,.24)"; ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) {
        const x = (i * 83) % 512, y = (i * 127) % 512;
        ctx.beginPath(); ctx.ellipse(x, y, 27 + i % 4 * 9, 60, i * .31, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat); texture.anisotropy = 4;
  return texture;
}

function arch(width: number, height: number, depth: number) {
  const r = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-r, 0); shape.lineTo(r, 0); shape.lineTo(r, height - r);
  shape.absarc(0, height - r, r, 0, Math.PI, false); shape.lineTo(-r, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2, steps: 1, curveSegments: 12 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function lettering(text: string, foreground: string, background: string) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = foreground; ctx.font = "bold 66px Arial, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(text, 256, 88, 470);
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map, toneMapped: false });
}

export function addDetailedBallroom(scene: THREE.Scene) {
  const batches: Batch[] = [];
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const transform = new THREE.Object3D();
  const batch = (geometry: THREE.BufferGeometry, material: THREE.Material, position: V3, scale: V3, rotation: V3 = [0, 0, 0], parent: THREE.Object3D = scene) => {
    let entry = batches.find((item) => item.geometry === geometry && item.material === material && item.parent === parent);
    if (!entry) { entry = { geometry, material, parent, matrices: [] }; batches.push(entry); }
    transform.position.set(...position); transform.rotation.set(...rotation); transform.scale.set(...scale); transform.updateMatrix();
    entry.matrices.push(transform.matrix.clone());
  };
  const cube = (size: V3, position: V3, material: THREE.Material, parent: THREE.Object3D = scene) => batch(unitBox, material, position, size, [0, 0, 0], parent);
  const pipe = (a: V3, b: V3, radius: number, material: THREE.Material, parent: THREE.Object3D = scene) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    transform.position.copy(start.add(end).multiplyScalar(.5));
    transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    transform.scale.set(radius, direction.length(), radius); transform.updateMatrix();
    let entry = batches.find((item) => item.geometry === cylinder && item.material === material && item.parent === parent);
    if (!entry) { entry = { geometry: cylinder, material, parent, matrices: [] }; batches.push(entry); }
    entry.matrices.push(transform.matrix.clone());
  };
  const mat = (color: number, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const cream = mat(0xeee4cf), tan = mat(0xcbb38b), trim = mat(0xf3efe5), tile = mat(0xd8d5c9);
  const black = mat(0x151515, .65), frame = mat(0x37342d, .43, .65), steel = mat(0xb4b3ac, .3, .7);
  const oak = mat(0xbc8847), gold = mat(0xdbb65c, .27, .75);
  const carpet = new THREE.MeshStandardMaterial({ map: fabric("#c5a35d", [15, 21]), roughness: 1 });
  const charcoal = new THREE.MeshStandardMaterial({ map: fabric("#45423b", [10, 17], true), roughness: 1 });
  const acoustic = new THREE.MeshStandardMaterial({ map: fabric("#aaa9a3", [3, 2]), roughness: 1 });
  const upholstery = new THREE.MeshStandardMaterial({ map: fabric("#655744", [2, 3]), roughness: .95 });
  const whiteLamp = new THREE.MeshStandardMaterial({ color: 0xfff7df, emissive: 0xffedd0, emissiveIntensity: 2.2, toneMapped: false });

  const boundary = (axis: "x" | "y" | "z", value: number, outward: number) => {
    const group = new THREE.Group(); group.userData.cutaway = { axis, value, outward }; scene.add(group); return group;
  };
  const front = boundary("z", -34, -1), rear = boundary("z", 34, 1);
  const left = boundary("x", -24, -1), right = boundary("x", 24, 1);
  const ceiling = boundary("y", 18.2, 1);

  // One flat floor: the dark woven center aisle and cross bands match photo 2.
  cube([48, .24, 68], [0, -.12, 0], carpet);
  cube([5, .025, 68], [0, .016, 0], charcoal);
  for (const x of [-22.6, 22.6]) cube([2.8, .028, 68], [x, .018, 0], charcoal);
  for (const z of [-24, 26]) cube([48, .03, 1.5], [0, .024, z], charcoal);

  // Cream upper walls, ochre lower walls, white dado and baseboards.
  for (const [group, x] of [[left, -24], [right, 24]] as const) {
    cube([.35, 19, 68], [x, 9.5, 0], cream, group);
    cube([.4, 4.1, 68], [x, 2.05, 0], tan, group);
    cube([.46, .13, 68], [x, 4.12, 0], trim, group);
    cube([.48, .3, 68], [x, .16, 0], trim, group);
    cube([1.05, .8, 68], [x, 9.1, 0], cream, group);
    for (let i = 0; i < 7; i++) {
      const z = -27 + i * 9;
      cube([.17, 3.1, 6.7], [x + (x < 0 ? .28 : -.28), 12.7, z], acoustic, group);
      cube([.16, 2.8, 6.9], [x + (x < 0 ? .3 : -.3), 6.8, z], acoustic, group);
      cube([.17, 2.5, 1.2], [x + (x < 0 ? .28 : -.28), 12.7, z + 4], acoustic, group);
    }
    // Tall folds/recesses where the movable dividers park at the side walls.
    for (const z of [-11.5, 11.5]) {
      cube([.7, 18, .55], [x + (x < 0 ? .4 : -.4), 9, z], tan, group);
      for (const offset of [-.13, .13]) cube([.1, 18, .06], [x + (x < 0 ? .79 : -.79), 9, z + offset], frame, group);
    }
  }
  for (const [group, z] of [[front, -34], [rear, 34]] as const) {
    cube([48, 19, .35], [0, 9.5, z], cream, group);
    cube([48, 4.1, .4], [0, 2.05, z], tan, group);
    cube([48, .13, .46], [0, 4.12, z], trim, group);
    cube([48, .3, .48], [0, .16, z], trim, group);
    const inset = z < 0 ? .27 : -.27;
    for (const x of [-17, -8, 8, 17]) {
      cube([6.7, 3.1, .15], [x, 12.7, z + inset], acoustic, group);
      cube([6.7, 2.6, .15], [x, 7.2, z + inset], acoustic, group);
    }
    cube([2.4, 9, .65], [0, 4.5, z + inset], cream, group);
  }

  // The pair of double doors flanking the screen stays visible and accessible.
  const exitMaterial = lettering("EXIT", "#effff0", "#087645");
  function doors(x: number, z: number, group: THREE.Object3D) {
    const facing = z < 0 ? 1 : -1;
    cube([5.4, 5.4, .24], [x, 2.7, z], black, group);
    for (const offset of [-1.28, 1.28]) {
      cube([2.47, 5.13, .25], [x + offset, 2.65, z + facing * .15], oak, group);
      cube([2.22, .095, .13], [x + offset, 2.15, z + facing * .34], steel, group);
      cube([.09, .6, .14], [x + offset + (offset < 0 ? .9 : -.9), 2.48, z + facing * .36], steel, group);
      cube([.52, .17, .15], [x + offset, 5.08, z + facing * .33], steel, group);
      for (const y of [.65, 4.5]) cube([.07, .3, .13], [x + offset + (offset < 0 ? -1.16 : 1.16), y, z + facing * .29], steel, group);
    }
    cube([1.2, .44, .2], [x, 5.9, z], trim, group);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .27), exitMaterial);
    label.position.set(x, 5.9, z + facing * .12); if (facing < 0) label.rotation.y = Math.PI; group.add(label);
  }
  for (const x of [-17, 17]) { doors(x, -33.65, front); doors(x, 33.65, rear); }

  // Details from the clean room photo: planters, wooden cabinets, wall plates
  // and red fire alarm housings. The exit doors are kept clear.
  const planter = mat(0x4b4235), green = mat(0x345733), leafEdge = mat(0x526b36);
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(-.25, 1.7, 0, 3.4); leaf.quadraticCurveTo(.28, 1.8, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leaf, 10);
  green.side = leafEdge.side = THREE.DoubleSide;
  for (const x of [-21.2, 21.2]) {
    batch(new THREE.CylinderGeometry(.85, .68, 1.22, 24), planter, [x, .61, -31.4], [1, 1, 1]);
    batch(cylinder, mat(0x29251c), [x, 1.23, -31.4], [.78, .025, .78]);
    for (let i = 0; i < 17; i++) {
      const angle = i * 2.399, radius = .17 + (i % 4) * .12;
      batch(leafGeometry, i % 3 ? green : leafEdge, [x + Math.cos(angle) * radius, 1.2, -31.4 + Math.sin(angle) * radius], [1, .6 + i % 5 * .13, 1], [Math.sin(angle) * .18, angle, Math.cos(angle) * .15]);
    }
  }
  const red = mat(0xa9382b);
  for (const [group, x] of [[left, -24], [right, 24]] as const) {
    const inset = x < 0 ? 1 : -1;
    for (const z of [-29.5, 28]) {
      cube([1.3, 2.4, 2.8], [x + inset, 1.2, z], oak, group);
      cube([1.36, .09, 2.84], [x + inset, 2.45, z], frame, group);
      cube([.04, 1.9, .025], [x + inset * 1.69, 1.3, z], frame, group);
      cube([.19, .5, .36], [x + inset * .35, 5.3, z], red, group);
      cube([.21, .1, .23], [x + inset * .36, 5.4, z], trim, group);
    }
    for (const z of [-22, -3, 22]) cube([.06, .27, .2], [x + inset * .25, 1.1, z], trim, group);
  }

  // Six ceiling trays extend the close empty-room photo into the longer hall
  // visible in the audience photo. Recessed services are geometry, not decals.
  cube([48, .22, 68], [0, 19.1, 0], tile, ceiling);
  for (const x of [-23, 0, 23]) cube([x === 0 ? 3.8 : 2, 1.65, 68], [x, 18.2, 0], cream, ceiling);
  for (const z of [-33, -11.5, 11.5, 33]) cube([48, 1.65, z === -33 || z === 33 ? 2 : 2.6], [0, 18.2, z], cream, ceiling);
  for (const x of [-11.6, 11.6]) for (const z of [-22.5, 0, 22.5]) {
    for (const edge of [-8.65, 8.65]) cube([.6, .55, 18.6], [x + edge, 18.55, z], trim, ceiling);
    for (const edge of [-9.1, 9.1]) cube([17.8, .55, .6], [x, 18.55, z + edge], trim, ceiling);
    for (let col = 0; col < 8; col++) cube([.028, .035, 18], [x - 7.9 + col * 2.25, 18.96, z], steel, ceiling);
    for (let row = 0; row < 9; row++) cube([17.8, .035, .027], [x, 18.95, z - 8.9 + row * 2.23], steel, ceiling);
    for (const dz of [-6, -2, 2, 6]) {
      cube([10.1, .22, .75], [x, 18.68, z + dz], trim, ceiling);
      cube([9.7, .045, .51], [x, 18.54, z + dz], whiteLamp, ceiling);
      for (const dx of [-5.6, 5.6]) {
        cube([1.25, .05, 1.03], [x + dx, 18.85, z + dz + 1.2], trim, ceiling);
        for (let slat = 0; slat < 6; slat++) cube([1.06, .035, .055], [x + dx, 18.81, z + dz + .82 + slat * .145], frame, ceiling);
      }
    }
  }
  // Paired dark ceiling tracks precisely describe the operable room dividers.
  for (const x of [-.18, .18]) cube([.085, .1, 68], [x, 17.33, 0], frame, ceiling);
  for (const z of [-11.68, -11.32, 11.32, 11.68]) cube([48, .1, .075], [0, 17.33, z], frame, ceiling);
  const downlight = new THREE.CylinderGeometry(.23, .23, .08, 20);
  for (const x of [-21.3, -1.25, 1.25, 21.3]) for (let z = -29; z <= 29; z += 8.3) {
    batch(downlight, steel, [x, 17.36, z], [1.2, 1, 1.2], [0, 0, 0], ceiling);
    batch(downlight, whiteLamp, [x, 17.3, z], [1, 1, 1], [0, 0, 0], ceiling);
  }

  // Ceiling-mounted projector: bracket, body, vent strips and forward lens.
  pipe([0, 17.2, 7], [0, 15.9, 7], .08, steel, ceiling);
  cube([1.55, .6, 1.32], [0, 15.65, 7], trim, ceiling);
  for (let i = 0; i < 6; i++) cube([.65, .035, .04], [-.25, 15.96, 6.58 + i * .12], frame, ceiling);
  batch(cylinder, black, [.45, 15.65, 6.29], [.23, .14, .23], [Math.PI / 2, 0, 0], ceiling);

  // Portable award stage under the projection screen, with cloth skirting,
  // stair treads, a lectern, microphone and three unlabeled display trophies.
  cube([25, 1.15, 7.5], [0, .575, -29.5], black);
  cube([25.1, .12, 7.6], [0, 1.2, -29.5], charcoal);
  for (let i = 0; i < 88; i++) cube([.12, 1.08, .09], [-12.35 + i * .282, .57, -25.69], frame);
  for (const x of [-11, 11]) for (let step = 0; step < 3; step++) {
    const height = (step + 1) * .38;
    cube([2.4, height, .75], [x, height / 2, -23.92 - step * .73], black);
    cube([2.4, .035, .07], [x, height + .015, -23.55 - step * .73], steel);
  }
  function curtain(x: number, width: number, material: THREE.Material) {
    const geo = new THREE.PlaneGeometry(width, 6.1, Math.ceil(width * 12), 1);
    const vertices = geo.attributes.position;
    for (let i = 0; i < vertices.count; i++) vertices.setZ(i, Math.sin(vertices.getX(i) * 11) * .15);
    geo.computeVertexNormals();
    const cloth = new THREE.Mesh(geo, material); cloth.position.set(x, 4.35, -33.1); cloth.castShadow = true; cloth.receiveShadow = true; scene.add(cloth);
  }
  const velvet = new THREE.MeshStandardMaterial({ color: 0x262124, roughness: 1, side: THREE.DoubleSide });
  const goldCloth = new THREE.MeshStandardMaterial({ color: 0x8e7853, roughness: 1, side: THREE.DoubleSide });
  curtain(0, 13, velvet); curtain(-10, 6.4, goldCloth); curtain(10, 6.4, goldCloth);
  pipe([-13.3, 7.5, -33.1], [13.3, 7.5, -33.1], .075, black);
  for (const x of [-12.8, 12.8]) pipe([x, 1.3, -33.1], [x, 7.5, -33.1], .06, black);
  for (const x of [-11.6, 11.6]) {
    const wash = new THREE.SpotLight(0xffd495, 70, 15, Math.PI / 5, .65, 1);
    wash.position.set(x, 1.5, -31.7); wash.target.position.set(x, 6, -33.05); scene.add(wash, wash.target);
    cube([.4, .3, .4], [x, 1.38, -31.7], black);
  }
  cube([2.1, 2.75, 1.4], [-7.8, 2.65, -29.8], oak);
  cube([2.4, .16, 1.75], [-7.8, 4.09, -29.8], frame);
  pipe([-7.4, 4.2, -29.95], [-7.4, 4.8, -30], .035, frame);
  pipe([-7.4, 4.8, -30], [-7.1, 4.9, -29.75], .045, black);
  cube([5.7, .18, 1.9], [5.6, 2.85, -29.8], black);
  for (const x of [3.15, 8.05]) pipe([x, 1.3, -29.8], [x, 2.8, -29.8], .07, frame);
  for (let i = 0; i < 3; i++) {
    const x = 3.7 + i * 1.85, h = i === 1 ? 1.5 : 1.12;
    cube([.72, .18, .65], [x, 3.03, -29.8], black);
    batch(cylinder, gold, [x, 3.26, -29.8], [.11, .36, .11]);
    const cup = new THREE.CylinderGeometry(.4, .13, h * .5, 24, 1, true);
    batch(cup, gold, [x, 3.44 + h * .25, -29.8], [1, 1, 1]);
    for (const side of [-1, 1]) {
      const handle = new THREE.TorusGeometry(.24, .035, 6, 16, Math.PI * 1.65);
      batch(handle, gold, [x + side * .33, 3.65 + h * .2, -29.8], [1, 1, 1], [0, 0, side < 0 ? Math.PI * .17 : Math.PI * 1.17]);
    }
  }
  for (const x of [-13.7, 13.7]) {
    cube([1.2, 2.2, 1.05], [x, 2.45, -29.3], black);
    pipe([x, .08, -29.3], [x, 1.5, -29.3], .08, frame);
    for (let i = 0; i < 11; i++) cube([.93, .025, .025], [x, 1.55 + i * .17, -28.76], frame);
  }

  // Use the supplied artwork unchanged; letterbox its 3:1 ratio on the screen.
  cube([20, .36, .45], [0, 16.7, -32.55], black);
  cube([19.9, 9.9, .12], [0, 11.72, -32.45], black);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(19.6, 9.55), new THREE.MeshBasicMaterial({ color: 0x281327, toneMapped: false }));
  screen.position.set(0, 11.74, -32.36); scene.add(screen);
  const logoMap = new THREE.TextureLoader().load("/assets/ballroom/lenny-roasts-projection.png");
  logoMap.colorSpace = THREE.SRGBColorSpace; logoMap.anisotropy = 4;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(18.9, 6.3), new THREE.MeshBasicMaterial({ map: logoMap, toneMapped: false }));
  logo.position.set(0, 11.74, -32.34); scene.add(logo);
  cube([20, .08, .16], [0, 6.82, -32.35], steel);

  // Banquet chairs have arched upholstered backs, seats, rails and four angled
  // tubular legs. Instances keep all 208 empty chairs inexpensive to render.
  const cushion = arch(1.62, 1.5, .16), backFrame = arch(1.78, 1.64, .2);
  for (let row = 0; row < BALLROOM.rows; row++) for (const side of [-1, 1]) for (let col = 0; col < BALLROOM.seatsPerBlock; col++) {
    const x = side * (3.4 + col * 2.16), z = -18.4 + row * 3.37;
    batch(backFrame, frame, [x, 1.43, z + .65], [1, 1, 1]);
    batch(cushion, upholstery, [x, 1.5, z + .665], [1, 1, 1]);
    cube([1.75, .2, 1.58], [x, 1.32, z], upholstery);
    cube([1.75, .1, 1.6], [x, 1.16, z], frame);
    for (const dx of [-.72, .72]) for (const dz of [-.58, .58]) {
      pipe([x + dx * 1.12, .07, z + dz * 1.18], [x + dx, 1.17, z + dz], .043, frame);
      batch(cylinder, black, [x + dx * 1.12, .06, z + dz * 1.18], [.06, .07, .06]);
    }
    for (const dx of [-.77, .77]) pipe([x + dx, 1.13, z + .62], [x + dx, 2.1, z + .68], .04, frame);
    pipe([x - .73, .5, z + .61], [x + .73, .5, z + .61], .035, frame);
  }

  for (const entry of batches) {
    const mesh = new THREE.InstancedMesh(entry.geometry, entry.material, entry.matrices.length);
    entry.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = !(entry.parent === ceiling); mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); entry.parent.add(mesh);
  }
  scene.userData.ballroom = { emptyChairs: BALLROOM.rows * BALLROOM.seatsPerBlock * 2, floor: "flat", people: 0 };
}
