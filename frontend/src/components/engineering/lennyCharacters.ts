import * as THREE from "three";
import { lennyPresenter, lennySponsors, sponsorLennyHeight, type LennySponsor } from "./lennyLayout.ts";

type Point = [number, number, number];
const up = new THREE.Vector3(0, 1, 0);

// A tapered sweep gives horns and the tail real volume along a curved spine.
function taperedCurve(points: Point[], radius: number, segments = 36) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const frames = curve.computeFrenetFrames(segments, false);
  const positions: number[] = [], indices: number[] = [];
  const sides = 12;
  for (let ring = 0; ring <= segments; ring++) {
    const t = ring / segments;
    const center = curve.getPointAt(t);
    const r = radius * Math.pow(1 - t, .8) + .003;
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      const point = center.clone()
        .addScaledVector(frames.normals[ring], Math.cos(angle) * r)
        .addScaledVector(frames.binormals[ring], Math.sin(angle) * r);
      positions.push(point.x, point.y, point.z);
      if (ring < segments && side < sides) {
        const a = ring * (sides + 1) + side, b = a + sides + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// A curved patch follows the front of the shirt ellipsoid. Only its print is a
// texture; the character, clothing, limbs and silhouette are solid geometry.
function shirtPrint(width: number, height: number) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const cols = 20, rows = 10;
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const x = (col / cols - .5) * width;
    const y = 2.28 + (row / rows - .5) * height;
    const z = .77 * Math.sqrt(Math.max(0, 1 - (x / 1.065) ** 2 - ((y - 1.8) / 1.45) ** 2));
    positions.push(x, y, z + .012); uvs.push(col / cols, row / rows);
    if (row < rows && col < cols) {
      const a = row * (cols + 1) + col, b = a + cols + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

const logoPrints: Record<LennySponsor, { crop: [number, number, number, number]; width: number; height: number }> = {
  // UV windows retain the supplied logo pixels, omitting surrounding white padding.
  mlh: { crop: [.1, .32, .8, .36], width: 1.48, height: .67 },
  bny: { crop: [0, .295, 1, .41], width: 1.65, height: .38 },
  elevenlabs: { crop: [.23, .35, .56, .29], width: 1.42, height: .74 },
  databricks: { crop: [.215, .39, .57, .22], width: 1.64, height: .32 },
};

export function addLennyCharacters(scene: THREE.Scene, kind: "atrium" | "awards") {
  const hosts = new THREE.Group(); hosts.name = "Solid 3D Lenny hosts";
  scene.add(hosts);
  let disposed = false;
  const loader = new THREE.TextureLoader();
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const cone = new THREE.ConeGeometry(1, 1, 16);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 24);
  const skin = new THREE.MeshStandardMaterial({ color: 0x4fa64b, roughness: .65 });
  const scales = new THREE.MeshStandardMaterial({ color: 0x378443, roughness: .7 });
  const darkGreen = new THREE.MeshStandardMaterial({ color: 0x235e34, roughness: .65 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xffebad, roughness: .48 });
  const hornRidge = new THREE.MeshStandardMaterial({ color: 0xcaba82, roughness: .65 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xffe3a0, roughness: .7 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xfff5da, roughness: .3 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x5b301c, roughness: .22 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x101b15, roughness: .18, clearcoat: 1 });
  const glint = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .18 });
  const mouth = new THREE.MeshStandardMaterial({ color: 0x42272b, roughness: .7 });
  const tongue = new THREE.MeshStandardMaterial({ color: 0xde9291, roughness: .65 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88 });
  const seam = new THREE.MeshStandardMaterial({ color: 0xe2e2d5, roughness: .92 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xeab845, metalness: .8, roughness: .25 });

  function part(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, name: string, position: Point, scale: Point = [1, 1, 1]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function round(parent: THREE.Group, material: THREE.Material, name: string, position: Point, scale: Point) {
    return part(parent, sphere, material, name, position, scale);
  }
  function bone(parent: THREE.Group, material: THREE.Material, name: string, start: Point, end: Point, radius: number) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const mesh = part(parent, cylinder, material, name, a.clone().add(b).multiplyScalar(.5).toArray() as Point, [radius, a.distanceTo(b), radius]);
    mesh.quaternion.setFromUnitVectors(up, b.sub(a).normalize()); return mesh;
  }
  function line(parent: THREE.Group, material: THREE.Material, name: string, points: Point[], radius: number) {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return part(parent, new THREE.TubeGeometry(curve, 20, radius, 8, false), material, name, [0, 0, 0]);
  }
  function spike(parent: THREE.Group, name: string, position: Point, direction: Point, radius: number, length: number, material = darkGreen) {
    const mesh = part(parent, cone, material, name, position, [radius, length, radius * .7]);
    mesh.quaternion.setFromUnitVectors(up, new THREE.Vector3(...direction).normalize()); return mesh;
  }

  function build(sponsor?: LennySponsor) {
    const model = new THREE.Group();
    model.name = sponsor ? `Lenny wearing a ${sponsor} shirt` : "Lenny presenting a trophy";
    model.userData.lenny = sponsor ?? "awards";
    round(model, skin, "Pear-shaped torso", [0, 1.8, 0], [1, 1.4, .72]);
    round(model, skin, "Neck", [0, 3, 0], [.62, .64, .56]);
    round(model, skin, "Dragon head", [0, 3.78, .08], [1.13, 1, .88]);
    round(model, skin, "Broad muzzle", [0, 3.45, .82], [.79, .5, .58]);
    round(model, scales, "Lower lip", [0, 3.18, .97], [.55, .13, .34]);
    round(model, mouth, "Smile opening", [0, 3.27, 1.24], [.47, .13, .07]);
    round(model, tongue, "Tongue", [0, 3.23, 1.306], [.23, .054, .025]);
    for (const side of [-1, 1]) {
      round(model, darkGreen, "Nostril", [side * .28, 3.61, 1.354], [.068, .044, .027]);
      spike(model, "Little fang", [side * .32, 3.3, 1.3], [0, -1, .1], .042, .12, ivory);
      const eye = new THREE.Group(); eye.position.set(side * .51, 4.02, .76); eye.rotation.y = side * .22; model.add(eye);
      round(eye, darkGreen, "Eye rim", [0, 0, 0], [.337, .418, .17]);
      round(eye, eyeWhite, "Eye", [0, .01, .065], [.294, .366, .16]);
      round(eye, iris, "Iris", [-side * .025, -.005, .2], [.191, .25, .063]);
      round(eye, black, "Pupil", [-side * .025, 0, .252], [.13, .195, .037]);
      round(eye, glint, "Eye highlight", [-.065, .104, .283], [.049, .059, .018]);
      round(eye, glint, "Eye highlight small", [.059, -.09, .281], [.022, .026, .014]);
      line(model, darkGreen, "Expressive eyebrow", [[side * .25, 4.49, .73], [side * .51, 4.57, .77], [side * .8, 4.46, .66]], .055);
      for (let n = 0; n < 3; n++) {
        round(model, scales, "Cheek scale", [side * (.76 + n * .086), 3.63 - n * .07, .73 - n * .11], [.13, .105, .045]);
      }
      const ear = round(model, skin, "Pointed ear", [side * 1.08, 3.89, -.02], [.48, .19, .22]);
      ear.rotation.z = side * .3;
      spike(model, "Ear tip", [side * 1.48, 4.02, -.02], [side, .36, 0], .17, .5, skin);
      const earInset = round(model, scales, "Ear inner ridge", [side * 1.17, 3.94, .14], [.32, .074, .027]); earInset.rotation.z = side * .3;

      const hornPoints: Point[] = [[side * .78, 4.37, .05], [side * .94, 4.7, .02], [side * .95, 5.03, -.01], [side * .79, 5.39, .03]];
      part(model, taperedCurve(hornPoints, .23), ivory, "Curved side horn", [0, 0, 0]);
      for (let ring = 0; ring < 3; ring++) {
        const t = .16 + ring * .2;
        const curve = new THREE.CatmullRomCurve3(hornPoints.map((point) => new THREE.Vector3(...point)));
        const mesh = part(model, new THREE.TorusGeometry(.23 * Math.pow(1 - t, .8) + .004, .011, 6, 24), hornRidge, "Horn growth ring", curve.getPointAt(t).toArray() as Point);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(t));
      }
      round(model, skin, "Thigh", [side * .58, .6, .03], [.43, .6, .48]);
      round(model, skin, "Foot", [side * .62, .23, .32], [.45, .25, .64]);
      for (let toe = 0; toe < 3; toe++) {
        const x = side * .62 + (toe - 1) * .225;
        round(model, skin, "Toe", [x, .18, .78], [.145, .17, .23]);
        spike(model, "Toe claw", [x, .16, 1.01], [0, -.16, 1], .081, .22, ivory);
      }
      const hand: Point = [side * 1.23, sponsor ? 1.72 : side < 0 ? 2.12 : 2.33, .49];
      const elbow: Point = [side * 1.21, 2.28, .11];
      const shoulder: Point = [side * .79, 2.69, -.01];
      bone(model, skin, "Upper arm", shoulder, elbow, .255);
      round(model, skin, "Elbow", elbow, [.29, .29, .29]);
      bone(model, skin, "Forearm", elbow, hand, .24);
      round(model, skin, "Palm", hand, [.29, .32, .26]);
      for (let finger = 0; finger < 3; finger++) {
        round(model, skin, "Finger", [hand[0] + (finger - 1) * .16, hand[1] - .13, hand[2] + .16], [.095, .17, .115]);
      }
      round(model, skin, "Thumb", [hand[0] - side * .26, hand[1] + .04, hand[2] + .04], [.15, .18, .14]);
      if (sponsor) {
        bone(model, cloth, "Shirt sleeve", shoulder, [side * 1.04, 2.45, .06], .315);
        round(model, cloth, "Rounded sleeve shoulder", shoulder, [.34, .33, .31]);
        bone(model, seam, "Sleeve cuff", [side * 1.015, 2.475, .054], [side * 1.062, 2.431, .068], .321);
      }
      // Bat wings have extruded green edges and an inset ivory membrane.
      const wing = new THREE.Group(); wing.position.set(side * .64, 2.55, -.56); wing.rotation.y = side * -.17; model.add(wing);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.quadraticCurveTo(side * .13, .73, side * .92, 1.02);
      shape.quadraticCurveTo(side * 1.11, .77, side * 1.49, -.51);
      shape.quadraticCurveTo(side * 1.03, -.09, side * .9, -.5);
      shape.quadraticCurveTo(side * .58, -.1, side * .39, -.55); shape.closePath();
      part(wing, new THREE.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, curveSegments: 16 }), darkGreen, "Wing contour", [0, 0, 0]);
      const membrane = part(wing, new THREE.ExtrudeGeometry(shape, { depth: .19, bevelEnabled: false, curveSegments: 16 }), ivory, "Wing membrane", [side * .05, .01, -.04], [.91, .91, 1]);
      membrane.castShadow = true;
      for (const tip of [[.92, 1.02], [1.49, -.51], [.9, -.5], [.39, -.55]]) {
        line(wing, skin, "Wing finger bone", [[0, 0, .15], [side * .36, .42, .15], [side * tip[0], tip[1], .15]], .038);
      }
    }
    part(model, taperedCurve([[0, 4.59, .69], [0, 4.85, .76], [0, 5.17, .68]], .22, 24), ivory, "Forehead horn", [0, 0, 0]);
    for (let plate = 0; plate < (sponsor ? 2 : 5); plate++) {
      const y = sponsor ? .75 + plate * .31 : .9 + plate * .36;
      const width = .62 + Math.sin(plate / 4 * Math.PI) * .15;
      round(model, belly, "Overlapping belly plate", [0, y, .57 + Math.sin(plate / 4 * Math.PI) * .1], [width, .255, .17]);
    }
    const tailPoints: Point[] = [[0, 1.04, -.52], [-.42, .63, -1.2], [-1.25, .38, -1.65], [-1.96, .5, -1.25], [-2.27, .92, -.8], [-2.13, 1.3, -.58]];
    part(model, taperedCurve(tailPoints, .43, 48), skin, "Curled dragon tail", [0, 0, 0]);
    for (let n = 0; n < 5; n++) {
      const y = 1.4 + n * .52;
      spike(model, "Dorsal spine", [0, y, n > 2 ? -.71 : -.76], [0, .4, -1], .22 - n * .016, .42);
    }
    const tailCurve = new THREE.CatmullRomCurve3(tailPoints.map((point) => new THREE.Vector3(...point)));
    for (let n = 0; n < 6; n++) {
      const t = .18 + n * .12, p = tailCurve.getPointAt(t);
      p.y += .43 * Math.pow(1 - t, .8);
      spike(model, "Tail crest", p.toArray() as Point, [0, 1, 0], .15 * (1 - t) + .035, .29 * (1 - t) + .1);
    }
    if (sponsor) {
      part(model, new THREE.SphereGeometry(1, 40, 28, 0, Math.PI * 2, .38, 1.6), cloth, "Solid shirt torso", [0, 1.8, 0], [1.065, 1.45, .77]);
      const collar = part(model, new THREE.TorusGeometry(.43, .067, 10, 32), seam, "Shirt collar", [0, 3.03, .06], [1.1, .83, 1]); collar.rotation.x = Math.PI / 2;
      const hem = part(model, new THREE.TorusGeometry(.977, .028, 8, 40), seam, "Shirt hem", [0, 1.223, 0], [1, .72, 1]); hem.rotation.x = Math.PI / 2;
      const print = logoPrints[sponsor];
      const map = loader.load(`/assets/lenny/logos/${sponsor}.png`, (texture) => { if (disposed) texture.dispose(); });
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      const [x, y, w, h] = print.crop;
      map.repeat.set(w, h); map.offset.set(x, 1 - y - h);
      part(model, shirtPrint(print.width, print.height), new THREE.MeshStandardMaterial({ map, roughness: .88 }), `${sponsor} shirt print`, [0, 0, 0]);
    } else {
      const trophy = new THREE.Group(); trophy.name = "Gold award trophy"; trophy.position.set(1.24, 2.54, .56); model.add(trophy);
      part(trophy, cylinder, darkGreen, "Trophy base", [0, 0, 0], [.27, .12, .22]);
      part(trophy, cylinder, gold, "Trophy stem", [0, .2, 0], [.075, .33, .075]);
      const profile = [[.065, .32], [.16, .36], [.26, .46], [.33, .68], [.35, .83], [.32, .83], [.29, .66], [.22, .47], [.06, .37]].map(([r, y]) => new THREE.Vector2(r, y));
      part(trophy, new THREE.LatheGeometry(profile, 32), gold, "Hollow trophy cup", [0, 0, 0]);
      for (const side of [-1, 1]) {
        part(trophy, new THREE.TorusGeometry(.2, .037, 8, 24), gold, "Trophy handle", [side * .34, .61, 0], [.8, 1, 1]);
      }
    }
    return model;
  }

  // Share the same geometry/materials across all four sponsor models.
  const prototype = build(kind === "awards" ? undefined : "mlh");
  function place(model: THREE.Group, position: readonly number[], height: number) {
    const bounds = new THREE.Box3().setFromObject(model);
    const root = new THREE.Group(); root.name = model.name;
    model.position.y = -bounds.min.y; root.add(model);
    root.scale.setScalar(height / (bounds.max.y - bounds.min.y));
    root.position.set(position[0], position[1], position[2]); hosts.add(root);
  }
  if (kind === "awards") place(prototype, lennyPresenter.position, lennyPresenter.height);
  else {
    place(prototype, [lennySponsors[0].position[0], .03, lennySponsors[0].position[1]], sponsorLennyHeight);
    // Reuse the complete solid model; only the curved print material differs.
    for (const sponsor of lennySponsors.slice(1)) {
      const model = prototype.clone(true); model.position.y = 0;
      model.name = `Lenny wearing a ${sponsor.name} shirt`; model.userData.lenny = sponsor.id;
      const oldPrint = model.getObjectByName("mlh shirt print");
      if (oldPrint) model.remove(oldPrint);
      const print = logoPrints[sponsor.id];
      const map = loader.load(`/assets/lenny/logos/${sponsor.id}.png`, (texture) => { if (disposed) texture.dispose(); });
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      const [x, y, w, h] = print.crop; map.repeat.set(w, h); map.offset.set(x, 1 - y - h);
      part(model, shirtPrint(print.width, print.height), new THREE.MeshStandardMaterial({ map, roughness: .88 }), `${sponsor.id} shirt print`, [0, 0, 0]);
      place(model, [sponsor.position[0], .03, sponsor.position[1]], sponsorLennyHeight);
    }
  }
  // The scene traversal disposes shared geometries, materials and logo textures.
  return { dispose() { disposed = true; } };
}
