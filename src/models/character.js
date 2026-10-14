import * as THREE from 'three';

const boxCache = new Map();
function boxGeometry(w, h, d) {
  const key = `${w},${h},${d}`;
  if (!boxCache.has(key)) boxCache.set(key, new THREE.BoxGeometry(w, h, d));
  return boxCache.get(key);
}

/** Adds a colored box to `parent`. Shared by the character and the items they hold. */
export function part(parent, [w, h, d], color, [x, y, z], { emissive } = {}) {
  const material = new THREE.MeshLambertMaterial({ color });
  if (emissive) {
    material.emissive.set(emissive);
    material.emissiveIntensity = 0.25;
  }
  const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function pivot(parent, [x, y, z]) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * Builds a blocky character facing +Z with its feet at y = 0.
 * Limbs are wrapped in pivot groups so they can swing from the hip/shoulder.
 * Facing +Z, the character's right side is -X.
 * handR / handL are empty groups to attach held items to.
 */
export function createCharacter({
  skin = '#ffcc99',
  shirt = '#ff4f6d',
  pants = '#3d5afe',
  shoes = '#2b2b2b',
  hair = '#6b3e1f',
} = {}) {
  const root = new THREE.Group();

  // Legs (pivot at hip)
  const legR = pivot(root, [-0.16, 0.75, 0]);
  const legL = pivot(root, [0.16, 0.75, 0]);
  for (const leg of [legL, legR]) {
    part(leg, [0.28, 0.62, 0.3], pants, [0, -0.31, 0]);
    part(leg, [0.3, 0.14, 0.36], shoes, [0, -0.68, 0.03]);
  }

  // Body
  part(root, [0.62, 0.72, 0.36], shirt, [0, 1.11, 0]);
  part(root, [0.64, 0.1, 0.38], pants, [0, 0.78, 0]); // belt line

  // Arms (pivot at shoulder)
  const armR = pivot(root, [-0.43, 1.4, 0]);
  const armL = pivot(root, [0.43, 1.4, 0]);
  for (const arm of [armL, armR]) {
    part(arm, [0.22, 0.5, 0.26], shirt, [0, -0.22, 0]);
    part(arm, [0.2, 0.18, 0.24], skin, [0, -0.55, 0]);
  }
  const handR = pivot(armR, [0, -0.58, 0.02]);
  const handL = pivot(armL, [0, -0.58, 0.02]);

  // Head
  const head = pivot(root, [0, 1.47, 0]);
  part(head, [0.6, 0.6, 0.6], skin, [0, 0.3, 0]);
  part(head, [0.64, 0.16, 0.64], hair, [0, 0.62, 0]);
  part(head, [0.64, 0.4, 0.14], hair, [0, 0.42, -0.26]);
  part(head, [0.09, 0.12, 0.02], '#1d1d1d', [-0.13, 0.33, 0.305]);
  part(head, [0.09, 0.12, 0.02], '#1d1d1d', [0.13, 0.33, 0.305]);
  part(head, [0.1, 0.06, 0.02], '#ff8fa3', [-0.21, 0.2, 0.305]);
  part(head, [0.1, 0.06, 0.02], '#ff8fa3', [0.21, 0.2, 0.305]);
  part(head, [0.16, 0.05, 0.02], '#b5523b', [0, 0.16, 0.305]);

  return { root, head, armL, armR, legL, legR, handL, handR };
}

/** Swings arms and legs for walking. `swing` 0 = standing still, ~1 = full stride. */
export function poseWalk(model, phase, swing) {
  const s = Math.sin(phase) * swing;
  model.legL.rotation.x = s;
  model.legR.rotation.x = -s;
  model.armL.rotation.x = -s;
  model.armR.rotation.x = s;
  model.head.position.y = (model.headY ?? 1.47) + Math.abs(Math.sin(phase)) * 0.04 * swing;
}

/** Turns the model to face an angle (radians around Y), smoothly and the short way round. */
export function turnToward(model, angle, dt, speed = 12) {
  let delta = angle - model.root.rotation.y;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  model.root.rotation.y += delta * (1 - Math.exp(-speed * dt));
}
