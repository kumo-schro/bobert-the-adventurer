import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { barkTexture, leafTexture, texturedVoxelMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { TREE_KINDS } from '../models/trees.js';
import { SEED, WORLD } from '../config.js';

const barkMaterial = texturedVoxelMaterial(barkTexture);
const leafMaterial = texturedVoxelMaterial(leafTexture);

/**
 * Scatters trees evenly across the grass (at least `spacing` apart, so there's room to walk
 * between them) and registers their trunks as colliders.
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
    const parts = { trunk: new VoxelBuilder(), leaves: new VoxelBuilder() };
    const r = game.terrain.radius;

    for (let attempt = 0; attempt < count * 60 && this.trees.length < count; attempt++) {
      const x = Math.floor(rng.range(-r, r)) + 0.5;
      const z = Math.floor(rng.range(-r, r)) + 0.5;
      if (!game.terrain.isGrass(x, z, 3)) continue;
      if (Math.hypot(x, z) < clearRadius) continue; // keep the spawn point open
      if (game.isReserved(x, z, 3.5)) continue; // don't grow through houses, paths or the mountain
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < spacing)) continue;

      const { radius } = rng.pick(TREE_KINDS)(parts, x, z, rng);
      const tree = { x, z, radius, sound: 'wood' };
      this.trees.push(tree);
      game.colliders.push(tree);
      game.gathering?.addNode({ kind: 'wood', x, z, radius });
    }

    const trunks = parts.trunk.build({ material: barkMaterial });
    const leaves = parts.leaves.build({ material: leafMaterial });
    // Not camera blockers: walking under trees shouldn't make the camera jump in.
    this.object3d.add(trunks, leaves);
  }
}
