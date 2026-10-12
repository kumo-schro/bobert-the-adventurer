import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { createGem } from '../models/gear.js';

const PICKUP_DISTANCE = 1.3;

/**
 * A floating gem with a tall beam of light so it can be spotted from far away.
 * Walk into it to collect it; calls `onCollect()`.
 * Pass `y` to float it above the ground (on a tower...) and `model` to show something other than a gem.
 */
export class Collectible extends Entity {
  constructor({ x, z, y = 0 }, { color = '#3fd0ff', model = null } = {}) {
    super();
    this.object3d.position.set(x, y, z);
    this.color = color;
    this.gem = model ?? createGem(color);
    this.object3d.add(this.gem);

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 14, 0.3),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    beam.position.y = 7;
    this.object3d.add(beam);
    this.onCollect = null;
    this.age = Math.random() * 10;
  }

  update(dt, game) {
    this.age += dt;
    this.gem.position.y = 0.9 + Math.sin(this.age * 2.5) * 0.15;
    this.gem.rotation.y += dt * 2;

    const player = game.player;
    // Close enough sideways, and roughly at the same height (swimmers are low in the water).
    const p = player.object3d.position;
    const o = this.object3d.position;
    const near = Math.hypot(p.x - o.x, p.z - o.z) < PICKUP_DISTANCE && Math.abs(p.y + 0.5 - o.y) < 2.2;
    if (!player.dead && near) {
      game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1), {
        count: 30,
        colors: [this.color, '#ffffff', '#ffe08a'],
        speed: 5,
        size: 0.14,
      });
      game.remove(this);
      this.onCollect?.();
    }
  }
}
