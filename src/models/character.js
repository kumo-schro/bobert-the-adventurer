import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { gardenMaterial, createBevelBox } from '../style/garden.js';

// Parts are chunky, soft beveled blocks, like painted wooden toys (bevel about a quarter of the
// thinnest side, capped).
const boxCache = new Map();
function boxGeometry(w, h, d) {
  const key = `${w},${h},${d}`;
  if (!boxCache.has(key)) boxCache.set(key, createBevelBox([w, h, d], Math.min(0.1, 0.26 * Math.min(w, h, d))));
  return boxCache.get(key);
}

/** Adds a colored box to `parent`. Shared by the character and the items they hold. */
export function part(parent, [w, h, d], color, [x, y, z], { emissive } = {}) {
  const material = gardenMaterial({ color, rim: 0.5 });
  if (emissive) {
    material.emissive.set(emissive);
    material.emissiveIntensity = 0.25;
  }
  const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = Math.max(w, h, d) > 0.2; // tiny details (eyes, buttons) don't need shadows
  mesh.userData.part = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Merges a finished character's plain parts into one mesh per body part (head, each arm and
 * leg, the body), so a person is a handful of draw calls instead of dozens. Glowing and
 * see-through parts stay separate (code changes those later), and so does anything added
 * afterwards (swords, shields, armor), and anything marked `userData.keep`. Call it once the
 * model is finished (after createCharacter() and decorate()).
 */
export function bakeParts(root) {
  const groups = new Map();
  root.traverse((o) => {
    if (!o.userData.part || o.userData.keep || o.children.length) return;
    if (o.material.transparent || o.material.emissiveIntensity > 0) return;
    if (!groups.has(o.parent)) groups.set(o.parent, []);
    groups.get(o.parent).push(o);
  });
  for (const [parent, meshes] of groups) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((o) => {
      o.updateMatrix();
      const g = o.geometry.clone().applyMatrix4(o.matrix);
      const { r, g: gr, b } = o.material.color;
      const colors = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set([r, gr, b], i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return g;
    });
    const material = gardenMaterial({ rim: 0.5 });
    material.vertexColors = true;
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = true;
    for (const o of meshes) parent.remove(o);
    parent.add(mesh);
  }
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
  // Big glossy cartoon eyes: white, a dark pupil looking a little inward, and a sparkle.
  for (const side of [-1, 1]) {
    part(head, [0.14, 0.18, 0.02], '#ffffff', [side * 0.13, 0.34, 0.302]);
    part(head, [0.09, 0.12, 0.02], '#2a1840', [side * 0.12, 0.32, 0.312]);
    part(head, [0.035, 0.035, 0.01], '#ffffff', [side * 0.1, 0.355, 0.324]);
  }
  part(head, [0.08, 0.05, 0.02], '#ff8fa3', [-0.18, 0.21, 0.302]);
  part(head, [0.08, 0.05, 0.02], '#ff8fa3', [0.18, 0.21, 0.302]);
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
  model.head.position.y = 1.47 + Math.abs(Math.sin(phase)) * 0.04 * swing;
}

/** Turns the model to face an angle (radians around Y), smoothly and the short way round. */
export function turnToward(model, angle, dt, speed = 12) {
  let delta = angle - model.root.rotation.y;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  model.root.rotation.y += delta * (1 - Math.exp(-speed * dt));
}
