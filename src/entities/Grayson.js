import { Npc } from './Npc.js';
import { createFish } from '../models/critters.js';
import { BUFFS, GRAYSON, SEA } from '../config.js';

const DEPTH = SEA.level - SEA.swimDepth; // at the same depth as you when you swim

/**
 * Grayson, a friendly fish. Swim up to him and he gives you a free buff (one you don't have yet),
 * then he swims off and turns up somewhere else in the sea a minute later.
 */
export class Grayson extends Npc {
  constructor(game) {
    // Only spots out in open water (some might be on land if the coast moves).
    const spots = GRAYSON.spots.filter((s) => !game.isWalkable(s.x, s.z, -4));
    super({
      name: 'Grayson',
      createModel: createFish,
      position: { ...spots[0], y: DEPTH },
      interactText: 'Press T to say hi to Grayson the fish',
    });
    this.spots = spots;
    this.spot = 0;
    this.away = 0;
  }

  talk(game) {
    const { player } = game;
    const fresh = Object.keys(BUFFS).filter((id) => id !== 'seconds' && !player.buffs[id]);
    const ids = fresh.length ? fresh : ['fastFins'];
    const id = ids[Math.floor(Math.random() * ids.length)];
    const buff = BUFFS[id];
    player.addBuff(game, id);
    this.state = 'talking';
    game.dialog.show(this.name, [`Blub blub! Hello, friend! Here, have a present: ${buff.icon} ${buff.name}!`, `${buff.description} It lasts five minutes. Look for me again somewhere else in the sea. Bye now!`], {
      focus: this,
      onClose: () => this.swimAway(game),
    });
  }

  swimAway(game) {
    this.state = 'idle';
    game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1), { count: 20, colors: ['#e8fbff', '#bfe6ff', '#ffffff'], speed: 3, size: 0.14, gravity: -4 });
    this.object3d.visible = false;
    this.hidden = true;
    this.collider.x = this.collider.z = 1e6;
    this.away = GRAYSON.awaySeconds;
    // Next time he's somewhere else.
    if (this.spots.length > 1) this.spot = (this.spot + 1 + Math.floor(Math.random() * (this.spots.length - 1))) % this.spots.length;
  }

  update(dt, game) {
    if (this.away > 0 && (this.away -= dt) <= 0) {
      const s = this.spots[this.spot];
      this.object3d.position.set(s.x, DEPTH, s.z);
      this.post = { x: s.x, z: s.z, facing: 0 };
      this.collider.x = s.x;
      this.collider.z = s.z;
      this.object3d.visible = true;
      this.hidden = false;
    }
    if (!this.hidden) super.update(dt, game);
  }
}
