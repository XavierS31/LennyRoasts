import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Locally generated surface detail, inferred from the four exterior references.
// No photographs, remote textures or new network requests are needed.
function canvasMap(draw: (ctx: CanvasRenderingContext2D, size: number) => void, color = false) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx, 512);
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  if (color) map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function stoneSurface(ctx: CanvasRenderingContext2D, size: number, relief: boolean) {
  const pixels = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const grain = (hash % 17) - 8;
      const cloud = Math.sin(x / 27) * Math.cos(y / 39) * 2;
      const index = (y * size + x) * 4;
      const bases = relief ? [177, 177, 177] : [211, 196, 167];
      for (let c = 0; c < 3; c++) pixels.data[index + c] = bases[c] + grain * (relief ? 2 : .45) + cloud;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  // Fine horizontal stone courses, subtle staggered joints, not brick-sized grout.
  ctx.strokeStyle = relief ? "#737373" : "rgba(130,112,84,.23)";
  ctx.lineWidth = relief ? 2 : 1;
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(size, y + .5); ctx.stroke();
    for (let x = row % 2 ? 128 : 0; x < size; x += 256) {
      ctx.beginPath(); ctx.moveTo(x + .5, y); ctx.lineTo(x + .5, y + 64); ctx.stroke();
    }
  }
}

export function createExteriorMaterials() {
  const stoneMap = canvasMap((ctx, size) => stoneSurface(ctx, size, false), true);
  const stoneBump = canvasMap((ctx, size) => stoneSurface(ctx, size, true));
  const stone = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: stoneMap, bumpMap: stoneBump, bumpScale: .025,
    roughness: .88, metalness: 0, flatShading: true,
  });
  const glassMap = canvasMap((ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, "#81939a");
    gradient.addColorStop(.35, "#425965");
    gradient.addColorStop(.7, "#253e49");
    gradient.addColorStop(1, "#162c34");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size);
    // Soft sky reflections stay inside each pane; the frames are actual geometry.
    for (let i = 0; i < 14; i++) {
      const x = (i * 137) % size, y = (i * 47) % 210;
      const reflection = ctx.createRadialGradient(x, y, 0, x, y, 95);
      reflection.addColorStop(0, "rgba(223,232,232,.16)");
      reflection.addColorStop(1, "rgba(223,232,232,0)");
      ctx.fillStyle = reflection; ctx.fillRect(0, 0, size, size);
    }
    ctx.fillStyle = "rgba(210,224,224,.08)"; ctx.fillRect(40, 0, 23, size);
  }, true);
  const glassRoughness = canvasMap((ctx, size) => {
    ctx.fillStyle = "#b8b8b8"; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = i % 3 ? "#ababab" : "#cccccc";
      ctx.fillRect((i * 137) % size, (i * 73) % size, 1, 2);
    }
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: glassMap, roughnessMap: glassRoughness,
    metalness: .18, roughness: .26, clearcoat: .7, clearcoatRoughness: .16,
  });
  const frame = new THREE.MeshStandardMaterial({ color: 0xe1e3dc, roughness: .38, metalness: .35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8ddda, roughness: .55, metalness: .3, flatShading: true });
  const recess = new THREE.MeshStandardMaterial({ color: 0x544e40, roughness: .95 });
  return { stone, glass, frame, metal, recess };
}

export type ExteriorMaterials = ReturnType<typeof createExteriorMaterials>;

// Keep stone courses at the same physical scale on long walls and tower facets.
export function stoneUVs(geometry: THREE.BufferGeometry, tileSize = 4) {
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  const values = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
    values[i * 2] = (nx > nz ? z : x) / tileSize;
    values[i * 2 + 1] = (ny > .8 ? z : y) / tileSize;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(values, 2));
  return geometry;
}

export function framedWindow(parent: THREE.Object3D, width: number, height: number, materials: ExteriorMaterials, divisions = 2) {
  const group = new THREE.Group();
  parent.add(group);
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.exteriorWindowDetail = true;
    group.add(mesh); return mesh;
  };
  part(width + .18, height + .18, .08, 0, 0, -.025, materials.recess);
  part(width - .12, height - .12, .06, 0, 0, .025, materials.glass);
  for (const x of [-width / 2, width / 2, 0]) part(.075, height, .11, x, 0, .075, materials.frame);
  for (let row = 0; row <= divisions; row++) {
    part(width + .075, .07, .11, 0, -height / 2 + row * height / divisions, .075, materials.frame);
  }
  part(width + .26, .11, .28, 0, -height / 2 - .09, .065, materials.frame);
  return group;
}

// A continuous glazed elevation: substantial perimeter metal, slender interior
// mullions and broad floor spandrels. All members retain real projection depth.
export function curtainGrid(parent: THREE.Object3D, width: number, height: number, materials: ExteriorMaterials, columns: number, rows: number, perimeter = .32, depth = .42) {
  const group = new THREE.Group();
  group.name = "Continuous framed curtain wall"; parent.add(group);
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    if (material === materials.glass) {
      // Share reflection coordinates across the entire elevation.
      const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
      for (let i = 0; i < positions.count; i++) uv.setXY(i,
        (positions.getX(i) + x) / width + .5, (positions.getY(i) + y) / height + .5);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.exteriorWindowDetail = true; group.add(mesh);
  };
  part(width, height, .08, 0, 0, -.08, materials.recess);
  const cellWidth = width / columns, cellHeight = height / rows;
  for (let col = 0; col < columns; col++) for (let row = 0; row < rows; row++) {
    part(cellWidth - .1, cellHeight - .1, .06,
      -width / 2 + (col + .5) * cellWidth, -height / 2 + (row + .5) * cellHeight, .01, materials.glass);
  }
  for (let col = 1; col < columns; col++) part(.095, height, .18, -width / 2 + col * cellWidth, 0, .1, materials.frame);
  for (let row = 1; row < rows; row++) part(width, .075, .18, 0, -height / 2 + row * cellHeight, .1, materials.frame);
  for (const x of [-width / 2, width / 2]) part(perimeter, height + perimeter, depth, x, 0, depth / 2 - .04, materials.metal);
  for (const y of [-height / 2, height / 2]) part(width + perimeter, perimeter, depth, 0, y, depth / 2 - .04, materials.metal);
  return group;
}

// Hundreds of exterior panes/frames share three materials. Bake their transforms
// once, so architectural detail does not add thousands of draw calls per frame.
export function batchExteriorWindows(scene: THREE.Scene) {
  scene.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const sources: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.userData.exteriorWindowDetail || Array.isArray(object.material)) return;
    const entries = batches.get(object.material) ?? [];
    entries.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
    batches.set(object.material, entries); sources.push(object);
  });
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = "Batched exterior window detail";
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
  }
  sources.forEach((mesh) => { mesh.removeFromParent(); mesh.geometry.dispose(); });
}
