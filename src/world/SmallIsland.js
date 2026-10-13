import { Entity } from '../core/Entity.js';
import { IslandSurface } from '../style/IslandSurface.js';
import { instances } from '../style/models.js';
import { createRng } from '../utils/random.js';
import { Chest } from '../entities/Chest.js';
import { SEED } from '../config.js';

const BUSHES = ['#2fd27a', '#18c9a0', '#7dff3a', '#4be3a0'];
const ROCKS = ['#d9ccff', '#c4f2e2', '#ffd9b0'];

/** The smooth ground of a round sandy island with a grassy middle (like a tiny main island). */
export function islandGround(X, Z, r) {
  return new IslandSurface({ center: { x: X, z: Z }, edge: () => r, maxRadius: r + 2, segments: 96, rings: 24, paths: false }).mesh;
}

/** Decides on a berry bush or a boulder at (x, z), into `props` ({ bushes, rocks } lists). */
export function bushOrRock(props, rng, x, z) {
  const spot = { x, z, rotation: rng.range(0, Math.PI * 2) };
  if (rng.chance(0.5)) props.bushes.push({ ...spot, scale: rng.range(0.7, 1.0), color: rng.pick(BUSHES) });
  else props.rocks.push({ ...spot, scale: rng.range(0.5, 0.8), color: rng.pick(ROCKS) });
}

/** The bushes and boulders collected by bushOrRock, as instanced meshes. */
export function buildProps(props) {
  return [instances('bush', props.bushes), instances('boulder', props.rocks)];
}

/**
 * A little island out at sea: a place to rest while swimming. Some have a treasure chest.
 * Walk off the beach to swim on. Registers as walkable land.
 */
export class SmallIsland extends Entity {
  constructor({ x, z, radius = 8, chest = 0 }, index = 0) {
    super();
    this.center = { x, z };
    this.radius = radius;
    this.chestCoins = chest;
    this.swimFromShore = true;
    const rng = createRng(SEED + 60 + index);
    const props = { bushes: [], rocks: [] };
    for (let i = 0; i < Math.round(radius / 2); i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(1.5, radius - 4);
      bushOrRock(props, rng, x + Math.cos(a) * d, z + Math.sin(a) * d);
    }
    this.object3d.add(islandGround(x, z, radius), ...buildProps(props));
  }

  onAdd(game) {
    game.lands.push(this);
    if (this.chestCoins) game.add(new Chest({ x: this.center.x + 0.5, z: this.center.z - 0.5 }, { coins: this.chestCoins }));
  }

  isInside(x, z, margin = 0) {
    return Math.hypot(x - this.center.x, z - this.center.z) < this.radius - 2 - margin;
  }

  heightAt() {
    return null;
  }
}
