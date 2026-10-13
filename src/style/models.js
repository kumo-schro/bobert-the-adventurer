import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gardenMaterial } from './garden.js';

// The Blender models (art/blender -> public/models/*.glb), loaded once at startup and drawn
// with instancing: every copy of a model is one draw call per material, however many there are.

// What each Blender material name becomes in the game. `tinted` parts take a color per copy.
const MATERIALS = {
  bark: () => gardenMaterial({ map: 'bark', tint: 0.25, rim: 0.25 }),
  foliage: () => gardenMaterial({ map: 'foliage', tint: 1, rim: 0.55 }),
  fruit: () => gardenMaterial({ color: '#ffe14d', emissive: '#ffb300', emissiveIntensity: 0.6, rim: 0.4 }),
  vine: () => gardenMaterial({ color: '#2fbf5a', rim: 0.3 }),
  stem: () => gardenMaterial({ color: '#36c85a', rim: 0.3 }),
  petal: () => gardenMaterial({ color: '#ffffff', rim: 0.6 }),
  flowercenter: () => gardenMaterial({ color: '#ffe14d', emissive: '#ffb300', emissiveIntensity: 0.5 }),
  cap: () => gardenMaterial({ color: '#ffffff', rim: 0.5 }),
  spot: () => gardenMaterial({ color: '#fff8f0', rim: 0.3 }),
  rock: () => gardenMaterial({ map: 'stone', tint: 0.35, rim: 0.35 }),
  grass: () => gardenMaterial({ map: 'grass', tint: 0.4, rim: 0.2 }),
};
const TINTED = new Set(['foliage', 'petal', 'cap', 'rock']);

export const MODEL_NAMES = ['puff_tree', 'spiral_tree', 'jungle_tree', 'daisy', 'tulip', 'mushroom', 'bush', 'boulder', 'grass_tuft', 'daisy_small', 'tulip_small', 'cloud_a', 'cloud_b'];

const models = new Map(); // name -> [{ geometry, material: name }]
const materialCache = new Map();

function materialFor(name) {
  if (!materialCache.has(name)) materialCache.set(name, (MATERIALS[name] ?? (() => gardenMaterial()))());
  return materialCache.get(name);
}

/** Load every model (call once before building the world). */
export async function loadModels() {
  const loader = new GLTFLoader();
  await Promise.all(
    MODEL_NAMES.map(async (name) => {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`);
      gltf.scene.updateMatrixWorld(true);
      const parts = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const geometry = o.geometry.clone();
        geometry.applyMatrix4(o.matrixWorld);
        geometry.deleteAttribute('uv');
        geometry.computeBoundingSphere();
        parts.push({ geometry, material: o.material.name || 'foliage' });
      });
      models.set(name, parts);
    }),
  );
}

/** The parts of a loaded model: [{ geometry, material }]. */
export function modelParts(name) {
  const parts = models.get(name);
  if (!parts) throw new Error(`Model "${name}" isn't loaded (is it in MODEL_NAMES?)`);
  return parts;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const _white = new THREE.Color('#ffffff');
const _c = new THREE.Color();

/**
 * Many copies of a model as instanced meshes (one per material). Each copy:
 *   { x, y, z, rotation (around Y), scale, scaleY, tiltX, tiltZ, color }
 * (color tints the tinted parts: leaves, petals, caps). Returns a Group to add to the scene.
 *
 * `materials` swaps in your own material for some parts, by name: { cap: glowingMaterial }.
 * `cellSize` splits the copies into square patches of the world, each its own set of meshes,
 * so patches behind the camera get skipped (a few more draw calls, far fewer triangles).
 */
export function instances(name, list, { castShadow = true, receiveShadow = true, cellSize = 0, materials = {} } = {}) {
  const group = new THREE.Group();
  const cells = new Map();
  for (const it of list) {
    const key = cellSize ? `${Math.floor(it.x / cellSize)},${Math.floor(it.z / cellSize)}` : '';
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(it);
  }
  for (const copies of cells.values()) {
    for (const part of modelParts(name)) {
      const mesh = new THREE.InstancedMesh(part.geometry, materials[part.material] ?? materialFor(part.material), copies.length);
      const tinted = TINTED.has(part.material);
      copies.forEach((it, i) => {
        _q.setFromEuler(_e.set(it.tiltX ?? 0, it.rotation ?? 0, it.tiltZ ?? 0));
        const s = it.scale ?? 1;
        _m.compose(_p.set(it.x, it.y ?? 0, it.z), _q, _s.set(s, it.scaleY ?? s, s));
        mesh.setMatrixAt(i, _m);
        if (tinted) mesh.setColorAt(i, it.color ? _c.set(it.color) : _white);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
  }
  return group;
}

/** One copy of a model as an ordinary group of meshes (for things that come and go, like boulders). */
export function single(name, { color } = {}) {
  const group = new THREE.Group();
  for (const part of modelParts(name)) {
    let material = materialFor(part.material);
    if (color && TINTED.has(part.material)) {
      material = MATERIALS[part.material](); // its own copy, so the color is just for this one
      material.color.set(color);
    }
    const mesh = new THREE.Mesh(part.geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
