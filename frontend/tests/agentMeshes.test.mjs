import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as THREE from "three";
import { agentRoster, createAgentRoster, appearanceForProject, agentStation } from "../src/components/engineering/agentRoster.ts";
import { AgentModelResources, createDefaultMale, createDefaultFemale, createAgentField } from "../src/components/engineering/agentMeshes.ts";

test("saved roster has exact requested quotas, repeatable unique appearances and stable project identities", () => {
  assert.deepEqual(createAgentRoster(), agentRoster);
  assert.equal(agentRoster.filter((agent) => agent.gender === "man").length, 150);
  assert.equal(agentRoster.filter((agent) => agent.gender === "woman").length, 50);
  assert.equal(agentRoster.filter((agent) => agent.background === "white").length, 60);
  assert.equal(agentRoster.filter((agent) => agent.background.includes("asian")).length, 79);
  assert.equal(agentRoster.filter((agent) => agent.background === "black").length, 61);
  const signatures = agentRoster.map(({ id, phase, scale, ...traits }) => JSON.stringify(traits));
  assert.equal(new Set(signatures).size, 200);
  for (let i = 1; i <= 200; i++) assert.equal(appearanceForProject(`mock-project-${String(i).padStart(3, "0")}`).id, agentRoster[i - 1].id);
  assert.equal(new Set(Array.from({ length: 200 }, (_, i) => agentStation(i).join(","))).size, 200);
  const inputs = JSON.parse(readFileSync(new URL("../src/components/engineering/agentInputs.json", import.meta.url), "utf8"));
  assert.equal(inputs.agents.length, 200);
  assert.equal(new Set(inputs.agents.map((agent) => agent.input)).size, 200);
  assert.equal(new Set(inputs.agents.map((agent) => agent.project_id)).size, 200);
  assert.ok(inputs.agents.every((agent) => Object.keys(agent).sort().join(",") === "input,name,project_id"));
});

test("male and female defaults consist entirely of volume meshes; field keeps identity when instanced", () => {
  const resources = new AgentModelResources();
  const male = createDefaultMale(resources), female = createDefaultFemale(resources);
  for (const model of [male, female]) {
    let count = 0;
    model.traverse((part) => {
      assert.ok(!(part instanceof THREE.Sprite));
      if (part instanceof THREE.Mesh) {
        count++;
        assert.equal(part.material.map, null);
        part.geometry.computeBoundingBox();
        const dimensions = part.geometry.boundingBox.getSize(new THREE.Vector3());
        assert.ok(dimensions.x > 0 && dimensions.y > 0 && dimensions.z > 0);
      }
    });
    assert.ok(count > 20);
    assert.ok(model.getObjectByName("floating-oval-body"));
    assert.equal(model.getObjectByName("feet"), undefined);
  }
  assert.ok(male.getObjectByName("floating-oval-body").scale.x > female.getObjectByName("floating-oval-body").scale.x);
  resources.dispose();
  const field = createAgentField(agentRoster.map((appearance, i) => ({ key: appearance.id, appearance, position: agentStation(i) })));
  assert.equal(field.positions.size, 200);
  assert.ok(field.targets.length <= 5, "crowd uses at most five draw calls");
  for (const mesh of field.targets) {
    assert.equal(mesh.userData.agentKeys.length, mesh.count);
    assert.equal(mesh.geometry.getAttribute("agentPhase").count, mesh.count);
    const shader = { uniforms: {}, vertexShader: "#include <project_vertex>" };
    mesh.material.onBeforeCompile(shader, undefined);
    field.animate(10, false);
    assert.equal(shader.uniforms.agentTime.value, 10);
    assert.equal(shader.uniforms.agentAmplitude.value, .12);
    field.animate(11, true);
    assert.equal(shader.uniforms.agentAmplitude.value, 0);
    mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
  }
});

test("portable GLB exports contain two bases and 200 animated mesh agents with no textures", () => {
  for (const [filename, count] of [["default-male.glb", 1], ["default-female.glb", 1], ["agents-200.glb", 200]]) {
    const binary = readFileSync(new URL(`../public/assets/agents/${filename}`, import.meta.url));
    assert.equal(binary.toString("utf8", 0, 4), "glTF");
    assert.equal(binary.readUInt32LE(4), 2);
    assert.equal(binary.readUInt32LE(8), binary.length);
    const jsonLength = binary.readUInt32LE(12);
    const gltf = JSON.parse(binary.toString("utf8", 20, 20 + jsonLength));
    assert.equal(gltf.scenes[0].nodes.length, count);
    assert.equal(gltf.animations[0].channels.length, count);
    assert.ok(gltf.meshes.length > 0);
    assert.equal(gltf.images, undefined);
    assert.equal(gltf.textures, undefined);
  }
});
