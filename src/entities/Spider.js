import * as THREE from 'three';
import { Monster } from './Monster.js';
import { part } from '../models/character.js';

const SPEED = 2.3;
const CHASE_RANGE = 8;

/** A cave spider: scuttles toward you when you get close. Takes two hits. */
export class Spider extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 2, radius: 0.55, barHeight: 1.3, colors: ['#5b3a8c', '#2b1d40', '#ff4d6d'] });
    this.legs = [];
    this.walkPhase = Math.random() * 10;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.buildModel();
  }

  buildModel() {
    const purple = '#5b3a8c';
    const dark = '#2b1d40';
    part(this.body, [0.7, 0.42, 0.8], purple, [0, 0.45, -0.15]); // abdomen
    part(this.body, [0.5, 0.36, 0.42], dark, [0, 0.42, 0.42]); // head
    part(this.body, [0.3, 0.1, 0.3], '#ff9f43', [0, 0.68, -0.2]); // orange stripe
    for (const side of [-1, 1]) {
      part(this.body, [0.1, 0.1, 0.04], '#ff3b3b', [side * 0.12, 0.5, 0.64], { emissive: '#ff3b3b' }); // eyes
      part(this.body, [0.07, 0.07, 0.04], '#ff3b3b', [side * 0.2, 0.42, 0.64], { emissive: '#ff3b3b' });
      for (let i = 0; i < 4; i++) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.3, 0.45, 0.3 - i * 0.22);
        hip.rotation.y = side * (0.3 - i * 0.35);
        part(hip, [0.5, 0.08, 0.08], dark, [side * 0.25, 0.08, 0]); // upper leg
        part(hip, [0.08, 0.45, 0.08], dark, [side * 0.48, -0.15, 0]); // lower leg
        this.body.add(hip);
        this.legs.push({ hip, side, phase: i * 1.6 });
      }
    }
  }

  think(dt, game, toPlayer) {
    let dirX;
    let dirZ;
    let speed = SPEED;
    if (this.chasing(toPlayer, CHASE_RANGE, !game.player.swimming)) {
      dirX = toPlayer.x;
      dirZ = toPlayer.z;
    } else {
      // Mosey around home.
      const pos = this.object3d.position;
      const hx = this.home.x - pos.x;
      const hz = this.home.z - pos.z;
      this.wanderAngle += (Math.random() - 0.5) * 4 * dt;
      dirX = Math.sin(this.wanderAngle) + hx * 0.2;
      dirZ = Math.cos(this.wanderAngle) + hz * 0.2;
      const len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;
      speed = 1.2;
    }
    this.velocity.x = dirX * speed;
    this.velocity.z = dirZ * speed;
    this.moving = speed;
  }

  animate(dt) {
    const speed = this.moving ?? 0;
    if (speed > 0.1) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      const turn = target - this.body.rotation.y;
      this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-10 * dt));
    }
    this.walkPhase += dt * speed * 5;
    for (const leg of this.legs) {
      leg.hip.rotation.z = Math.sin(this.walkPhase + leg.phase) * 0.35 * leg.side;
    }
  }
}
