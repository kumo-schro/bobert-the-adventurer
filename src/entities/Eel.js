import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { part } from '../models/character.js';

// The regular eel and its huge cousin, the sea serpent.
const KINDS = {
  eel: { health: 5, damage: 3, scale: 1, segments: 7, swim: 2, lunge: 5, notice: 7, green: '#2f8f5b' },
  serpent: { health: 10, damage: 3, scale: 2, segments: 11, swim: 4, lunge: 7, notice: 16, green: '#2b6f8f' },
};

/**
 * A zappy electric eel guarding the rocks around the tower island. It rears up out of the
 * water, lunges at swimmers and zaps them for 3 hearts. Five hits to defeat.
 * new Eel(spot, { kind: 'serpent' }) is the sea serpent: a big fast eel with 10 hit points.
 */
export class Eel extends Monster {
  constructor({ x, z }, { kind = 'eel' } = {}) {
    const k = KINDS[kind];
    super({
      x,
      z,
      health: k.health,
      damage: k.damage,
      radius: 0.75 * k.scale,
      barHeight: 2.6 * k.scale,
      colors: [k.green, '#ffe94a', '#ffffff'],
      aquatic: true,
    });
    this.kind = k;
    if (kind === 'serpent') this.boss = 'The Sea Serpent';
    this.body.scale.setScalar(k.scale);
    this.lungeTimer = 0;
    this.lungeCooldown = 1;
    this.retreatTimer = 0;
    this.sparkTimer = 0;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.buildModel();
  }

  buildModel() {
    const green = this.kind.green;
    const light = new THREE.Color(green).offsetHSL(0, 0, 0.08).getStyle();
    const stripe = { emissive: '#ffe94a' };
    this.segments = [];
    for (let i = 0; i < this.kind.segments; i++) {
      const seg = new THREE.Group();
      const size = 0.42 - (i / this.kind.segments) * 0.2;
      part(seg, [size, size, 0.5], i % 2 ? light : green, [0, 0, 0]);
      part(seg, [size + 0.02, 0.08, 0.2], '#ffe94a', [0, size / 2, 0], stripe).material.emissiveIntensity = 0.6;
      this.body.add(seg);
      this.segments.push(seg);
    }
    // Head on the first segment
    const head = this.segments[0];
    part(head, [0.5, 0.44, 0.55], green, [0, 0.05, 0.4]);
    part(head, [0.4, 0.12, 0.3], '#d9293f', [0, -0.12, 0.62]); // open mouth
    for (const side of [-1, 1]) {
      part(head, [0.1, 0.1, 0.06], '#ffe94a', [side * 0.17, 0.18, 0.66], { emissive: '#ffe94a' }).material.emissiveIntensity = 1;
      part(head, [0.06, 0.2, 0.18], '#ffe94a', [side * 0.27, 0.22, 0.25], stripe); // frills
    }
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    const hx = this.home.x - pos.x;
    const hz = this.home.z - pos.z;
    const fromHome = Math.hypot(hx, hz);
    const player = game.player;
    this.lungeTimer -= dt;
    this.lungeCooldown -= dt;
    this.retreatTimer -= dt;

    let dirX;
    let dirZ;
    let speed = this.kind.swim;
    const hunting = this.chasing(toPlayer, this.kind.notice, player.swimming);
    if (this.retreatTimer > 0 || (!hunting && fromHome > 4)) {
      dirX = hx / (fromHome || 1);
      dirZ = hz / (fromHome || 1);
    } else if (hunting) {
      dirX = toPlayer.x;
      dirZ = toPlayer.z;
      if (this.lungeTimer <= 0 && this.lungeCooldown <= 0 && toPlayer.dist < 3.5 * this.kind.scale) {
        this.lungeTimer = 0.4;
        this.lungeCooldown = attackTime(2);
      }
      speed = this.lungeTimer > 0 ? this.kind.lunge : this.kind.swim;
    } else {
      this.wanderAngle += (Math.random() - 0.5) * 3 * dt;
      dirX = Math.sin(this.wanderAngle);
      dirZ = Math.cos(this.wanderAngle);
      speed = 1;
    }
    this.velocity.x += (dirX * speed - this.velocity.x) * (1 - Math.exp(-6 * dt));
    this.velocity.z += (dirZ * speed - this.velocity.z) * (1 - Math.exp(-6 * dt));
  }

  /** Zap! Then slither back to the rocks. */
  bitPlayer() {
    this.retreatTimer = attackTime(2);
    this.sparkTimer = 0;
  }

  animate(dt, game) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.2) {
      const turn = Math.atan2(this.velocity.x, this.velocity.z) - this.body.rotation.y;
      this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-6 * dt));
    }
    // Head reared up out of the water, body curving down behind it and wiggling side to side.
    const t = game.elapsed * (3 + speed);
    const rear = this.lungeTimer > 0 ? 1.9 : 1.5;
    this.segments.forEach((seg, i) => {
      const k = i / (this.kind.segments - 1);
      seg.position.set(Math.sin(t - i * 0.9) * 0.22 * k, rear * (1 - k) ** 1.6 - 0.1, -i * 0.42 + 0.4);
      seg.rotation.x = -0.6 * (1 - k) ** 2;
    });

    // Crackling sparks.
    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.sparkTimer = 0.3 + Math.random() * 0.4;
      const p = this.object3d.position.clone();
      p.y += rear;
      game.particles?.burst(p, { count: 3, colors: ['#ffe94a', '#ffffff'], speed: 2.5, size: 0.08, life: 0.3 });
    }
  }
}
