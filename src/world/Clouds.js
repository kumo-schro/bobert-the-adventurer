import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { gardenMaterial } from '../style/garden.js';
import { modelParts } from '../style/models.js';
import { createRng } from '../utils/random.js';
import { SEED } from '../config.js';

// Soft glowing white with a pink rim (DayNight dims the glow at night).
export const cloudMaterial = gardenMaterial({ color: '#ffffff', emissive: '#fff4fb', emissiveIntensity: 0.35, rim: 0.7, rimColor: '#ffc6ec' });
const WRAP = 320;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Puffy beveled clouds drifting slowly across the sky (one instanced mesh per cloud shape). */
export class Clouds extends Entity {
  constructor({ count = 18 } = {}) {
    super();
    const rng = createRng(SEED + 3);
    this.clouds = [];
    const shapes = ['cloud_a', 'cloud_b'].map((name) => {
      const mesh = new THREE.InstancedMesh(modelParts(name)[0].geometry, cloudMaterial, count);
      mesh.count = 0;
      mesh.frustumCulled = false; // they're spread across the whole sky
      this.object3d.add(mesh);
      return mesh;
    });

    for (let i = 0; i < count; i++) {
      const mesh = shapes[i % shapes.length];
      this.clouds.push({
        mesh,
        index: mesh.count++,
        position: new THREE.Vector3(rng.range(-WRAP, WRAP), rng.range(55, 95), rng.range(-260, 260)),
        rotation: rng.range(-0.4, 0.4),
        scale: rng.range(2.4, 3.6),
        speed: rng.range(1.5, 4),
      });
    }
    this.update(0);
  }

  update(dt) {
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.speed * dt;
      if (cloud.position.x > WRAP) cloud.position.x = -WRAP;
      _q.setFromAxisAngle(UP, cloud.rotation);
      cloud.mesh.setMatrixAt(cloud.index, _m.compose(_p.copy(cloud.position), _q, _s.setScalar(cloud.scale)));
    }
    for (const mesh of this.object3d.children) mesh.instanceMatrix.needsUpdate = true;
  }
}
