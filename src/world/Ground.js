import { Entity } from '../core/Entity.js';
import { IslandSurface } from '../style/IslandSurface.js';
import { createNoise2D } from '../utils/random.js';
import { SEED, WORLD } from '../config.js';

/**
 * A big grassy island with a sandy beach. The coast wobbles in and out (bays and
 * headlands) so it isn't a perfect circle.
 * Registers itself as game.terrain so others can query height and bounds.
 */
export class Ground extends Entity {
  constructor({ radius = WORLD.islandRadius } = {}) {
    super();
    this.radius = radius;
    this.noise = createNoise2D(SEED);
    // One smooth surface (grass, beach, paths) instead of thousands of blocks.
    this.surface = new IslandSurface({
      edge: (a) => this.edgeRadius(Math.cos(a), Math.sin(a)),
      maxRadius: radius + 16,
    });
    this.object3d.add(this.surface.mesh);
  }

  /** Draw a path (or plaza) onto the grass. Call commitPaths() after a batch. */
  paintPath(x, z, radius) {
    this.surface.paintPath(x, z, radius);
  }

  commitPaths() {
    this.surface.commitPaths();
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
