import * as THREE from "three";
import { BALLROOM } from "./ballroomLayout.ts";
import { AgentModelResources, createAgentModel, createAgentField, poseAgentSeated, type AgentEntry } from "./agentMeshes.ts";

export const CEREMONY_SECONDS = 18;
export const ballroomCapacity = BALLROOM.rows * BALLROOM.seatsPerBlock * 2;
export function ballroomSeat(index: number): [number, number] {
  const row = Math.floor(index / (BALLROOM.seatsPerBlock * 2));
  const side = index % (BALLROOM.seatsPerBlock * 2) < BALLROOM.seatsPerBlock ? -1 : 1;
  const column = index % BALLROOM.seatsPerBlock;
  return [side * (3.4 + column * 2.16), -18.4 + row * 3.37];
}

// Leave the chair row, follow the central aisle and use the right stage steps.
export function winnerRoute(seat: [number, number]): THREE.Vector3[] {
  const [x, z] = seat;
  return [[x, 1.42, z], [x, 1.42, z - 1.05], [x, .08, z - 1.6], [0, .08, z - 1.6], [0, .08, -22.2],
    [11, .08, -22.2], [11, .08, -23.3], [11, .42, -24], [11, .8, -24.7],
    [11, 1.26, -25.6], [3, 1.26, -27.2]].map(([px, py, pz]) => new THREE.Vector3(px, py, pz));
}

export function routePosition(route: THREE.Vector3[], progress: number) {
  const lengths = route.slice(1).map((point, index) => point.distanceTo(route[index]));
  let distance = THREE.MathUtils.clamp(progress, 0, 1) * lengths.reduce((a, b) => a + b, 0);
  for (let index = 0; index < lengths.length; index++) {
    if (distance <= lengths[index]) return { position: route[index].clone().lerp(route[index + 1], distance / lengths[index]), direction: route[index + 1].clone().sub(route[index]) };
    distance -= lengths[index];
  }
  return { position: route.at(-1)!.clone(), direction: new THREE.Vector3(0, 0, 1) };
}

export function createAwardsAudience(entries: AgentEntry[], winnerKey: string) {
  const seated = entries.slice(0, ballroomCapacity).map((entry, index) => ({ ...entry, position: ballroomSeat(index), elevation: 1.42, rotation: Math.PI, seated: true }));
  const winnerEntry = seated.find((entry) => entry.key === winnerKey);
  const audience = createAgentField(seated.filter((entry) => entry.key !== winnerKey), false);
  audience.animate(0, true);
  audience.group.name = "Seated AI submission audience";
  if (!winnerEntry) return { group: audience.group, animate() {}, start: () => Promise.resolve(), resume: () => Promise.resolve(), pause() {}, winner: undefined, award: undefined };

  const resources = new AgentModelResources();
  const winner = new THREE.Group(); winner.name = "Prize walk agent"; winner.userData.project = winnerKey;
  const sitting = createAgentModel(winnerEntry.appearance, resources); poseAgentSeated(sitting);
  const moving = createAgentModel(winnerEntry.appearance, resources); moving.visible = false;
  winner.add(sitting, moving); audience.group.add(winner);
  const route = winnerRoute(winnerEntry.position);
  const exitRoute = [[3, 1.26, -27.2], [-11, 1.26, -25.6], [-11, .8, -24.7], [-11, .42, -24], [-11, .08, -23.3], [-11, .08, -22.2]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  winner.position.copy(route[0]); winner.rotation.y = Math.PI;
  const award = new THREE.Group(); award.name = "Collected agent prize"; award.visible = false;
  award.position.set(.72, 1.12, .22); moving.add(award);
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b94c, metalness: .85, roughness: .22 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.2, .23, .1, 16), resources.material("#25303a"));
  award.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.055, .075, .28, 12), gold); stem.position.y = .17; award.add(stem);
  const cup = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(.07, .28), new THREE.Vector2(.16, .36), new THREE.Vector2(.25, .6), new THREE.Vector2(.22, .6), new THREE.Vector2(.12, .36)], 16), gold); award.add(cup);
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.12, .025, 6, 16), gold); handle.position.set(side * .23, .46, 0); award.add(handle);
  }
  moving.traverse((object) => { if (object instanceof THREE.Mesh) { object.castShadow = object.receiveShadow = true; } });
  // All resources remain in the group and are released by the scene disposer.
  let elapsed = 0, playing = false, resolve: (() => void) | undefined;
  return {
    group: audience.group, winner, award,
    start(reducedMotion: boolean) {
      resolve?.(); elapsed = reducedMotion ? CEREMONY_SECONDS : 0; playing = true;
      winner.visible = true;
      award.visible = false; sitting.visible = false; moving.visible = true;
      return new Promise<void>((done) => { resolve = done; });
    },
    pause() { playing = false; },
    resume() { resolve?.(); playing = true; return new Promise<void>((done) => { resolve = done; }); },
    animate(delta: number, reducedMotion: boolean) {
      if (!playing) return;
      elapsed = reducedMotion ? CEREMONY_SECONDS : Math.min(CEREMONY_SECONDS + 8, elapsed + delta);
      const progress = Math.min(1, elapsed / CEREMONY_SECONDS);
      const leaving = elapsed > CEREMONY_SECONDS + 3;
      const step = leaving ? routePosition(exitRoute, (elapsed - CEREMONY_SECONDS - 3) / 5) : routePosition(route, progress);
      winner.position.copy(step.position);
      winner.rotation.y = Math.atan2(step.direction.x, step.direction.z);
      if (!reducedMotion && (progress < 1 || leaving)) winner.position.y += Math.sin(elapsed * 8) * .075;
      if (progress >= 1) {
        if (!leaving) winner.rotation.y = 0;
        award.visible = true;
        if (reducedMotion || elapsed >= CEREMONY_SECONDS + 8) {
          winner.visible = reducedMotion; playing = false; resolve?.(); resolve = undefined;
        }
      }
    },
    dispose() { resolve?.(); resolve = undefined; },
  };
}
