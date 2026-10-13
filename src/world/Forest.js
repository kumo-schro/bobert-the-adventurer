import { Entity } from '../core/Entity.js';
import { createRng } from '../utils/random.js';
import { instances } from '../style/models.js';
import { SEED, WORLD } from '../config.js';

// Crown colors for the puffy trees: every tree gets its own bright, dreamy color.
const PUFF_COLORS = ['#ff5ec8', '#ff8a3d', '#ffe14d', '#7dff3a', '#36e6ff', '#b07cff', '#ff5e7e', '#4be3a0'];
const SPIRAL_COLORS = ['#18c9a0', '#2fe0c8', '#36b6ff', '#8a5cff', '#21c46b'];

/**
 * Scatters trees evenly across the grass (at least `spacing` apart, so there's room to walk
 * between them) and registers their trunks as colliders. The trees are Blender models drawn
 * with instancing, so the whole forest is a handful of draw calls.
 */
export class Forest extends Entity {
  constructor({ count = WORLD.treeCount, spacing = WORLD.treeSpacing, clearRadius = 12 } = {}) {
    super();
    this.options = { count, spacing, clearRadius };
    this.trees = [];
  }

  onAdd(game) {
    const { count, spacing, clearRadius } = this.options;
    const rng = createRng(SEED + 1);
    const kinds = { puff_tree: [], spiral_tree: [] };
    const r = game.terrain.radius;

    for (let attempt = 0; attempt < count * 60 && this.trees.length < count; attempt++) {
      const x = Math.floor(rng.range(-r, r)) + 0.5;
      const z = Math.floor(rng.range(-r, r)) + 0.5;
      if (!game.terrain.isGrass(x, z, 3)) continue;
      if (Math.hypot(x, z) < clearRadius) continue; // keep the spawn point open
      if (game.isReserved(x, z, 3.5)) continue; // don't grow through houses, paths or the mountain
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < spacing)) continue;

      const puff = rng.chance(0.6);
      const scale = puff ? rng.range(1.0, 1.3) : rng.range(1.1, 1.4);
      const tilt = 0.06;
      kinds[puff ? 'puff_tree' : 'spiral_tree'].push({
        x,
        y: game.terrain.heightAt?.(x, z) ?? 0,
        z,
        rotation: rng.range(0, Math.PI * 2),
        scale,
        tiltX: rng.range(-tilt, tilt),
        tiltZ: rng.range(-tilt, tilt),
        color: rng.pick(puff ? PUFF_COLORS : SPIRAL_COLORS),
      });
      const radius = (puff ? 0.75 : 0.45) * scale;
      const tree = { x, z, radius };
      this.trees.push(tree);
      game.colliders.push(tree);
      game.gathering?.addNode({ kind: 'wood', x, z, radius });
    }

    // Not camera blockers: walking under trees shouldn't make the camera jump in.
    for (const [name, list] of Object.entries(kinds)) this.object3d.add(instances(name, list, { cellSize: 100 }));
  }
}
