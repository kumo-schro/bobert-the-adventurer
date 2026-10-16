import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { blockMaterial } from '../core/textures.js';
import { createNoise2D, fbm } from '../utils/random.js';
import { SEED } from '../config.js';

// Height bands, bottom to top. Each column is split into colored segments.
const BANDS = [
  { upTo: 12, color: '#8edb6a' },
  { upTo: 24, color: '#4fb07c' },
  { upTo: 40, color: '#9a8fd0' },
  { upTo: Infinity, color: '#ffffff' },
];

/** A ring of big chunky voxel mountains on the horizon. Purely background. */
export class Mountains extends Entity {
  constructor({ innerRadius = 420, outerRadius = 650, cell = 8 } = {}) {
    super();
    const noise = createNoise2D(SEED + 7);
    const builder = new VoxelBuilder();

    for (let x = -outerRadius; x <= outerRadius; x += cell) {
      for (let z = -outerRadius; z <= outerRadius; z += cell) {
        const d = Math.hypot(x, z);
        if (d < innerRadius || d > outerRadius) continue;

        const rise = Math.min(1, (d - innerRadius) / 110);
        const n = fbm(noise, x * 0.012, z * 0.012, 4);
        let height = Math.pow(n, 1.6) * 85 * rise + rise * 6;
        height = Math.round(height / 4) * 4; // terraced steps
        if (height < 4) continue;

        let bottom = -2;
        for (const band of BANDS) {
          const top = Math.min(height, band.upTo);
          if (top > bottom) {
            builder.box(x, (bottom + top) / 2, z, cell, top - bottom, cell, band.color);
            bottom = top;
          }
          if (bottom >= height) break;
        }
      }
    }

    this.object3d.add(builder.build({ castShadow: false, receiveShadow: false, material: blockMaterial }));
  }
}
