import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { createRng } from '../utils/random.js';
import { SEED } from '../config.js';

export const cloudMaterial = new THREE.MeshLambertMaterial({ emissive: '#ffffff', emissiveIntensity: 0.35 });
const WRAP = 320;

/** Puffy blocky clouds drifting slowly across the sky. */
export class Clouds extends Entity {
  constructor({ count = 18 } = {}) {
    super();
    const rng = createRng(SEED + 3);
    this.clouds = [];

    for (let i = 0; i < count; i++) {
      const builder = new VoxelBuilder();
      const size = 4;
      const length = rng.int(4, 9);
      const width = rng.int(3, 5);
      for (let a = 0; a < length; a++) {
        for (let b = 0; b < width; b++) {
          // Taller in the middle, ragged at the edges.
          const center = 1 - Math.abs(a / (length - 1) - 0.5) * 2;
          if (rng.chance(0.15) && center < 0.5) continue;
          const layers = 1 + (center > 0.4 && rng.chance(0.7) ? 1 : 0) + (center > 0.8 ? 1 : 0);
          for (let l = 0; l < layers; l++) {
            builder.add(a * size, l * size * 0.6, b * size, l === 0 ? '#eef4ff' : '#ffffff', size);
          }
        }
      }
      const mesh = builder.build({ merge: true, castShadow: false, receiveShadow: false, material: cloudMaterial });
      mesh.position.set(rng.range(-WRAP, WRAP), rng.range(55, 95), rng.range(-260, 260));
      this.object3d.add(mesh);
      this.clouds.push({ mesh, speed: rng.range(1.5, 4) });
    }
  }

  update(dt) {
    for (const cloud of this.clouds) {
      cloud.mesh.position.x += cloud.speed * dt;
      if (cloud.mesh.position.x > WRAP) cloud.mesh.position.x = -WRAP;
    }
  }
}
