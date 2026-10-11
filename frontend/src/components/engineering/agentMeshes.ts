import * as THREE from "three";
import type { AgentAppearance } from "./agentRoster.ts";

/** Shared geometry for both base models and all 200 variants. No raster assets. */
export class AgentModelResources {
  sphere = new THREE.SphereGeometry(1, 12, 8);
  box = new THREE.BoxGeometry(1, 1, 1);
  cap = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * .55);
  ring = new THREE.TorusGeometry(1, .095, 4, 12);
  cone = new THREE.ConeGeometry(1, 1, 5);
  materials = new Map<string, THREE.MeshStandardMaterial>();
  material(color: string) {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .05 });
      this.materials.set(color, material);
    }
    return material;
  }
  dispose() {
    [this.sphere, this.box, this.cap, this.ring, this.cone].forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
  }
}

export function createAgentModel(appearance: AgentAppearance, resources: AgentModelResources): THREE.Group {
  const root = new THREE.Group();
  root.name = appearance.id;
  root.userData = { appearance, representation: "3D mesh", fictional: true };
  const female = appearance.gender === "woman";
  const part = (name: string, geometry: THREE.BufferGeometry, color: string, position: number[], scale: number[]) => {
    const mesh = new THREE.Mesh(geometry, resources.material(color));
    mesh.name = name;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    root.add(mesh);
    return mesh;
  };
  // Two anatomical bases: broad shoulder oval and narrower waist oval.
  part("floating-oval-body", resources.sphere, appearance.shirt, [0, .75, 0], [female ? .49 : .57, .7, .36]);
  part("collar", resources.ring, appearance.accent, [0, 1.27, 0], [.23, .23, .18]).rotation.x = Math.PI / 2;
  part("neck", resources.sphere, appearance.skin, [0, 1.38, 0], [.19, .22, .18]);
  part("head", resources.sphere, appearance.skin, [0, 1.94, 0], [female ? .43 : .46, .51, .4]);
  for (const side of [-1, 1]) {
    part("ear", resources.sphere, appearance.skin, [side * .43, 1.91, 0], [.1, .14, .09]);
    const hand = part("mitten-hand", resources.sphere, appearance.skin, [side * .72, .72, .13], [.18, .23, .17]);
    hand.rotation.z = side * -.2;
    part("sleeve", resources.sphere, appearance.shirt, [side * .49, 1.06, 0], [.19, .26, .24]).rotation.z = side * .55;
    part("eye-white", resources.sphere, "#f7efe2", [side * .18, 1.97, .35], [.115, .077, .046]);
    part("pupil", resources.sphere, "#201a20", [side * .175, 1.96, .395], [.042, .048, .025]);
    const brow = part("fierce-brow", resources.box, appearance.hair, [side * .18, 2.09, .387], [.23, .07, .055]);
    brow.rotation.z = side * .28;
    if (appearance.glasses) {
      part("glasses-frame", resources.ring, "#24252d", [side * .19, 1.99, .415], [.148, .113, .08]);
      part("glasses-arm", resources.box, "#24252d", [side * .4, 1.99, .2], [.025, .035, .4]);
    }
  }
  part("nose", resources.sphere, appearance.skin, [0, 1.88, .4], [.065, .07, .07]);
  part("confident-smirk", resources.box, "#633d32", [.025, 1.73, .363], [.18, .025, .025]).rotation.z = .12;
  if (appearance.glasses) part("glasses-bridge", resources.box, "#24252d", [0, 1.99, .425], [.1, .025, .025]);
  part("hair-cap", resources.cap, appearance.hair, [0, 2.1, -.015], [.48, .4, .43]);
  if (appearance.hairstyle === "crop" || appearance.hairstyle === "quiff") {
    for (let i = 0; i < 3; i++) {
      const tuft = part("angular-hair", resources.cone, appearance.hair, [-.22 + i * .19, 2.46, -.03], [.17, appearance.hairstyle === "quiff" ? .32 : .13, .21]);
      tuft.rotation.z = -.25;
    }
  } else if (appearance.hairstyle === "curls") {
    for (let i = 0; i < 7; i++) {
      const angle = i / 7 * Math.PI;
      part("hair-curl", resources.sphere, appearance.hair, [Math.cos(angle) * .37, 2.22 + Math.sin(angle) * .26, .03], [.18, .17, .22]);
    }
  } else {
    const length = appearance.hairstyle === "long" ? .62 : .37;
    for (const side of [-1, 1]) part("hair-side", resources.sphere, appearance.hair, [side * .39, 1.97 - length * .2, -.15], [.17, length, .33]);
    if (appearance.hairstyle === "bun") part("hair-bun", resources.sphere, appearance.hair, [0, 2.48, -.28], [.28, .27, .26]);
  }
  if (appearance.clothing === "hoodie") {
    for (const side of [-1, 1]) part("hoodie-drawstring", resources.box, appearance.accent, [side * .12, 1.08, .31], [.025, .24, .025]);
    part("hood", resources.sphere, appearance.shirt, [0, 1.32, -.16], [.38, .24, .3]);
  } else if (appearance.clothing === "jacket") {
    part("jacket-insert", resources.box, appearance.accent, [0, .96, .3], [.23, .5, .08]);
    for (const side of [-1, 1]) part("jacket-lapel", resources.box, appearance.shirt, [side * .19, 1.13, .33], [.13, .33, .1]).rotation.z = side * -.18;
  }
  part("shoulder-badge", resources.box, appearance.accent, [-.29, 1.08, .3], [.095, .12, .065]).rotation.z = -.2;
  root.scale.setScalar(appearance.scale);
  return root;
}

const defaultAppearance: AgentAppearance = {
  id: "default-male", gender: "man", background: "white", skin: "#d7a782", hair: "#433029",
  shirt: "#214b8d", accent: "#ffe6a3", hairstyle: "quiff", glasses: false, clothing: "hoodie", scale: 1, phase: 0,
};
export function createDefaultMale(resources: AgentModelResources) { return createAgentModel(defaultAppearance, resources); }
export function createDefaultFemale(resources: AgentModelResources) {
  return createAgentModel({ ...defaultAppearance, id: "default-female", gender: "woman", hairstyle: "bob", shirt: "#593967", clothing: "jacket" }, resources);
}

export type AgentEntry = { key: string; appearance: AgentAppearance; position: [number, number]; };

/** Bake complete mesh models into a handful of shared draw calls. */
export function createAgentField(entries: AgentEntry[]) {
  const resources = new AgentModelResources();
  const group = new THREE.Group();
  group.name = "floating-ai-agent-meshes";
  const buckets = new Map<THREE.BufferGeometry, { matrix: THREE.Matrix4; color: THREE.Color; key: string; phase: number }[]>();
  const positions = new Map<string, THREE.Vector3>();
  const time = { value: 0 }, amplitude = { value: .12 };
  entries.forEach((entry, i) => {
    const model = createAgentModel(entry.appearance, resources);
    const [x, z] = entry.position;
    model.position.set(x, .6, z);
    model.rotation.y = (i % 5 - 2) * .16;
    positions.set(entry.key, new THREE.Vector3(x, 2, z));
    model.updateMatrixWorld(true);
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const parts = buckets.get(object.geometry) ?? [];
      parts.push({ matrix: object.matrixWorld.clone(), color: (object.material as THREE.MeshStandardMaterial).color.clone(), key: entry.key, phase: entry.appearance.phase });
      buckets.set(object.geometry, parts);
    });
  });
  const targets: THREE.InstancedMesh[] = [];
  buckets.forEach((parts, source) => {
    const geometry = source.clone();
    geometry.setAttribute("agentPhase", new THREE.InstancedBufferAttribute(new Float32Array(parts.map((part) => part.phase)), 1));
    const material = new THREE.MeshStandardMaterial({ roughness: .62, metalness: .05 });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.agentTime = time;
      shader.uniforms.agentAmplitude = amplitude;
      shader.vertexShader = "attribute float agentPhase; uniform float agentTime; uniform float agentAmplitude;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", THREE.ShaderChunk.project_vertex.replace(
        "mvPosition = modelViewMatrix * mvPosition;",
        "mvPosition.y += sin(agentTime * 1.55 + agentPhase) * agentAmplitude;\nmvPosition = modelViewMatrix * mvPosition;",
      ));
    };
    material.customProgramCacheKey = () => "floating-agent-v1";
    const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
    mesh.name = "agent-mesh-parts";
    mesh.userData.agentKeys = parts.map((part) => part.key);
    parts.forEach((part, i) => { mesh.setMatrixAt(i, part.matrix); mesh.setColorAt(i, part.color); });
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += .2;
    mesh.receiveShadow = true;
    group.add(mesh); targets.push(mesh);
  });
  resources.dispose();
  return {
    group, targets, positions,
    animate(seconds: number, reducedMotion: boolean) { time.value = seconds; amplitude.value = reducedMotion ? 0 : .12; },
    select(key: string) {
      let bucketIndex = 0;
      buckets.forEach((parts) => {
        const mesh = targets[bucketIndex++];
        parts.forEach((part, i) => mesh.setColorAt(i, part.key === key ? part.color.clone().lerp(new THREE.Color("#ffd46a"), .22) : part.color));
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
    },
  };
}
