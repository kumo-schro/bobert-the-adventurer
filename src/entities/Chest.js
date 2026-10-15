import { Entity } from '../core/Entity.js';
import { createChest } from '../models/gear.js';

const OPEN_RANGE = 1.9;

/**
 * A treasure chest. Walk up and press T to open it for coins.
 * Set `onOpen()` to do something extra (like finishing a quest).
 */
export class Chest extends Entity {
  constructor({ x, z }, { coins = 15, facing = 0 } = {}) {
    super();
    this.object3d.position.set(x, 0, z);
    this.object3d.rotation.y = facing;
    this.model = createChest();
    this.object3d.add(this.model.root);
    this.coins = coins;
    this.opened = false;
    this.lidAngle = 0;
    this.onOpen = null;
    this.collider = { x, z, halfX: 0.55, halfZ: 0.55, sound: 'wood' };
  }

  onAdd(game) {
    game.colliders.push(this.collider);
    game.particles?.burst(this.object3d.position.clone().setY(0.6), { count: 20, colors: ['#ffe08a', '#ffffff'], speed: 4, size: 0.12 });
  }

  onRemove(game) {
    game.colliders.splice(game.colliders.indexOf(this.collider), 1);
  }

  open(game) {
    this.opened = true;
    game.sound?.play('chest');
    const top = this.object3d.position.clone().setY(1);
    game.particles?.burst(top, { count: 30, colors: ['#ffc93c', '#ffe08a', '#f0a500'], speed: 6, size: 0.16, life: 1.2 });
    if (this.coins) {
      game.player.addCoins(this.coins);
      game.questLog?.toast(`You found ${this.coins} gold coins!`);
    }
    this.onOpen?.();
  }

  update(dt, game) {
    this.lidAngle += ((this.opened ? -1.9 : 0) - this.lidAngle) * (1 - Math.exp(-6 * dt));
    this.model.lid.rotation.x = this.lidAngle;

    if (this.opened) return;
    const d = game.player.object3d.position.distanceTo(this.object3d.position);
    if (d < OPEN_RANGE) game.dialog.offerInteraction('Press T to open the chest', d, () => this.open(game));
  }
}
