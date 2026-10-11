import * as THREE from "three";

/** Fit every Engineering bound into the unobscured desktop scene rectangle. */
export function engineeringFrame(bounds: THREE.Box3, width: number, height: number, dashboardRight: number, headerBottom: number) {
  const left = dashboardRight + 28, right = width - 28;
  const top = headerBottom + 28, bottom = height - 90;
  const target = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(-.62, .45, 1).normalize();
  const horizontal = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const vertical = direction.clone().cross(horizontal).normalize();
  const focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(48 / 2)));
  const halfWidth = Math.max(1, (right - left) / 2), halfHeight = Math.max(1, (bottom - top) / 2);
  let distance = 18;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const delta = new THREE.Vector3(x, y, z).sub(target), depth = delta.dot(direction);
    distance = Math.max(distance, depth + Math.abs(delta.dot(horizontal)) * focal / halfWidth, depth + Math.abs(delta.dot(vertical)) * focal / halfHeight);
  }
  // A small breathing margin also accommodates projecting sills and foliage.
  distance *= 1.06;
  return {
    position: target.clone().addScaledVector(direction, distance), target, distance,
    offsetX: width / 2 - (left + right) / 2,
    offsetY: height / 2 - (top + bottom) / 2,
  };
}
