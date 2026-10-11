import { writeFileSync, mkdirSync } from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { AgentModelResources, createAgentModel, createDefaultMale, createDefaultFemale } from "../src/components/engineering/agentMeshes.ts";
import { agentRoster, agentStation } from "../src/components/engineering/agentRoster.ts";

// GLTFExporter uses the browser FileReader API even when no textures exist.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((value) => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((value) => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`; this.onloadend?.(); }); }
};
const resources = new AgentModelResources();
const directory = new URL("../public/assets/agents/", import.meta.url);
mkdirSync(directory, { recursive: true });
const exporter = new GLTFExporter();
function floatClip(models) {
  const times = [0, 1, 2, 3, 4];
  const tracks = models.map((model) => {
    const { x, y, z } = model.position;
    const values = times.flatMap((time) => [x, y + Math.sin(time / 4 * Math.PI * 2) * .12, z]);
    return new THREE.VectorKeyframeTrack(`${model.name}.position`, times, values, THREE.InterpolateSmooth);
  });
  return new THREE.AnimationClip("Gentle float", 4, tracks);
}
for (const [name, create] of [["default-male", createDefaultMale], ["default-female", createDefaultFemale]]) {
  const model = create(resources);
  const scene = new THREE.Scene(); scene.add(model);
  const binary = await exporter.parseAsync(scene, { binary: true, animations: [floatClip([model])] });
  writeFileSync(new URL(`${name}.glb`, directory), Buffer.from(binary));
}
const field = new THREE.Scene();
const models = agentRoster.map((appearance, index) => {
  const model = createAgentModel(appearance, resources);
  const [x, z] = agentStation(index); model.position.set(x, .6, z); field.add(model);
  return model;
});
const binary = await exporter.parseAsync(field, { binary: true, animations: [floatClip(models)] });
writeFileSync(new URL("agents-200.glb", directory), Buffer.from(binary));
resources.dispose();
console.log(`Exported two mesh bases and ${models.length} animated agent models; no images or textures.`);
