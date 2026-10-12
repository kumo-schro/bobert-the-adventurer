import { Entity } from '../core/Entity.js';
import { createArtifact } from '../models/gear.js';

const PICKUP_DISTANCE = 1.6;

/**
 * The precious artifact lying on the ground, floating and sparkling.
 * Walk into it to pick it up; calls `onPickup()`.
 */
export class Artifact extends Entity {
  constructor(position) {
    super();
    this.object3d.position.copy(position).setY(0);
    this.model = createArtifact();
    this.model.scale.setScalar(1.6);
    this.object3d.add(this.model);
    this.onPickup = null;
    this.age = 0;
    this.sparkleTimer = 0;
  }

  update(dt, game) {
    this.age += dt;
    // Pop up out of the slime, then hover.
    const rise = Math.min(1, this.age * 2);
    this.model.position.y = rise * (0.7 + Math.sin(this.age * 2.5) * 0.15);
    this.model.rotation.y += dt * 1.5;

    this.sparkleTimer -= dt;
    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = 0.12;
      const p = this.object3d.position.clone();
      p.y = this.model.position.y + 1;
      game.particles?.burst(p, { count: 1, colors: ['#ffe08a', '#e4c4ff'], speed: 1.5, size: 0.1, life: 0.8, gravity: -1 });
    }

    const player = game.player.object3d.position;
    if (game.player.dead) return;
    if (this.age > 0.6 && player.distanceTo(this.object3d.position) < PICKUP_DISTANCE) {
      game.particles?.burst(this.object3d.position.clone().setY(1), {
        count: 30,
        colors: ['#ffc93c', '#c78bff', '#ffffff'],
        speed: 5,
        size: 0.15,
      });
      game.remove(this);
      this.onPickup?.();
    }
  }
}
