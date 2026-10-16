import * as THREE from 'three';
import { Monster } from './Monster.js';
import { part } from '../models/character.js';

const SPEED = 2.6;
const CHASE_RANGE = 16;
const RISE_TIME = 1.4; // seconds to climb out of the lava

/**
 * A lava monster: a lump of dark rock with glowing cracks, which climbs slowly out of a lava
 * flow on the fire island (they're rare: see FIRE.lavaMonsters), then stomps after you.
 * Four hits; bumping into it burns for 2.
 */
export class LavaMonster extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 4, damage: 2, coins: 6, radius: 0.7, barHeight: 2, colors: ['#ff5a1f', '#ffd23f', '#3b2a2a'], hitSound: 'stone' });
    this.isLavaMonster = true;
    this.rising = RISE_TIME;
    this.walkPhase = 0;
    this.buildModel();
    this.body.position.y = -1.8; // starts down in the lava
  }

  buildModel() {
    const rock = '#3b2f2c';
    const crack = { emissive: '#ff6a1f' };
    part(this.body, [1.1, 1.0, 0.9], rock, [0, 0.95, 0]); // chunky body
    part(this.body, [0.8, 0.6, 0.7], '#4a3a35', [0, 1.65, 0.05]); // head
    for (const [x, y, z, w, h] of [[0, 0.95, 0.46, 0.7, 0.1], [0.2, 1.2, 0.46, 0.1, 0.4], [-0.3, 0.75, 0.46, 0.1, 0.35], [0.56, 1.0, 0, 0.02, 0.5]]) {
      part(this.body, [w, h, 0.04], '#ff7a1f', [x, y, z], crack).material.emissiveIntensity = 1; // glowing cracks
    }
    for (const s of [-1, 1]) {
      part(this.body, [0.16, 0.12, 0.05], '#ffd23f', [s * 0.18, 1.7, 0.41], { emissive: '#ffd23f' }).material.emissiveIntensity = 1.2; // eyes
    }
    this.arms = [-1, 1].map((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 0.7, 1.3, 0);
      this.body.add(arm);
      part(arm, [0.36, 0.8, 0.36], rock, [0, -0.35, 0]);
      part(arm, [0.4, 0.3, 0.4], '#ff5a1f', [0, -0.8, 0], crack).material.emissiveIntensity = 0.8; // molten fists
      return arm;
    });
    this.legs = [-1, 1].map((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.3, 0.5, 0);
      this.body.add(leg);
      part(leg, [0.36, 0.5, 0.4], rock, [0, -0.25, 0]);
      return leg;
    });
  }

  think(dt, game, toPlayer) {
    if (this.rising > 0) {
      // Climbing out of the lava: can't move yet (but you can see it coming).
      this.rising = Math.max(0, this.rising - dt);
      this.body.position.y = -1.8 * (this.rising / RISE_TIME);
      this.velocity.x = this.velocity.z = 0;
      if (Math.random() < dt * 12) {
        const pos = this.object3d.position;
        game.particles?.burst(new THREE.Vector3(pos.x, 0.2, pos.z), { count: 4, colors: ['#ff5a1f', '#ffd23f'], speed: 2.5, size: 0.14, gravity: -3, life: 0.6 });
      }
      return;
    }
    const chasing = this.chasing(toPlayer, CHASE_RANGE, !game.player.swimming);
    const speed = chasing ? SPEED : 0;
    this.velocity.x = chasing ? toPlayer.x * speed : 0;
    this.velocity.z = chasing ? toPlayer.z * speed : 0;
    this.moving = speed;
  }

  animate(dt) {
    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.1) {
      const turn = Math.atan2(this.velocity.x, this.velocity.z) - this.body.rotation.y;
      this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-8 * dt));
    }
    this.walkPhase += dt * (this.moving ? 6 : 0);
    const s = Math.sin(this.walkPhase);
    this.legs[0].rotation.x = s * 0.5;
    this.legs[1].rotation.x = -s * 0.5;
    this.arms[0].rotation.x = -s * 0.4;
    this.arms[1].rotation.x = s * 0.4;
  }
}
