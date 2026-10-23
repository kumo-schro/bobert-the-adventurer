import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { grassMaterial, sandMaterial } from '../core/textures.js';
import { createRng, createNoise2D, fbm } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { SEED, WORLD, SEA } from '../config.js';

const GRASS = ['#4fb83a', '#5cc93b', '#6fd64a', '#83e05a'];
const SAND = '#f5dfa0';
const WET_SAND = '#e3c47f';

/**
 * A big island of grass voxels with a sandy beach. The coast wobbles in and out (bays and
 * headlands) so it isn't a perfect circle.
 * Registers itself as game.terrain so others can query height and bounds.
 */
export class Ground extends Entity {
  constructor({ radius = WORLD.islandRadius } = {}) {
    super();
    this.radius = radius;
    this.noise = createNoise2D(SEED);
    const rng = createRng(SEED);
    const grass = new VoxelBuilder();
    const sand = new VoxelBuilder();

    for (let x = -radius - 16; x < radius + 16; x++) {
      for (let z = -radius - 16; z < radius + 16; z++) {
        const cx = x + 0.5;
        const cz = z + 0.5;
        const d = Math.hypot(cx, cz);
        const edge = this.edgeRadius(cx, cz);
        if (d > edge) continue;

        if (d > edge - 1.5) {
          // Outer ring sits one block lower so it looks like sand under the water.
          sand.box(cx, (SEA.floor - 1) / 2, cz, 1, -1 - SEA.floor, 1, vary(WET_SAND, rng)); // down to the seabed
        } else if (d > edge - 4) {
          sand.add(cx, -0.5, cz, vary(SAND, rng));
        } else {
          // Blend between grass shades with noise for soft meadow patches.
          const n = fbm(this.noise, cx * 0.06, cz * 0.06, 3);
          const shade = GRASS[Math.min(GRASS.length - 1, Math.floor(n * GRASS.length * 1.2))];
          grass.add(cx, -0.5, cz, vary(shade, rng, 0.06));
        }
      }
    }

    this.object3d.add(
      grass.build({ merge: true, cullBottom: true, chunk: 48, castShadow: false, material: grassMaterial }),
      sand.build({ merge: true, cullBottom: true, chunk: 48, castShadow: false, material: sandMaterial }),
    );
  }

  /** Distance from the middle to the coast in the direction of (x, z): big bays and headlands plus small wiggles. */
  edgeRadius(x, z) {
    const angle = Math.atan2(z, x);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const big = this.noise(c * 1.6 + 50, s * 1.6 + 50) - 0.5; // a few big bulges and bays
    const small = this.noise(c * 6 + 80, s * 6 + 80) - 0.5; // smaller wiggles
    return this.radius + big * 24 + small * 7;
  }

  /** True if (x, z) is on dry walkable land (with some margin from the beach). */
  isInside(x, z, margin = 0) {
    return Math.hypot(x, z) < this.edgeRadius(x, z) - 2 - margin;
  }

  /** True if (x, z) is grass rather than beach. */
  isGrass(x, z, margin = 0) {
    return Math.hypot(x, z) < this.edgeRadius(x, z) - 4 - margin;
  }

  heightAt(_x, _z) {
    return 0;
  }

  onAdd(game) {
    game.terrain = this;
  }
}
