import * as THREE from 'three';
import { Monster } from './Monster.js';
import { part, bakeParts } from '../models/character.js';

const FLY_SPEED = 3.2;
const WAKE_RANGE = 9;

const STONE = '#8d8f96';
const DARK = '#5f6268';

/**
 * A little stone gargoyle perched on the sea tower. Sits still like a statue until you come
 * close, then flaps after you and nips for 1 heart. Very weak: one hit breaks it.
 * `y` is the height of its perch.
 */
export class Gargoyle extends Monster {
  constructor({ x, y, z }) {
    super({
      x,
      y,
      z,
      health: 1,
      damage: 1,
      coins: 2,
      radius: 0.5,
      barHeight: 1.3,
      colors: [STONE, DARK, '#ff4d4d'],
      flying: true,
    });
    this.awake = false;
    this.retreatTimer = 0;
    this.flap = Math.random() * 10;
    this.buildModel();
  }

  buildModel() {
    part(this.body, [0.55, 0.5, 0.5], STONE, [0, 0.35, 0]); // body
    part(this.body, [0.42, 0.38, 0.4], STONE, [0, 0.75, 0.12]); // head
    part(this.body, [0.3, 0.16, 0.18], DARK, [0, 0.66, 0.36]); // snout
    for (const side of [-1, 1]) {
      part(this.body, [0.08, 0.22, 0.08], DARK, [side * 0.15, 1.02, 0.05]).rotation.z = side * -0.4; // horns
      part(this.body, [0.1, 0.08, 0.04], '#3b3b3b', [side * 0.1, 0.8, 0.33]); // eyes (glow when awake)
      part(this.body, [0.12, 0.2, 0.14], DARK, [side * 0.18, 0.08, 0.12]); // feet
    }
    this.eyes = this.body.children.filter((c) => c.position.z === 0.33);
    for (const eye of this.eyes) {
      eye.material.emissive.set('#ff3b3b');
      eye.userData.keep = true; // they light up when it wakes
    }
    this.wings = [-1, 1].map((side) => {
      const wing = new THREE.Group();
      wing.position.set(side * 0.25, 0.55, -0.1);
      part(wing, [0.7, 0.06, 0.45], DARK, [side * 0.38, 0, 0]);
      part(wing, [0.4, 0.05, 0.3], STONE, [side * 0.8, 0.02, -0.05]);
      this.body.add(wing);
      return { wing, side };
    });
    part(this.body, [0.1, 0.1, 0.4], DARK, [0, 0.25, -0.4]); // tail
    bakeParts(this.body);
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    const player = game.player;
    const p = player.object3d.position;
    const target = new THREE.Vector3(p.x, p.y + 1, p.z);
    const toTarget = target.clone().sub(pos);
    const dist3 = toTarget.length();
    this.retreatTimer -= dt;
    this.awake = this.chasing({ ...toPlayer, dist: dist3 }, WAKE_RANGE);

    let goal;
    if (!this.awake) goal = this.home;
    else if (this.retreatTimer > 0) goal = pos.clone().add(new THREE.Vector3(-toPlayer.x * 3, 2, -toPlayer.z * 3));
    else goal = target;

    const to = goal.clone().sub(pos);
    const d = to.length();
    if (d < 0.1) {
      this.velocity.set(0, 0, 0);
      return;
    }
    const speed = this.awake ? FLY_SPEED : 2;
    this.velocity.lerp(to.multiplyScalar(Math.min(speed, d * 3) / d), 1 - Math.exp(-4 * dt));
  }

  bitPlayer() {
    this.retreatTimer = 1.2;
  }

  animate(dt, game) {
    const perched = !this.awake && this.object3d.position.distanceTo(this.home) < 0.2;
    for (const eye of this.eyes) eye.material.emissiveIntensity = this.awake ? 1 : 0;
    this.flap += dt * (perched ? 0 : 14);
    for (const { wing, side } of this.wings) {
      wing.rotation.z = perched ? side * 0.9 : side * Math.sin(this.flap) * 0.7; // folded when sitting
    }
    // Face the way it's flying (or the player, when close).
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    const look = this.awake ? Math.atan2(p.x - pos.x, p.z - pos.z) : this.perchFacing ?? 0;
    const turn = look - this.body.rotation.y;
    this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-6 * dt));
  }
}
