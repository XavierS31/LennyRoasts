import * as THREE from "three";
import { CLASSROOM, sponsorRoom, sponsorRooms, type SponsorRoomId } from "./classroomLayout.ts";
import { roomDoor } from "./roomVisits.ts";

type Point = [number, number, number];

function surface(draw: (ctx: CanvasRenderingContext2D) => void, width = 512, height = 512) {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d"); if (ctx) draw(ctx);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4; return map;
}

export function addClassroom(scene: THREE.Scene, id: SponsorRoomId) {
  const sponsor = sponsorRoom(id);
  const root = new THREE.Group(); root.name = "Shared 32-seat school classroom"; scene.add(root);
  const white = new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: .85 });
  const desktop = new THREE.MeshStandardMaterial({ color: 0xf4f1e9, roughness: .57 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8f9292, metalness: .65, roughness: .36 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x242a2b, roughness: .64 });
  const accent = new THREE.MeshStandardMaterial({ color: sponsor.color, roughness: .62 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xe8ae1b, roughness: .62 });
  const chairWhite = new THREE.MeshStandardMaterial({ color: 0xd9dbd6, roughness: .75 });

  function box(parent: THREE.Object3D, name: string, size: Point, position: Point, material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name; mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function cylinder(parent: THREE.Object3D, name: string, radius: number, height: number, position: Point, material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 12), material);
    mesh.name = name; mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function boundary(name: string, axis: "x" | "y" | "z", value: number, outward: number) {
    const group = new THREE.Group(); group.name = name; group.userData.cutaway = { axis, value, outward }; scene.add(group); return group;
  }
  function sign(parent: THREE.Object3D, text: string, size: [number, number], position: Point, color = "#253034", bg = "#f7f5ee") {
    const map = surface((ctx) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 256);
      ctx.fillStyle = color; ctx.font = '600 66px Inter, "Segoe UI", sans-serif'; ctx.textAlign = "center";
      ctx.fillText(text, 512, 156, 940);
    }, 1024, 256);
    return box(parent, text, [size[0], size[1], .025], position, new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  }

  const carpet = surface((ctx) => {
    ctx.fillStyle = "#5c5d59"; ctx.fillRect(0, 0, 512, 512);
    let seed = 102;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let n = 0; n < 7500; n++) {
      const x = random() * 512, y = random() * 512;
      ctx.strokeStyle = ["#757671", "#474943", "#979489", "#5b6058", "#80785d"][Math.floor(random() * 5)];
      ctx.lineWidth = random() * 1.4 + .4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + random() * 16, y + 3); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(24,27,25,.18)"; ctx.lineWidth = 2; ctx.strokeRect(0, 0, 512, 512);
  });
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(7, 9);
  box(root, "Patterned carpet tiles", [CLASSROOM.width, .12, CLASSROOM.depth], [0, -.06, 0], new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }));
  const front = boundary("Teaching wall", "z", -9, -1);
  const rear = boundary("Rear wall", "z", 9, 1);
  const left = boundary("Left wall", "x", -7, -1);
  const right = boundary("Window wall", "x", 7, 1);
  const roof = boundary("Acoustic tile ceiling", "y", CLASSROOM.height, 1);
  box(front, "Teaching wall plaster", [14, 4.6, .2], [0, 2.3, -9], white);
  box(rear, "Rear wall plaster", [14, 4.6, .2], [0, 2.3, 9], white);
  box(left, "Side wall plaster", [.2, 4.6, 18], [-7, 2.3, 0], white);
  // Three tall windows, with genuine openings between the wall piers.
  box(right, "Window wall lower panel", [.2, .9, 18], [7, .45, 0], white);
  box(right, "Window wall upper panel", [.2, .6, 18], [7, 4.3, 0], white);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x96b4bf, metalness: .08, roughness: .12, transmission: .2, transparent: true, opacity: .6 });
  for (const z of [-6, 0, 6]) {
    box(right, "Window pier", [.3, 3.1, 2.7], [7, 2.45, z - 2.65], white);
    box(right, "Tall blue window", [.045, 3.1, 2.5], [7.015, 2.45, z], glass);
    for (const edge of [-1, 1]) box(right, "Black window jamb", [.16, 3.2, .08], [6.91, 2.45, z + edge * 1.28], dark);
    for (const y of [.88, 4.03]) box(right, "Window head and sill", [.3, .08, 2.65], [6.9, y, z], metal);
    box(right, "Window mullion", [.08, 3.1, .045], [6.91, 2.45, z], dark);
    box(right, "Distant campus glazing", [.04, 2.6, 2.35], [7.45, 2.5, z], new THREE.MeshBasicMaterial({ color: 0x98b9c8 }));
    for (let n = 0; n < 4; n++) box(right, "Campus building window band", [.03, .13, 2.3], [7.42, 1.1 + n * .5, z], new THREE.MeshBasicMaterial({ color: 0x7593a4 }));
  }
  for (const wall of [front, rear]) box(wall, "Dark wall baseboard", [14, .17, .035], [0, .09, wall === front ? -8.87 : 8.87], dark);
  for (const wall of [left, right]) box(wall, "Dark side baseboard", [.035, .17, 18], [wall === left ? -6.87 : 6.87, .09, 0], dark);

  const tileMap = surface((ctx) => {
    ctx.fillStyle = "#dddcd2"; ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = "#c5c4bb"; for (let n = 0; n < 1400; n++) ctx.fillRect((n * 71) % 512, (n * 127) % 512, 1, 1);
  });
  tileMap.wrapS = tileMap.wrapT = THREE.RepeatWrapping; tileMap.repeat.set(7, 9);
  box(roof, "Acoustic ceiling panels", [14, .08, 18], [0, 4.64, 0], new THREE.MeshStandardMaterial({ map: tileMap, roughness: .95 }));
  for (let x = -7; x <= 7; x += 2) box(roof, "Ceiling T-grid runner", [.025, .035, 18], [x, 4.58, 0], metal);
  for (let z = -9; z <= 9; z += 2) box(roof, "Ceiling T-grid crossbar", [14, .035, .025], [0, 4.58, z], metal);
  const luminous = new THREE.MeshStandardMaterial({ color: 0xfafaff, emissive: 0xfafaff, emissiveIntensity: 1.3 });
  for (const x of [-3, 3]) for (const z of [-5, 1, 5]) {
    box(roof, "Recessed fluorescent light frame", [2, .06, .95], [x, 4.55, z], metal);
    box(roof, "Fluorescent diffuser", [1.87, .025, .82], [x, 4.508, z], luminous);
  }
  for (const z of [-3, 7]) {
    box(roof, "HVAC grille", [1.4, .04, .55], [0, 4.55, z], white);
    for (let n = 0; n < 8; n++) box(roof, "Vent slot", [1.2, .025, .016], [0, 4.52, z - .22 + n * .06], metal);
  }
  cylinder(roof, "Smoke detector", .13, .07, [5, 4.51, 3], white);
  cylinder(roof, "Projector ceiling mount", .07, .43, [0, 4.32, -1.7], metal);
  box(roof, "Ceiling projector", [.85, .3, .58], [0, 3.98, -1.7], white);
  const lens = cylinder(roof, "Projector lens", .09, .04, [.24, 3.98, -2.01], dark); lens.rotation.x = Math.PI / 2;
  for (let n = 0; n < 5; n++) box(roof, "Projector cooling slot", [.025, .15, .02], [-.28 + n * .07, 3.98, -2.005], metal);

  box(front, "Whiteboard aluminum surround", [7.3, 2.4, .09], [-.6, 2.35, -8.82], metal);
  box(front, "Whiteboard", [7.13, 2.25, .06], [-.6, 2.35, -8.75], desktop);
  box(front, "Whiteboard marker tray", [7.2, .04, .15], [-.6, 1.18, -8.69], metal);
  box(front, "Roll-down screen housing", [6.3, .15, .22], [-.6, 4.02, -8.69], dark);
  box(front, "Projection screen border", [6.15, 2.7, .025], [-.6, 2.6, -8.55], dark);
  const projection = surface((ctx) => {
    ctx.fillStyle = "#f4f5f0"; ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = sponsor.color; ctx.fillRect(0, 0, 1024, 12);
    ctx.textAlign = "center"; ctx.fillStyle = "#2b3437"; ctx.font = '600 66px Inter, "Segoe UI", sans-serif';
    ctx.fillText(sponsor.host, 512, 195, 900);
    ctx.font = '500 38px Inter, "Segoe UI", sans-serif'; ctx.fillText("Pitch your product to Lenny", 512, 294, 900);
    ctx.font = '400 24px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = "#5a686b";
    ctx.fillText("The problem. Your idea. The first demo.", 512, 364, 900);
    ctx.fillStyle = sponsor.color; ctx.fillRect(372, 445, 280, 3);
  }, 1024, 640);
  box(front, "Sponsor pitch projection", [5.98, 2.55, .025], [-.6, 2.6, -8.53], new THREE.MeshBasicMaterial({ map: projection, toneMapped: false }));

  const door = box(front, "Exit door to atrium", [1.55, 2.65, .12], [-5.45, 1.325, -8.79], new THREE.MeshStandardMaterial({ color: 0x9e8c73, roughness: .8 }));
  door.userData.action = "atrium";
  for (const x of [-6.26, -4.64]) box(front, "Door frame", [.1, 2.75, .16], [x, 1.375, -8.7], metal);
  box(front, "Door header", [1.72, .1, .16], [-5.45, 2.75, -8.7], metal);
  box(front, "Door vision panel frame", [.42, .86, .04], [-5.45, 1.87, -8.69], dark);
  box(front, "Door vision glass", [.32, .75, .03], [-5.45, 1.87, -8.66], glass);
  box(front, "Door lever", [.25, .045, .08], [-4.89, 1.02, -8.65], metal);
  sign(front, "ATRIUM", [1.45, .34], [-5.45, 3.08, -8.69], "#fff", "#253b32");
  sign(front, sponsor.name, [1.55, .38], [5.1, 3.5, -8.7], "#fff", sponsor.color);
  for (const x of [-3.6, 4.9]) box(front, "Electrical outlet", [.1, .16, .022], [x, .45, -8.7], desktop);
  const clock = cylinder(front, "Classroom clock", .24, .04, [5.1, 4.06, -8.75], dark); clock.rotation.x = Math.PI / 2;
  const clockFace = surface((ctx) => {
    ctx.fillStyle = "#f6f4eb"; ctx.fillRect(0, 0, 512, 512); ctx.strokeStyle = "#283233"; ctx.lineWidth = 8;
    for (let n = 0; n < 12; n++) { const a = n / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(256 + Math.sin(a) * 196, 256 + Math.cos(a) * 196); ctx.lineTo(256 + Math.sin(a) * 214, 256 + Math.cos(a) * 214); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(186, 148); ctx.lineTo(256, 256); ctx.lineTo(360, 256); ctx.stroke();
  });
  const face = cylinder(front, "Clock face", .217, .045, [5.1, 4.06, -8.71], new THREE.MeshStandardMaterial({ map: clockFace })); face.rotation.x = Math.PI / 2;

  const table = new THREE.Group();
  box(table, "Laminate student desk", [2.55, .065, .92], [0, .78, 0], desktop);
  box(table, "Desk underframe", [2.3, .07, .55], [0, .7, 0], dark);
  for (const x of [-1.1, 1.1]) for (const z of [-.32, .32]) {
    cylinder(table, "Desk leg", .032, .68, [x, .36, z], metal);
    const wheel = cylinder(table, "Desk caster", .052, .035, [x, .055, z], dark); wheel.rotation.z = Math.PI / 2;
  }
  function chair(material: THREE.Material) {
    const group = new THREE.Group();
    function shell(name: string, width: number, height: number, position: Point) {
      const shape = new THREE.Shape(), x = -width / 2, y = -height / 2, r = .075;
      shape.moveTo(x + r, y); shape.lineTo(x + width - r, y);
      shape.quadraticCurveTo(x + width, y, x + width, y + r); shape.lineTo(x + width, y + height - r);
      shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height); shape.lineTo(x + r, y + height);
      shape.quadraticCurveTo(x, y + height, x, y + height - r); shape.lineTo(x, y + r);
      shape.quadraticCurveTo(x, y, x + r, y);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 2, curveSegments: 6 });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...position); group.add(mesh); return mesh;
    }
    const seat = shell("Molded chair seat", .56, .53, [0, .5, 0]); seat.rotation.x = -Math.PI / 2;
    const back = shell("Curved chair back", .56, .47, [0, .79, .24]); back.rotation.x = .1;
    cylinder(group, "Chair pedestal", .04, .35, [0, .29, 0], metal);
    for (let n = 0; n < 5; n++) {
      const a = n / 5 * Math.PI * 2;
      const arm = box(group, "Five-star caster base", [.035, .03, .37], [Math.sin(a) * .16, .1, Math.cos(a) * .16], dark); arm.rotation.y = a;
      const wheel = cylinder(group, "Chair wheel", .044, .035, [Math.sin(a) * .33, .048, Math.cos(a) * .33], dark); wheel.rotation.z = Math.PI / 2;
    }
    for (const x of [-.32, .32]) {
      box(group, "Chair armrest support", [.025, .25, .035], [x, .6, .09], metal);
      box(group, "Chair armrest", [.065, .035, .3], [x, .74, 0], dark);
    }
    return group;
  }
  // Draw repeated furniture with instancing; all four rooms use this same layout.
  function repeat(model: THREE.Group, positions: Point[]) {
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const batch = new THREE.InstancedMesh(object.geometry, object.material, positions.length); batch.name = object.name;
      positions.forEach((p, n) => { const transform = new THREE.Matrix4().makeTranslation(...p).multiply(object.matrixWorld); batch.setMatrixAt(n, transform); });
      batch.castShadow = batch.receiveShadow = true; batch.computeBoundingSphere(); root.add(batch);
    });
  }
  const desks: Point[] = [], regular: Point[] = [], frontSeats: Point[] = [];
  for (let row = 0; row < 4; row++) for (const x of [-4.65, -1.55, 1.55, 4.65]) {
    const z = -2.8 + row * 2.8; desks.push([x, 0, z]);
    for (const dx of [-.68, .68]) (row === 0 ? frontSeats : regular).push([x + dx, 0, z + .92]);
  }
  repeat(table, desks); repeat(chair(chairWhite), regular); repeat(chair(yellow), frontSeats);

  box(root, "Instructor desk", [2.1, .07, .85], [-1.15, .79, -6.25], desktop);
  for (const x of [-2.05, -.25]) box(root, "Instructor desk leg", [.055, .77, .65], [x, .39, -6.25], metal);
  box(root, "Instructor laptop keyboard", [.48, .025, .32], [-1.1, .85, -6.25], dark);
  const laptop = box(root, "Instructor laptop display", [.48, .29, .025], [-1.1, 1, -6.39], dark); laptop.rotation.x = -.15;
  box(root, "Laptop screen", [.425, .245, .01], [-1.1, 1, -6.37], accent);
  box(root, "Presentation lectern base", [.62, .08, .55], [-3.1, .05, -5.4], metal);
  box(root, "Height-adjustable lectern", [.1, 1.02, .1], [-3.1, .58, -5.4], metal);
  box(root, "Lectern top", [.76, .06, .52], [-3.1, 1.13, -5.4], desktop);
  cylinder(root, "Pitch microphone stand", .018, .29, [-3.05, 1.31, -5.55], dark);
  const microphone = cylinder(root, "Pitch microphone", .04, .11, [-3.05, 1.49, -5.55], dark); microphone.rotation.x = .5;
  const pitchSpot = new THREE.Mesh(new THREE.RingGeometry(.65, .68, 48), accent); pitchSpot.rotation.x = -Math.PI / 2; pitchSpot.position.set(-3.1, .014, -4.4); root.add(pitchSpot);
  box(root, "Mobile dual-display cabinet", [1.4, .65, .5], [5.1, .33, -7.4], white);
  for (const x of [4.67, 5.53]) {
    box(root, "Presentation monitor stand", [.055, .7, .055], [x, 1, -7.45], metal);
    box(root, "Presentation monitor", [.82, .53, .055], [x, 1.53, -7.43], dark);
    box(root, "Monitor display", [.73, .43, .014], [x, 1.53, -7.392], accent);
  }
  box(rear, "Storage cabinet", [1.5, 2.2, .5], [-5.8, 1.1, 8.55], white);
  for (const x of [-6.15, -5.45]) box(rear, "Cabinet handle", [.03, .2, .04], [x, 1.1, 8.28], metal);
  for (const x of [-3, 1, 4.8]) {
    box(rear, "Rear computer workstation", [2, .07, .65], [x, .77, 8.4], desktop);
    for (const dx of [-.85, .85]) box(rear, "Workstation leg", [.05, .74, .5], [x + dx, .37, 8.4], metal);
    box(rear, "Desktop monitor base", [.32, .035, .22], [x, .83, 8.4], dark);
    box(rear, "Desktop monitor stem", [.04, .24, .035], [x, .97, 8.55], metal);
    box(rear, "Desktop monitor", [.68, .4, .04], [x, 1.2, 8.55], dark);
    box(rear, "Computer keyboard", [.42, .025, .15], [x, .83, 8.2], dark);
  }
  for (const x of [-3, 3]) {
    const light = new THREE.PointLight(0xf4f6ff, 17, 19, 2); light.position.set(x, 4.1, -1); scene.add(light);
  }
  return { targets: [door] };
}

export function addSponsorPins(scene: THREE.Scene) {
  // HTML labels are projected from these points; solid pins remain part of the hall.
  return sponsorRooms.map((room) => {
    const [x, , z] = roomDoor(room.id);
    const portal = new THREE.Group(); portal.name = `${room.name} visit doorway`;
    const material = new THREE.MeshStandardMaterial({ color: room.color, roughness: .45, transparent: true, opacity: .7 });
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(.12, 3.5, .15), material);
      jamb.position.set(side * 1.05, 1.75, 0); portal.add(jamb);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.2, .12, .15), material); lintel.position.y = 3.5; portal.add(lintel);
    portal.position.set(x, 0, z); scene.add(portal);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 14), new THREE.MeshStandardMaterial({ color: room.color, roughness: .35, emissive: room.color, emissiveIntensity: .18, depthTest: false }));
    pin.name = `${room.name} classroom pin`; pin.position.set(room.pin[0], room.pin[1], room.pin[2]); pin.userData.sponsor = room.id; pin.renderOrder = 5; scene.add(pin);
    const stem = new THREE.Mesh(new THREE.ConeGeometry(.28, 1, 16), pin.material); stem.position.set(room.pin[0], room.pin[1] - .7, room.pin[2]); stem.rotation.z = Math.PI; stem.renderOrder = 5; scene.add(stem);
    return pin;
  });
}

