import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { ChallengeResult } from "../../api/client";
import { addAtrium, addAuditorium, addExterior } from "./geometry";
import { atriumViews, projectStation } from "./atriumLayout";

export type SceneKind = "campus" | "atrium" | "awards";
export type CameraCommand = "in" | "out" | "reset" | "iso" | "top" | "front" | "enter" | "floor" | "stairs" | "ceiling" | "entrance" | "focus";
export type SceneController = { command: (action: CameraCommand, building?: string) => Promise<void> };

function disposeObjects(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    }
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function scoreLabel(name: string, score: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "rgba(14, 20, 28, .66)";
  context.fillRect(0, 0, 512, 128);
  context.strokeStyle = "rgba(255,255,255,.4)";
  context.strokeRect(1, 1, 510, 126);
  context.fillStyle = "#ffffff";
  context.font = "28px Bagnard, Georgia, serif";
  context.textAlign = "center";
  // Plain text only: user/model strings never become markup or executable code.
  const shortName = Array.from(name).slice(0, 24).join("");
  context.fillText(shortName, 256, 48, 480);
  context.fillStyle = "#ffe18b";
  context.font = "36px Bagnard, Georgia, serif";
  context.fillText(`${score.toFixed(1)} / 10`, 256, 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  label.scale.set(11, 2.75, 1);
  return label;
}

export default function EngineeringScene({
  kind, result, projectName, selectedMarker, onSelectBuilding, onHoverBuilding,
  onSelectMarker, controller,
}: {
  kind: SceneKind;
  result?: ChallengeResult;
  projectName: string;
  selectedMarker: string;
  onSelectBuilding: (building: string) => void;
  onHoverBuilding: (building: string) => void;
  onSelectMarker: (marker: string) => void;
  controller: React.RefObject<SceneController | null>;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const callbacks = useRef({ onSelectBuilding, onHoverBuilding, onSelectMarker });
  const updateData = useRef<((result?: ChallengeResult, name?: string, selected?: string) => void) | null>(null);
  useEffect(() => { callbacks.current = { onSelectBuilding, onHoverBuilding, onSelectMarker }; });

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError("The 3D view is unavailable on this device. Your form and API report still work.");
      return;
    }
    setError(undefined);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(kind === "campus" ? 0xabc5d8 : kind === "atrium" ? 0xc9dce0 : 0x08080a);
    scene.fog = new THREE.Fog(scene.background, 110, 190);
    const camera = new THREE.PerspectiveCamera(kind === "atrium" ? 64 : 42, 1, 0.1, 400);
    const start = kind === "campus" ? new THREE.Vector3(68, 45, 72)
      : kind === "atrium" ? new THREE.Vector3(...atriumViews.overview.position) : new THREE.Vector3(0, 24, 54);
    const startTarget = kind === "atrium" ? new THREE.Vector3(...atriumViews.overview.target) : new THREE.Vector3(0, 6, kind === "campus" ? 0 : -7);
    camera.position.copy(start);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = kind === "atrium" ? 1.05 : 1.15;
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(startTarget);
    controls.minDistance = kind === "atrium" ? 3 : 18;
    controls.maxDistance = kind === "atrium" ? 100 : 125;
    controls.maxPolarAngle = kind === "atrium" ? Math.PI * .72 : Math.PI / 2.05;
    controls.screenSpacePanning = true;
    scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x202018, kind === "atrium" ? 1.7 : 2.4));
    const sun = new THREE.DirectionalLight(0xfff1d2, kind === "atrium" ? 2.4 : 4);
    sun.position.set(34, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    if (kind === "atrium") {
      sun.position.set(-18, 45, -28);
      Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: .5, far: 130 });
      sun.shadow.bias = -.0003;
      sun.shadow.camera.updateProjectionMatrix();
    }
    scene.add(sun);
    const clickable = kind === "campus" ? addExterior(scene) : [];
    if (kind === "atrium") addAtrium(scene);
    if (kind === "awards") addAuditorium(scene);
    let environment: THREE.WebGLRenderTarget | undefined;
    if (kind === "atrium") {
      const room = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(room, .04);
      scene.environment = environment.texture;
      scene.environmentIntensity = .45;
      disposeObjects(room); pmrem.dispose();
    }
    const cutaways = scene.children.filter((object) => object.userData.cutaway);
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    const markerTargets: THREE.Object3D[] = [];
    const markerPositions = new Map<string, THREE.Vector3>();

    updateData.current = (nextResult, name = "Your idea", selected = "user") => {
      disposeObjects(markerGroup);
      markerGroup.clear();
      markerTargets.length = 0;
      markerPositions.clear();
      scene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh && object.userData.fieldPopulation) {
          // Anonymous visual representatives only; identities are not supplied by the API.
          object.count = Math.min(200, nextResult?.placement?.eligible_competitors ?? 0);
          object.computeBoundingSphere();
        }
      });
      if (!nextResult) return;
      const entries = [
        { key: "user", name, score: nextResult.score_10, eligible: nextResult.eligible },
        ...nextResult.rivals.map((rival) => ({ key: rival.project_id, name: rival.name, score: rival.score_10, eligible: true })),
      ];
      entries.forEach((entry, index) => {
        const [x, z] = projectStation(index);
        markerPositions.set(entry.key, new THREE.Vector3(x, 2, z));
        const height = .8 + entry.score * .15;
        const marker = new THREE.Mesh(new THREE.CylinderGeometry(.32, .4, height, 16), new THREE.MeshStandardMaterial({
          color: !entry.eligible ? 0xb5bed0 : entry.key === "user" ? 0xffc904 : 0x87c4df,
          emissive: entry.key === selected ? 0x5e4010 : 0x000000,
          roughness: 0.3, metalness: 0.3,
        }));
        marker.position.set(x + 3, height / 2, z);
        marker.userData.marker = entry.key;
        markerGroup.add(marker);
        markerTargets.push(marker);
        const label = scoreLabel(entry.name, entry.score);
        if (label) {
          label.position.set(x, 4.5, z);
          label.scale.set(7.5, 1.875, 1);
          label.userData.marker = entry.key;
          markerGroup.add(label);
          markerTargets.push(label);
        }
        // A selectable project placard on the table, with a halo for selection.
        const placard = new THREE.Mesh(new THREE.BoxGeometry(1.1, .07, .7), new THREE.MeshStandardMaterial({ color: entry.key === "user" ? 0xffc904 : 0x87c4df, emissive: entry.key === selected ? 0x665017 : 0x000000 }));
        placard.position.set(x, 1.7, z + .65); placard.userData.marker = entry.key;
        markerGroup.add(placard); markerTargets.push(placard);
        if (entry.key === selected) {
          const halo = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.55, 48), new THREE.MeshBasicMaterial({ color: 0xffd56c, side: THREE.DoubleSide, transparent: true, opacity: .85 }));
          halo.rotation.x = -Math.PI / 2; halo.position.set(x, .06, z); markerGroup.add(halo);
        }
      });
    };

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let destination: THREE.Vector3 | null = null;
    let targetDestination: THREE.Vector3 | null = null;
    let finish: (() => void) | null = null;
    const travel = (position: THREE.Vector3, target: THREE.Vector3) => {
      finish?.();
      if (motion.matches) {
        camera.position.copy(position);
        controls.target.copy(target);
        destination = targetDestination = null;
        finish = null;
        return Promise.resolve();
      }
      destination = position;
      targetDestination = target;
      return new Promise<void>((resolve) => { finish = resolve; });
    };
    controller.current = { command: (action, building) => {
      if (kind === "atrium") {
        if (action === "focus") {
          const point = markerPositions.get(building ?? "user");
          if (point) return travel(point.clone().add(new THREE.Vector3(6, 5, 9)), point.clone().setY(2.5));
          return Promise.resolve();
        }
        const key = action === "front" ? "entrance" : action === "iso" || action === "reset" ? "overview" : action;
        if (key in atriumViews) {
          const view = atriumViews[key as keyof typeof atriumViews];
          return travel(new THREE.Vector3(...view.position), new THREE.Vector3(...view.target));
        }
      }
      if (action === "in" || action === "out") {
        finish?.(); finish = null; destination = targetDestination = null;
        const offset = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(offset.length() * (action === "in" ? 0.82 : 1.18), controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(offset.setLength(distance));
        return Promise.resolve();
      }
      if (action === "enter") {
        const x = building === "Engineering I" ? 7 : -36;
        // Arrival must stay outside OrbitControls' minimum distance.
        return travel(new THREE.Vector3(x, 5, 36), new THREE.Vector3(x, 3, 16));
      }
      if (action === "top") return travel(new THREE.Vector3(0, 112, 0.1), new THREE.Vector3(0, 0, 0));
      if (action === "front") return travel(kind === "campus" ? new THREE.Vector3(4, 19, 88) : new THREE.Vector3(0, 16, 58), new THREE.Vector3(2, 8, -5));
      if (action === "iso") return travel(start.clone(), startTarget.clone());
      return travel(start.clone(), startTarget.clone());
    } };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    let hovered: THREE.Mesh | null = null;
    const originalEmissive = new THREE.Color();
    const hitAt = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects([...markerTargets, ...clickable], false)[0]?.object;
    };
    const press = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
    const click = (event: PointerEvent) => {
      const origin = down; down = null;
      if (!origin || Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 5) return;
      const hit = hitAt(event);
      if (!hit) return;
      if (hit.userData.marker) {
        callbacks.current.onSelectMarker(hit.userData.marker);
        void controller.current?.command("focus", hit.userData.marker);
        return;
      }
      callbacks.current.onSelectBuilding(hit.userData.building || hit.name);
      // The Make source used mesh-local coordinates, which misfocused grouped wings.
      const center = new THREE.Box3().setFromObject(hit).getCenter(new THREE.Vector3()).setY(7);
      void travel(center.clone().add(new THREE.Vector3(28, 20, 32)), center);
    };
    const clearHover = () => {
      if (hovered) (hovered.material as THREE.MeshStandardMaterial).emissive.copy(originalEmissive);
      hovered = null;
      callbacks.current.onHoverBuilding("");
      renderer.domElement.style.cursor = "grab";
    };
    const move = (event: PointerEvent) => {
      const hit = hitAt(event);
      const next = hit instanceof THREE.Mesh && !hit.userData.marker ? hit : null;
      if (next !== hovered) {
        clearHover();
        if (next) {
          // Isolate the highlight from the original shared facade materials.
          if (!next.userData.highlightMaterial) {
            next.material = (next.material as THREE.MeshStandardMaterial).clone();
            next.userData.highlightMaterial = true;
          }
          hovered = next;
          originalEmissive.copy((next.material as THREE.MeshStandardMaterial).emissive);
          (next.material as THREE.MeshStandardMaterial).emissive.set(0x302400);
          callbacks.current.onHoverBuilding(next.userData.building || next.name);
        }
      }
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
    };
    const cancelPress = () => { down = null; };
    const leave = () => { cancelPress(); clearHover(); };
    renderer.domElement.addEventListener("pointerdown", press);
    renderer.domElement.addEventListener("pointerup", click);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerleave", leave);
    renderer.domElement.addEventListener("pointercancel", cancelPress);
    const stopTravel = () => { finish?.(); finish = null; destination = targetDestination = null; };
    controls.addEventListener("start", stopTravel);
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    let disposed = false;
    const animate = () => {
      if (disposed) return;
      if (document.hidden) { frame = 0; return; }
      if (destination && targetDestination) {
        camera.position.lerp(destination, motion.matches ? 1 : 0.065);
        controls.target.lerp(targetDestination, motion.matches ? 1 : 0.065);
        if (camera.position.distanceTo(destination) < 0.08) {
          destination = targetDestination = null;
          finish?.(); finish = null;
        }
      }
      controls.update();
      // Outside views peel away only the facing boundary, leaving the hall readable.
      for (const object of cutaways) {
        const { axis, value, outward } = object.userData.cutaway as { axis: "x" | "y" | "z"; value: number; outward: number };
        object.visible = (camera.position[axis] - value) * outward < .3;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    const visibility = () => { if (!document.hidden && !frame) animate(); };
    document.addEventListener("visibilitychange", visibility);
    animate();
    return () => {
      disposed = true;
      finish?.();
      controller.current = null;
      updateData.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("pointerdown", press);
      renderer.domElement.removeEventListener("pointerup", click);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerleave", leave);
      renderer.domElement.removeEventListener("pointercancel", cancelPress);
      controls.removeEventListener("start", stopTravel);
      controls.dispose();
      sun.shadow.dispose();
      environment?.dispose();
      disposeObjects(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [kind, controller]);

  useEffect(() => {
    updateData.current?.(result, projectName, selectedMarker);
    let cancelled = false;
    // Canvas textures need redrawing if the local font finishes loading later.
    void document.fonts.load("28px Bagnard").then(() => {
      if (!cancelled) updateData.current?.(result, projectName, selectedMarker);
    });
    return () => { cancelled = true; };
  }, [kind, result, projectName, selectedMarker]);

  return <div className="engineering-scene" ref={mount} aria-label={`${kind === "campus" ? "UCF Engineering I and II exterior" : kind === "atrium" ? "Engineering atrium" : "Auditorium"} 3D scene`}>
    {error && <p className="scene-fallback glass-panel" role="status">{error}</p>}
  </div>;
}
