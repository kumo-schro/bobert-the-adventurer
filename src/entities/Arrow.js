import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { colliderAt } from '../core/collision.js';
import { createArrow } from '../models/gear.js';
import { BOW, SEA } from '../config.js';

export const ARROW_GRAVITY = 3;

/**
 * An arrow from the player's bow. Flies straight-ish, hits the first monster it touches,
 * and stops when it hits a tree, a wall or the ground.
 */
export class Arrow extends Entity {
  /** `velocity` is a Vector3; aim with Arrow.aim() to hit a target. */
  constructor(position, velocity, damage = BOW.damage) {
    super();
    this.damage = damage;
    this.object3d.position.copy(position);
    this.velocity = velocity.clone();
    this.object3d.add(createArrow(damage > 1));
    this.travelled = 0;
    this.stuck = 0; // > 0 once it has hit something: sits there for a moment, then vanishes
  }

  update(dt, game) {
    if (this.stuck > 0) {
      if ((this.stuck -= dt) <= 0) game.remove(this);
      return;
    }

    const pos = this.object3d.position;
    this.velocity.y -= ARROW_GRAVITY * dt;
    pos.addScaledVector(this.velocity, dt);
    this.travelled += BOW.speed * dt;
    this.object3d.lookAt(pos.x + this.velocity.x, pos.y + this.velocity.y, pos.z + this.velocity.z);

    for (const monster of game.monsters) {
      const m = monster.object3d.position;
      if (Math.hypot(m.x - pos.x, m.z - pos.z) < monster.radius + 0.35 && pos.y < m.y + monster.radius * 2 + 1) {
        const speed = Math.hypot(this.velocity.x, this.velocity.z);
        monster.hit(game, { x: -this.velocity.x / speed, z: -this.velocity.z / speed }, this.damage);
        game.remove(this);
        return;
      }
    }

    const ground = game.isWalkable(pos.x, pos.z) ? game.heightAt(pos.x, pos.z) : SEA.level;
    const blocked = colliderAt(pos.x, pos.z, game.colliders, (c) => c === game.player.collider || c.isMonster);
    if (pos.y <= ground || blocked) {
      this.stuck = 1.5; // thunk!
      return;
    }
    if (this.travelled > BOW.range) game.remove(this);
  }

  /**
   * The velocity that takes an arrow from `from` to `to` (allowing for it dropping a little),
   * or, with no target, straight ahead along `heading` (radians).
   */
  static aim(from, to, heading) {
    if (!to) return new THREE.Vector3(Math.sin(heading), 0.04, Math.cos(heading)).normalize().multiplyScalar(BOW.speed);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const t = d / BOW.speed;
    const vy = (to.y - from.y) / t + 0.5 * ARROW_GRAVITY * t;
    return new THREE.Vector3((dx / d) * BOW.speed, vy, (dz / d) * BOW.speed);
  }
}
