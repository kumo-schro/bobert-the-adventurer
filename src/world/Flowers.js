import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { SEED, WORLD } from '../config.js';

const PETALS = ['#ff4d6d', '#ffd23f', '#ffffff', '#c77dff', '#4cc9f0', '#ff8fab'];
const STEM = '#2f9e44';
const TUFT = '#3fa73a';

/** Little voxel flowers and grass tufts sprinkled over the meadow. */
export class Flowers extends Entity {
  constructor({ count = WORLD.flowerCount } = {}) {
    super();
    this.count = count;
  }

  onAdd(game) {
    const rng = createRng(SEED + 2);
    const b = new VoxelBuilder();
    const r = game.terrain.radius;

    let placed = 0;
    for (let attempt = 0; attempt < this.count * 10 && placed < this.count; attempt++) {
      const x = rng.range(-r, r);
      const z = rng.range(-r, r);
      if (!game.terrain.isGrass(x, z, 1) || game.isReserved(x, z)) continue;
      placed++;

      if (rng.chance(0.55)) {
        // Grass tuft: a few thin blades.
        for (let i = 0; i < 3; i++) {
          const h = rng.range(0.25, 0.5);
          b.box(x + rng.range(-0.15, 0.15), h / 2, z + rng.range(-0.15, 0.15), 0.08, h, 0.08, vary(TUFT, rng));
        }
      } else {
        // Flower: stem + petals + yellow middle.
        const h = rng.range(0.3, 0.55);
        b.box(x, h / 2, z, 0.07, h, 0.07, STEM);
        b.box(x, h + 0.06, z, 0.26, 0.12, 0.26, vary(rng.pick(PETALS), rng));
        b.box(x, h + 0.1, z, 0.1, 0.06, 0.1, '#ffb703');
      }
    }

    this.object3d.add(b.build({ castShadow: false }));
  }
}
