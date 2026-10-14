import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { part } from '../models/character.js';

const PATROL_SPEED = 1.8;
const CHASE_SPEED = 2.9; // slower than you swim, so you can get away
const CHASE_RANGE = 13;

/**
 * A shark that circles its patch of sea with its fin poking out of the water.
 * Chases swimmers, bites (1 heart), then backs off for a moment. Three hits to defeat.
 */
export class Shark extends Monster {
  constructor({ x, z }) {
    super({
      x,
      z,
      health: 3,
      damage: 1,
      coins: 5,
      radius: 0.9,
      barHeight: 1.5,
      colors: ['#6f8fa8', '#ffffff', '#3cc6ea'],
      aquatic: true,
    });
    this.patrolAngle = Math.random() * Math.PI * 2;
    this.patrolRadius = 6 + Math.random() * 3;
    this.retreatTimer = 0;
    this.buildModel();
  }

  buildModel() {
    const grey = '#6f8fa8';
    const dark = '#4f6d85';
    part(this.body, [0.7, 0.6, 1.8], grey, [0, -0.32, 0]); // body
    part(this.body, [0.6, 0.18, 1.6], '#f4f7fb', [0, -0.6, 0.05]); // white belly
    part(this.body, [0.56, 0.46, 0.5], grey, [0, -0.3, 1.1]); // snout
    part(this.body, [0.46, 0.08, 0.06], '#ffffff', [0, -0.48, 1.36]); // teeth
    part(this.body, [0.12, 0.72, 0.6], dark, [0, 0.32, -0.05]).rotation.x = -0.35; // dorsal fin
    for (const side of [-1, 1]) {
      part(this.body, [0.08, 0.1, 0.04], '#1d1d1d', [side * 0.25, -0.18, 1.3]); // eyes
      const fin = part(this.body, [0.55, 0.08, 0.32], dark, [side * 0.55, -0.5, 0.3]);
      fin.rotation.z = side * -0.3;
    }
    this.tail = new THREE.Group();
    this.tail.position.set(0, -0.32, -0.9);
    this.body.add(this.tail);
    part(this.tail, [0.36, 0.4, 0.6], grey, [0, 0, -0.3]);
    part(this.tail, [0.1, 0.95, 0.32], dark, [0, 0.1, -0.68]); // tail fin
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    const player = game.player;
    this.retreatTimer -= dt;

    let dirX;
    let dirZ;
    let speed = PATROL_SPEED;
    if (this.retreatTimer > 0) {
      dirX = -toPlayer.x;
      dirZ = -toPlayer.z;
    } else if (this.chasing(toPlayer, CHASE_RANGE, player.swimming)) {
      dirX = toPlayer.x;
      dirZ = toPlayer.z;
      speed = CHASE_SPEED;
    } else {
      // Circle around home.
      this.patrolAngle += (PATROL_SPEED / this.patrolRadius) * dt;
      const tx = this.home.x + Math.cos(this.patrolAngle) * this.patrolRadius - pos.x;
      const tz = this.home.z + Math.sin(this.patrolAngle) * this.patrolRadius - pos.z;
      const len = Math.hypot(tx, tz) || 1;
      dirX = tx / len;
      dirZ = tz / len;
    }
    this.velocity.x += (dirX * speed - this.velocity.x) * (1 - Math.exp(-3 * dt));
    this.velocity.z += (dirZ * speed - this.velocity.z) * (1 - Math.exp(-3 * dt));
  }

  /** Chomp! Then swim off for a bit so you can get away. */
  bitPlayer() {
    this.retreatTimer = attackTime(1.5);
  }

  animate(dt, game) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.2) {
      const turn = Math.atan2(this.velocity.x, this.velocity.z) - this.body.rotation.y;
      this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-5 * dt));
    }
    this.tail.rotation.y = Math.sin(game.elapsed * (4 + speed * 2)) * 0.45;
    this.body.position.y = Math.sin(game.elapsed * 1.7 + this.patrolAngle) * 0.06;
  }
}
