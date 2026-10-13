import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { gardenMaterial } from '../style/garden.js';
import { createNoise2D, fbm } from '../utils/random.js';
import { SEED } from '../config.js';

// Layer-cake hills: each terrace is a different candy color, bottom to top (soft and cool at the
// bottom so they sit back in the distance).
const LAYERS = ['#56c9a4', '#3fb3b0', '#4a9cf0', '#6f7cff', '#9268ff', '#c060e8', '#ec6cc8', '#ff96cc', '#ffcce6', '#fff6fb'];
const STEP = 9; // height of one terrace

/**
 * A ring of big terraced dream hills on the horizon: one smooth mesh, with soft plateaus and
 * striped candy-colored layers. Purely background.
 */
export class Mountains extends Entity {
  constructor({ innerRadius = 320, outerRadius = 560, segments = 360, rings = 48 } = {}) {
    super();
    const noise = createNoise2D(SEED + 7);
    const positions = [];
    const colors = [];
    const index = [];
    const color = new THREE.Color();
    const next = new THREE.Color();

    for (let r = 0; r <= rings; r++) {
      const d = innerRadius + ((outerRadius - innerRadius) * r) / rings;
      for (let s = 0; s <= segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        const rise = Math.min(1, (d - innerRadius) / 110);
        const n = fbm(noise, x * 0.012, z * 0.012, 4);
        const raw = (Math.pow(n, 1.6) * 95 * rise + rise * 6) / STEP;
        // Soft terraces: flat tops joined by rounded slopes.
        const level = Math.floor(raw);
        const f = raw - level;
        const t = THREE.MathUtils.smoothstep(f, 0.55, 0.9);
        const height = r === 0 ? -3 : (level + t) * STEP - 2;
        positions.push(x, height, z);
        const i = Math.min(LAYERS.length - 1, level);
        color.set(LAYERS[i]).lerp(next.set(LAYERS[Math.min(LAYERS.length - 1, i + 1)]), t);
        colors.push(color.r, color.g, color.b);
      }
    }
    const row = segments + 1;
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const a = r * row + s;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        index.push(a, b, c, b, d, c); // counter-clockwise seen from above
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const material = gardenMaterial({ rim: 0.5 });
    material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    this.object3d.add(mesh);
  }
}
