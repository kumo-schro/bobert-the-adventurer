import * as THREE from 'three';
import { Monster } from './Monster.js';
import { part } from '../models/character.js';

// The jungle's monsters: giant Venus fly traps, snakes and gorillas.

const TRAP_NOTICE = 5; // starts opening its mouth when you come this close
const TRAP_BITE_RANGE = 2.8; // the bite reaches this far
const TRAP_WINDUP = 1.4; // seconds the mouth hangs open before it snaps (slow!)
const TRAP_COOLDOWN = 2.4;

/**
 * A giant Venus fly trap. It can't move, and it attacks slowly: its jaws creak open (they glow
 * red), then SNAP shut for 5 hearts if you're still close. One hit defeats it.
 */
export class FlyTrap extends Monster {
  constructor({ x, z }) {
    super({
      x,
      z,
      health: 1,
      damage: 5,
      coins: 6,
      radius: 0.9,
      barHeight: 3.6,
      colors: ['#3fae3a', '#d9293f', '#ffffff'],
      touchDamage: false,
    });
    this.isFlyTrap = true;
    this.windup = 0; // > 0 while the mouth is open, about to snap
    this.cooldown = Math.random();
    this.snap = 0; // jaw closing animation
    this.buildModel();
  }

  buildModel() {
    const green = '#3fae3a';
    const dark = '#2a7a28';
    // Leaves round the base and a thick stem
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = part(this.body, [0.5, 0.12, 1.3], i % 2 ? green : dark, [Math.sin(a) * 0.8, 0.15, Math.cos(a) * 0.8]);
      leaf.rotation.y = a;
    }
    part(this.body, [0.35, 1.6, 0.35], dark, [0, 0.9, 0]);
    // Head: two jaws hinged at the back
    this.head = new THREE.Group();
    this.head.position.set(0, 1.9, 0);
    this.body.add(this.head);
    this.jaws = [1, -1].map((side) => {
      const jaw = new THREE.Group();
      this.head.add(jaw);
      part(jaw, [1.5, 0.35, 1.5], green, [0, side * 0.2, 0.7]);
      const inside = part(jaw, [1.3, 0.06, 1.3], '#d9293f', [0, side * 0.02, 0.7], { emissive: '#ff3b3b' });
      for (let i = 0; i < 6; i++) part(jaw, [0.1, 0.25, 0.1], '#ffffff', [-0.65 + i * 0.26, side * -0.05, 1.45]); // teeth
      for (const sx of [-0.78, 0.78]) part(jaw, [0.06, 0.06, 1.2], '#ffffff', [sx, side * -0.02, 0.7]);
      return { jaw, side, inside };
    });
  }

  think(dt, game, toPlayer) {
    this.velocity.x = this.velocity.z = 0; // rooted to the spot
    this.cooldown -= dt;
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this.bite(game, toPlayer);
    } else if (this.cooldown <= 0 && !toPlayer.playerDown && toPlayer.dist < TRAP_NOTICE && !game.player.swimming) {
      this.windup = TRAP_WINDUP;
    }
  }

  bite(game, toPlayer) {
    this.snap = 1;
    this.cooldown = TRAP_COOLDOWN;
    const player = game.player;
    if (!player.dead && toPlayer.dist < TRAP_BITE_RANGE + this.radius * 0.5) {
      player.takeDamage(game, this.power, this.object3d.position.x, this.object3d.position.z);
    }
    game.particles?.burst(this.object3d.position.clone().setY(2), { count: 10, colors: ['#3fae3a', '#ffffff'], speed: 3, size: 0.12 });
  }

  animate(dt, game) {
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    const turn = Math.atan2(p.x - pos.x, p.z - pos.z) - this.body.rotation.y;
    this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-2 * dt));
    this.snap = Math.max(0, this.snap - dt * 3);
    const open = this.windup > 0 ? Math.min(1, (TRAP_WINDUP - this.windup) / 0.6) : 0;
    for (const { jaw, side, inside } of this.jaws) {
      jaw.rotation.x = -side * (0.12 + open * 0.75);
      inside.material.emissiveIntensity = open * (0.6 + Math.sin(game.elapsed * 20) * 0.3);
    }
    this.head.rotation.x = this.snap * 0.3;
    this.head.position.y = 1.9 + Math.sin(game.elapsed * 1.5 + pos.x) * 0.05;
  }
}

/** A jungle snake: slithers after you and bites for 1 heart. Two hits. */
export class Snake extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 2, damage: 1, coins: 3, radius: 0.5, barHeight: 1, colors: ['#e0c22e', '#2f8f3a', '#1d1d1d'] });
    this.segments = [];
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.phase = Math.random() * 10;
    for (let i = 0; i < 6; i++) {
      const seg = part(this.body, [0.26, 0.2, 0.32], i % 2 ? '#e0c22e' : '#2f8f3a', [0, 0.12, 0.4 - i * 0.28]);
      this.segments.push(seg);
    }
    part(this.segments[0], [0.32, 0.22, 0.3], '#2f8f3a', [0, 0.04, 0.15]); // head
    for (const s of [-1, 1]) part(this.segments[0], [0.06, 0.06, 0.04], '#ff3b3b', [s * 0.1, 0.12, 0.3], { emissive: '#ff3b3b' });
    part(this.segments[0], [0.04, 0.02, 0.18], '#ff4d6d', [0, 0, 0.42]); // tongue
  }

  think(dt, game, toPlayer) {
    let dirX;
    let dirZ;
    let speed = 2.6;
    if (this.chasing(toPlayer, 9, !game.player.swimming)) {
      dirX = toPlayer.x;
      dirZ = toPlayer.z;
    } else {
      const pos = this.object3d.position;
      this.wanderAngle += (Math.random() - 0.5) * 3 * dt;
      dirX = Math.sin(this.wanderAngle) + (this.home.x - pos.x) * 0.15;
      dirZ = Math.cos(this.wanderAngle) + (this.home.z - pos.z) * 0.15;
      const len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;
      speed = 1;
    }
    this.velocity.x = dirX * speed;
    this.velocity.z = dirZ * speed;
  }

  animate(dt, game) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.1) {
      const turn = Math.atan2(this.velocity.x, this.velocity.z) - this.body.rotation.y;
      this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-8 * dt));
    }
    this.phase += dt * (2 + speed * 3);
    this.segments.forEach((seg, i) => (seg.position.x = Math.sin(this.phase - i * 0.9) * 0.12 * i * 0.4));
  }
}

/** A big grumpy gorilla: lumbers after you, pounds its chest, and swats for 2 hearts. Four hits. */
export class Gorilla extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 4, damage: 2, coins: 8, radius: 0.8, barHeight: 2.6, colors: ['#3b3b3b', '#5a4a42', '#ffffff'] });
    this.walkPhase = 0;
    const fur = '#3b3b3b';
    part(this.body, [1.1, 1.1, 0.8], fur, [0, 1.2, 0]); // chest
    part(this.body, [0.7, 0.6, 0.12], '#5a4a42', [0, 1.2, 0.42]); // chest skin
    part(this.body, [0.7, 0.6, 0.6], fur, [0, 2.0, 0.1]); // head
    part(this.body, [0.5, 0.3, 0.12], '#5a4a42', [0, 1.9, 0.42]); // face
    for (const s of [-1, 1]) part(this.body, [0.08, 0.08, 0.04], '#1d1d1d', [s * 0.14, 2.05, 0.42]);
    this.arms = [-1, 1].map((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 0.7, 1.6, 0);
      this.body.add(arm);
      part(arm, [0.36, 1.3, 0.36], fur, [0, -0.6, 0]);
      return arm;
    });
    this.legs = [-1, 1].map((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.3, 0.7, 0);
      this.body.add(leg);
      part(leg, [0.36, 0.7, 0.4], fur, [0, -0.35, 0]);
      return leg;
    });
  }

  think(dt, game, toPlayer) {
    const chasing = this.chasing(toPlayer, 10, !game.player.swimming);
    const speed = chasing ? 2.4 : 0;
    this.velocity.x = chasing ? toPlayer.x * speed : 0;
    this.velocity.z = chasing ? toPlayer.z * speed : 0;
    this.moving = speed;
  }

  animate(dt, game) {
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    const turn = Math.atan2(p.x - pos.x, p.z - pos.z) - this.body.rotation.y;
    this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-4 * dt));
    this.walkPhase += dt * (this.moving ? 6 : 0);
    const s = Math.sin(this.walkPhase) * 0.5;
    this.legs[0].rotation.x = s;
    this.legs[1].rotation.x = -s;
    if (this.moving) {
      this.arms[0].rotation.x = -s;
      this.arms[1].rotation.x = s;
    } else {
      // Chest pounding!
      const pound = Math.sin(game.elapsed * 10) * 0.4;
      this.arms[0].rotation.x = -1.2 + pound;
      this.arms[1].rotation.x = -1.2 - pound;
    }
  }
}
