import * as THREE from 'three';
import { Monster } from './Monster.js';
import { part } from '../models/character.js';

const FLOAT_SPEED = 2.6;

/** Run `fn` after `seconds` of game time (a tiny helper entity counts down). */
function setTimeoutGame(game, seconds, fn) {
  game.add({
    object3d: new THREE.Group(),
    left: seconds,
    onAdd() {},
    onRemove() {},
    update(dt) {
      if ((this.left -= dt) <= 0) {
        game.remove(this);
        fn();
      }
    },
  });
}
const NOTICE = 10;

/**
 * A nightmare wisp from the dream dimension: a little glowing ghost that drifts after you
 * and stings for 1 heart. Two hits.
 */
export class Wisp extends Monster {
  constructor({ x, y, z }) {
    super({ x, y, z, health: 2, damage: 1, radius: 0.5, barHeight: 1.3, colors: ['#b47dff', '#ffffff', '#3b1d6e'], flying: true });
    this.phase = Math.random() * 10;
    this.retreatTimer = 0;
    const glow = part(this.body, [0.7, 0.8, 0.7], '#c8a8ff', [0, 0.5, 0], { emissive: '#b47dff' });
    glow.material.transparent = true;
    glow.material.opacity = 0.8;
    glow.material.emissiveIntensity = 0.8;
    part(this.body, [0.5, 0.3, 0.5], '#c8a8ff', [0, 0, 0], { emissive: '#b47dff' }).material.emissiveIntensity = 0.6; // wispy tail
    for (const s of [-1, 1]) part(this.body, [0.14, 0.18, 0.04], '#2a1a4a', [s * 0.15, 0.6, 0.36]); // eyes
    part(this.body, [0.2, 0.08, 0.04], '#2a1a4a', [0, 0.38, 0.36]); // mouth
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    const p = game.player.object3d.position;
    this.retreatTimer -= dt;
    const target = new THREE.Vector3(p.x, p.y + 1, p.z);
    const chasing = this.chasing({ ...toPlayer, dist: pos.distanceTo(target) }, NOTICE);
    let goal;
    if (!chasing) goal = this.home.clone().add(new THREE.Vector3(Math.sin(game.elapsed + this.phase) * 2, Math.sin(game.elapsed * 1.3) * 0.5, Math.cos(game.elapsed + this.phase) * 2));
    else if (this.retreatTimer > 0) goal = pos.clone().add(new THREE.Vector3(-toPlayer.x * 3, 1.5, -toPlayer.z * 3));
    else goal = target;
    const to = goal.sub(pos);
    const d = to.length() || 1;
    this.velocity.lerp(to.multiplyScalar(Math.min(FLOAT_SPEED, d * 2) / d), 1 - Math.exp(-3 * dt));
  }

  /** Wandering wisps (not quest ones) float back a while after they're popped. */
  defeat(game) {
    const make = this.respawn;
    if (make) {
      const { x, y, z } = this.home;
      setTimeoutGame(game, this.respawnSeconds, () => make({ x, y, z }));
    }
    super.defeat(game);
  }

  bitPlayer() {
    this.retreatTimer = 1.2;
  }

  animate(dt, game) {
    this.body.position.y = Math.sin(game.elapsed * 3 + this.phase) * 0.15;
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    this.body.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
  }
}
