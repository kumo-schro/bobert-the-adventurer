import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { SEED, GATHER } from '../config.js';

const ROCK = ['#8d8f96', '#7d8088', '#9a9ca3', '#a6a8ae'];
const rockMaterial = texturedVoxelMaterial(stoneTexture);

/**
 * Wood and stone. Trees (registered by the Forest and the jungle) give wood when you chop them
 * with an axe; boulders give stone when you mine them with a pickaxe. Press T next to one.
 * Each gives GATHER.perNode before it needs a rest, then comes back after a while.
 *
 * Others register things to gather with game.gathering.addNode({ kind: 'wood'|'stone', x, z, radius, model? }).
 * This entity also scatters the boulders on the main island. Lives at game.gathering.
 */
export class Gathering extends Entity {
  constructor({ boulders = GATHER.boulderCount } = {}) {
    super();
    this.boulderCount = boulders;
    this.nodes = [];
  }

  onAdd(game) {
    game.gathering = this;
    this.placeBoulders(game);
  }

  addNode(node) {
    this.nodes.push({ left: GATHER.perNode, restUntil: 0, ...node });
  }

  placeBoulders(game) {
    const rng = createRng(SEED + 101);
    const r = game.terrain.radius;
    let placed = 0;
    for (let attempt = 0; attempt < 600 && placed < this.boulderCount; attempt++) {
      const x = rng.range(-r, r);
      const z = rng.range(-r, r);
      if (Math.hypot(x, z) < 22 || !game.terrain.isGrass(x, z, 3) || game.isReserved(x, z, 2)) continue;
      if (game.colliders.some((c) => c.radius && Math.hypot(c.x - x, c.z - z) < c.radius + 2.5)) continue;
      const b = new VoxelBuilder();
      const size = rng.range(1.1, 1.6);
      b.box(0, size * 0.45, 0, size * 1.3, size * 0.9, size, vary(rng.pick(ROCK), rng, 0.05));
      b.box(size * 0.2, size * 1.0, -0.1, size * 0.8, size * 0.5, size * 0.7, vary(rng.pick(ROCK), rng, 0.05));
      b.box(-size * 0.4, size * 0.25, size * 0.3, 0.6, 0.5, 0.6, vary(rng.pick(ROCK), rng, 0.05));
      const model = b.build({ material: rockMaterial });
      model.position.set(x, 0, z);
      model.rotation.y = rng.range(0, Math.PI);
      this.object3d.add(model);
      const collider = { x, z, radius: size * 0.75 };
      game.colliders.push(collider);
      game.reservedAreas.push({ x, z, radius: 2 });
      this.addNode({ kind: 'stone', x, z, radius: collider.radius, model, collider });
      placed++;
    }
  }

  gather(game, node) {
    const player = game.player;
    const wood = node.kind === 'wood';
    player.useTool(wood ? 'axe' : 'pickaxe');
    if (wood) player.wood++;
    else player.stone++;
    node.left--;
    const at = new THREE.Vector3(node.x, 1.2, node.z);
    game.particles?.burst(at, {
      count: 10,
      colors: wood ? ['#8a5a35', '#c58b52', '#3fae3a'] : ['#8d8f96', '#c9c2b5', '#ffffff'],
      speed: 4,
      size: 0.14,
    });
    if (node.left <= 0) {
      node.restUntil = game.elapsed + GATHER.regrowSeconds;
      if (node.model && !wood) {
        node.model.visible = false; // the boulder is all mined out (it comes back later)
        node.collider.radius = 0;
      }
    }
  }

  update(_dt, game) {
    const player = game.player;
    if (!player || player.dead || game.isUiOpen()) return;

    // Rested nodes come back.
    for (const node of this.nodes) {
      if (node.left <= 0 && game.elapsed >= node.restUntil) {
        node.left = GATHER.perNode;
        if (node.model) {
          node.model.visible = true;
          node.collider.radius = node.collider.fullRadius ?? node.radius;
        }
      }
    }

    if (player.toolTimer > 0) return;
    const p = player.object3d.position;
    let best = null;
    let bestDist = Infinity;
    for (const node of this.nodes) {
      if (node.left <= 0) continue;
      const d = Math.hypot(node.x - p.x, node.z - p.z) - node.radius;
      if (d < 1.4 && d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
    if (!best) return;
    const wood = best.kind === 'wood';
    if (wood ? !player.hasAxe : !player.hasPickaxe) return; // no prompt without the right tool
    game.dialog.offerInteraction(
      `Press T to ${wood ? 'chop wood' : 'mine stone'} (${best.left} left)`,
      bestDist + 2, // a little "farther" than it is, so talking to someone nearby wins
      () => this.gather(game, best),
    );
  }
}
