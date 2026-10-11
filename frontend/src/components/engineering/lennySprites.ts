import * as THREE from "three";
import { lennyPresenter, lennySponsors, sponsorLennyHeight } from "./lennyLayout";

// High-detail 3D renders on upright billboards: yaw follows the camera while
// feet stay planted, including when a balcony/overhead camera looks down.
export function addLennySprites(scene: THREE.Scene, kind: "atrium" | "awards") {
  const group = new THREE.Group();
  group.name = "Lenny scene hosts";
  scene.add(group);
  const characters: THREE.Mesh[] = [];
  let disposed = false;
  const loader = new THREE.TextureLoader();

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 62);
    gradient.addColorStop(0, "rgba(20, 25, 18, .28)");
    gradient.addColorStop(.45, "rgba(20, 25, 18, .14)");
    gradient.addColorStop(1, "rgba(20, 25, 18, 0)");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  }
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowMap, transparent: true, depthWrite: false, toneMapped: false,
  });
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);

  function character(id: string, name: string, x: number, y: number, z: number, height: number) {
    const width = height * 2 / 3; // All assets retain their original 1024 × 1536 resolution.
    const map = loader.load(`/assets/lenny/lenny-${id}.png`, (texture) => {
      // Texture decoding may complete after a scene switch/StrictMode cleanup.
      if (disposed) { texture.dispose(); return; }
      mesh.visible = shadow.visible = true;
    });
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const material = new THREE.MeshBasicMaterial({
      map, transparent: true, alphaTest: .12, depthTest: true, depthWrite: true,
      side: THREE.DoubleSide, toneMapped: false,
    });
    // The rendered feet are at v=.981 and centered near u=.63. Offset the
    // original padded frame, rather than cropping the detailed horn/tail edges.
    const geometry = new THREE.PlaneGeometry(width, height);
    geometry.translate(-width * .13, height * (.5 - .019), 0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.userData.lenny = id;
    mesh.position.set(x, y, z); mesh.visible = false;
    characters.push(mesh); group.add(mesh);

    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, y + .006, z);
    shadow.scale.set(height * .52, height * .23, 1);
    shadow.visible = false; group.add(shadow);
  }

  if (kind === "awards") {
    character("awards", "Lenny presenting an award", ...lennyPresenter.position, lennyPresenter.height);
  } else {
    for (const sponsor of lennySponsors) {
      const [x, z] = sponsor.position;
      character(sponsor.id, `Lenny wearing a ${sponsor.name} shirt`, x, .03, z, sponsorLennyHeight);
    }
  }

  return {
    faceCamera(camera: THREE.Camera) {
      for (const mesh of characters) {
        mesh.rotation.y = Math.atan2(camera.position.x - mesh.position.x, camera.position.z - mesh.position.z);
      }
    },
    // The scene's existing traversal releases meshes, materials and textures.
    dispose() { disposed = true; },
  };
}
