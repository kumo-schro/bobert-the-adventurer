import { Entity } from '../core/Entity.js';
import { part } from '../models/character.js';

/** One of Master Jackson's training posts: only a Sky Strike can smash it. */
export class TrainingPost extends Entity {
  constructor({ x, z }, onBroken) {
    super();
    this.object3d.position.set(x, 0, z);
    this.collider = { x, z, radius: 0.4, sound: 'wood' };
    this.onBroken = onBroken;
    part(this.object3d, [0.6, 1.8, 0.6], '#b5713f', [0, 0.9, 0]);
    part(this.object3d, [0.66, 0.2, 0.66], '#d9293f', [0, 1.3, 0]);
    part(this.object3d, [0.66, 0.2, 0.66], '#d9293f', [0, 0.5, 0]);
  }

  onAdd(game) {
    game.colliders.push(this.collider);
  }

  onRemove(game) {
    const i = game.colliders.indexOf(this.collider);
    if (i >= 0) game.colliders.splice(i, 1);
  }


  onSkyStrike(game, at, radius) {
    const p = this.object3d.position;
    if (Math.hypot(at.x - p.x, at.z - p.z) > radius + 0.4) return;
    game.particles?.burst(p.clone().setY(1), { count: 30, colors: ['#b5713f', '#e0b98a', '#d9293f'], speed: 7, size: 0.2 });
    game.remove(this);
    this.onBroken?.();
  }
}
