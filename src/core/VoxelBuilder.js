import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const voxelMaterial = new THREE.MeshLambertMaterial();

const _matrix = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _v = new THREE.Vector3();

/**
 * Collects colored boxes and turns them into a single InstancedMesh, so
 * thousands of voxels render in one draw call.
 *
 *   const b = new VoxelBuilder();
 *   b.add(0, 0.5, 0, '#ff0000');            // one 1x1x1 voxel centered at (0, 0.5, 0)
 *   b.box(0, 2, 0, 3, 1, 3, '#00ff00');      // a 3x1x3 box centered at (0, 2, 0)
 *   b.box(0, 2, 0, 3, 1, 3, '#00ff00', q);   // ...turned by the quaternion q (for railings)
 *   scene.add(b.build());
 *
 * For big scenery that never changes (the ground, trees, mountains...) pass `merge: true`:
 * the boxes are baked into one plain Mesh and every face that's pressed flat against another
 * box (the inside of a hill, the ground under a tree...) is left out, which is far less work
 * to draw. A merged mesh can't be changed box by box afterwards.
 *   b.build({ merge: true })                 // one Mesh
 *   b.build({ merge: true, cullBottom: true }) // ...also without the faces looking straight down
 *   b.build({ merge: true, chunk: 48 })      // a Group of Meshes, one per 48x48 patch, so patches
 *                                            // off screen (or outside the shadow area) are skipped
 */
export class VoxelBuilder {
  constructor() {
    this.items = [];
  }

  add(x, y, z, color, size = 1) {
    return this.box(x, y, z, size, size, size, color);
  }

  box(x, y, z, sx, sy, sz, color, rotation = null) {
    this.items.push({ x, y, z, sx, sy, sz, color, rotation });
    return this;
  }

  get count() {
    return this.items.length;
  }

  build({ castShadow = true, receiveShadow = true, material = voxelMaterial, merge = false, cullBottom = false, chunk = 0 } = {}) {
    if (merge) return this.buildMerged({ castShadow, receiveShadow, material, cullBottom, chunk });
    const mesh = new THREE.InstancedMesh(unitBox, material, this.items.length);
    this.items.forEach((v, i) => {
      _matrix.compose(_pos.set(v.x, v.y, v.z), v.rotation ?? _quat, _scale.set(v.sx, v.sy, v.sz));
      mesh.setMatrixAt(i, _matrix);
      mesh.setColorAt(i, _color.set(v.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }

  buildMerged({ castShadow, receiveShadow, material, cullBottom, chunk }) {
    const hidden = hiddenFaces(this.items);
    const groups = new Map(); // chunk key -> list of item indices
    this.items.forEach((v, i) => {
      const key = chunk > 0 ? `${Math.floor(v.x / chunk)},${Math.floor(v.z / chunk)}` : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });

    const meshes = [];
    for (const list of groups.values()) {
      const geometry = mergedGeometry(this.items, list, hidden, cullBottom);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, vertexColorMaterial(material));
      mesh.onBeforeRender = syncMaterial;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      meshes.push(mesh);
    }
    if (chunk <= 0) return meshes[0] ?? new THREE.Mesh(new THREE.BufferGeometry(), vertexColorMaterial(material));
    const group = new THREE.Group();
    if (meshes.length) group.add(...meshes);
    return group;
  }
}

// --- Merging ---------------------------------------------------------------------------------

// The six faces of a box: axis (0 x, 1 y, 2 z), side (+1 / -1), and its corners as
// (u, v) in the other two axes, wound counter-clockwise seen from outside (like BoxGeometry).
const OTHER = [
  [1, 2],
  [2, 0],
  [0, 1],
];
const FACES = [];
for (let axis = 0; axis < 3; axis++) {
  for (const side of [1, -1]) {
    // For +side, (u, v) = OTHER[axis] gives a right-handed basis with the normal; flip for -side.
    const corners = side > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
    FACES.push({ axis, side, corners });
  }
}

const Q = 1e4; // positions are compared after rounding to this many steps per unit
const CELL = 4; // size of the lookup grid used to find touching faces
const q = (n) => Math.round(n * Q);

/**
 * Works out which faces of the (unrotated) boxes are pressed flat against a face of another
 * box, so they can never be seen. Returns a Uint8Array with a bit per face (6 per box).
 */
function hiddenFaces(items) {
  const hidden = new Uint8Array(items.length);
  const index = new Map(); // "axis side,plane,cu,cv" -> indices of the boxes with a face there
  const lo = [0, 0, 0];
  const hi = [0, 0, 0];
  const bounds = (v) => {
    lo[0] = v.x - v.sx / 2;
    hi[0] = v.x + v.sx / 2;
    lo[1] = v.y - v.sy / 2;
    hi[1] = v.y + v.sy / 2;
    lo[2] = v.z - v.sz / 2;
    hi[2] = v.z + v.sz / 2;
  };

  // Put every face of every axis-aligned box in the grid cells it overlaps.
  items.forEach((v, i) => {
    if (v.rotation) return;
    bounds(v);
    for (const f of FACES) {
      const [a, b] = OTHER[f.axis];
      const plane = q(f.side > 0 ? hi[f.axis] : lo[f.axis]);
      const u0 = Math.floor(lo[a] / CELL);
      const u1 = Math.floor((hi[a] - 1e-6) / CELL);
      const v0 = Math.floor(lo[b] / CELL);
      const v1 = Math.floor((hi[b] - 1e-6) / CELL);
      if ((u1 - u0 + 1) * (v1 - v0 + 1) > 256) continue; // too big to index (at worst a few hidden faces still get drawn)
      for (let cu = u0; cu <= u1; cu++) {
        for (let cv = v0; cv <= v1; cv++) {
          const key = `${f.axis}${f.side},${plane},${cu},${cv}`;
          let list = index.get(key);
          if (!list) index.set(key, (list = []));
          list.push(i);
        }
      }
    }
  });

  // A face is hidden if a face of another box points the other way on the same plane and
  // covers it completely.
  const eps = 1 / Q;
  items.forEach((v, i) => {
    if (v.rotation) return;
    bounds(v);
    const myLo = lo.slice();
    const myHi = hi.slice();
    FACES.forEach((f, fi) => {
      const [a, b] = OTHER[f.axis];
      const plane = q(f.side > 0 ? myHi[f.axis] : myLo[f.axis]);
      const cu = Math.floor((myLo[a] + myHi[a]) / 2 / CELL);
      const cv = Math.floor((myLo[b] + myHi[b]) / 2 / CELL);
      const list = index.get(`${f.axis}${-f.side},${plane},${cu},${cv}`);
      if (!list) return;
      for (const j of list) {
        if (j === i) continue;
        bounds(items[j]);
        if (lo[a] <= myLo[a] + eps && hi[a] >= myHi[a] - eps && lo[b] <= myLo[b] + eps && hi[b] >= myHi[b] - eps) {
          hidden[i] |= 1 << fi;
          return;
        }
      }
    });
  });
  return hidden;
}

/** One BufferGeometry (positions, normals, vertex colors) with the visible faces of `list`. */
function mergedGeometry(items, list, hidden, cullBottom) {
  let faceCount = 0;
  for (const i of list) {
    for (let fi = 0; fi < 6; fi++) if (visible(items[i], i, fi, hidden, cullBottom)) faceCount++;
  }
  if (faceCount === 0) return null;

  const positions = new Float32Array(faceCount * 12);
  const normals = new Float32Array(faceCount * 12);
  const colors = new Float32Array(faceCount * 12);
  const indices = faceCount * 4 > 65535 ? new Uint32Array(faceCount * 6) : new Uint16Array(faceCount * 6);
  const corner = [0, 0, 0];
  const normal = [0, 0, 0];
  let n = 0; // faces written

  for (const i of list) {
    const v = items[i];
    _color.set(v.color);
    const size = [v.sx, v.sy, v.sz];
    const center = [v.x, v.y, v.z];
    for (let fi = 0; fi < 6; fi++) {
      if (!visible(v, i, fi, hidden, cullBottom)) continue;
      const f = FACES[fi];
      const [a, b] = OTHER[f.axis];
      normal[0] = normal[1] = normal[2] = 0;
      normal[f.axis] = f.side;
      if (v.rotation) {
        _v.fromArray(normal).applyQuaternion(v.rotation);
        _v.toArray(normal);
      }
      for (let c = 0; c < 4; c++) {
        const [cu, cv] = f.corners[c];
        corner[f.axis] = (f.side * size[f.axis]) / 2;
        corner[a] = (cu - 0.5) * size[a];
        corner[b] = (cv - 0.5) * size[b];
        _v.fromArray(corner);
        if (v.rotation) _v.applyQuaternion(v.rotation);
        const o = n * 12 + c * 3;
        positions[o] = _v.x + center[0];
        positions[o + 1] = _v.y + center[1];
        positions[o + 2] = _v.z + center[2];
        normals[o] = normal[0];
        normals[o + 1] = normal[1];
        normals[o + 2] = normal[2];
        colors[o] = _color.r;
        colors[o + 1] = _color.g;
        colors[o + 2] = _color.b;
      }
      const base = n * 4;
      indices.set([base, base + 1, base + 2, base, base + 2, base + 3], n * 6);
      n++;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function visible(v, i, fi, hidden, cullBottom) {
  if (hidden[i] & (1 << fi)) return false;
  return !(cullBottom && !v.rotation && FACES[fi].axis === 1 && FACES[fi].side < 0);
}

// Merged meshes carry their colors per vertex instead of per instance, so they need a copy of
// the material with vertex colors switched on (shared by every merged mesh using it). Some
// materials are animated (glowing lava, clouds at night...), so before drawing, the copy picks
// up the original's current colors.
const vertexColorMaterials = new WeakMap(); // original -> copy
const originals = new WeakMap(); // copy -> original

function vertexColorMaterial(material) {
  let copy = vertexColorMaterials.get(material);
  if (!copy) {
    copy = material.clone();
    copy.vertexColors = true;
    vertexColorMaterials.set(material, copy);
    originals.set(copy, material);
  }
  return copy;
}

function syncMaterial() {
  const copy = this.material;
  const original = originals.get(copy);
  if (!original) return; // e.g. swapped for a see-through clone by the camera
  copy.color.copy(original.color);
  copy.emissive?.copy(original.emissive);
  if (original.emissiveIntensity !== undefined) copy.emissiveIntensity = original.emissiveIntensity;
  copy.opacity = original.opacity;
  copy.colorWrite = original.colorWrite; // the cave hides its roof this way when you're inside
  copy.depthWrite = original.depthWrite;
}
