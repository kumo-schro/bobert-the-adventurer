import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const voxelMaterial = new THREE.MeshLambertMaterial();

const _matrix = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

/**
 * Collects colored boxes and turns them into a single InstancedMesh, so
 * thousands of voxels render in one draw call.
 *
 *   const b = new VoxelBuilder();
 *   b.add(0, 0.5, 0, '#ff0000');            // one 1x1x1 voxel centered at (0, 0.5, 0)
 *   b.box(0, 2, 0, 3, 1, 3, '#00ff00');      // a 3x1x3 box centered at (0, 2, 0)
 *   scene.add(b.build());
 */
export class VoxelBuilder {
  constructor() {
    this.items = [];
  }

  add(x, y, z, color, size = 1) {
    return this.box(x, y, z, size, size, size, color);
  }

  box(x, y, z, sx, sy, sz, color) {
    this.items.push({ x, y, z, sx, sy, sz, color });
    return this;
  }

  get count() {
    return this.items.length;
  }

  build({ castShadow = true, receiveShadow = true, material = voxelMaterial } = {}) {
    const mesh = new THREE.InstancedMesh(unitBox, material, this.items.length);
    this.items.forEach((v, i) => {
      _matrix.compose(_pos.set(v.x, v.y, v.z), _quat, _scale.set(v.sx, v.sy, v.sz));
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
}
