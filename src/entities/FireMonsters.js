import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { part } from '../models/character.js';

const shine = (mesh, intensity) => {
  mesh.material.emissiveIntensity = intensity;
  return mesh;
};

/**
 * An ember bat: a little dark bat with glowing orange wings. It flutters around its roost on the
 * fire island, swoops at you, nips (1 damage), then flies off before coming back. Two hits.
 */
export class EmberBat extends Monster {
  constructor({ x, z }) {
    super({ x, z, y: 3, health: 2, damage: 1, radius: 0.45, barHeight: 1, colors: ['#ff7a1f', '#2b1d1d', '#ffd23f'], flying: true, hitSound: 'squish' });
    this.phase = Math.random() * 10;
    this.retreatTimer = 0;
    part(this.body, [0.45, 0.4, 0.5], '#2b1d1d', [0, 0, 0]);
    part(this.body, [0.3, 0.3, 0.3], '#3b2a2a', [0, 0.2, 0.25]); // head
    for (const s of [-1, 1]) {
      shine(part(this.body, [0.08, 0.08, 0.04], '#ffd23f', [s * 0.08, 0.25, 0.41], { emissive: '#ffd23f' }), 1.4); // eyes
      part(this.body, [0.06, 0.16, 0.06], '#2b1d1d', [s * 0.1, 0.42, 0.22]); // ears
    }
    this.wings = [-1, 1].map((s) => {
      const wing = new THREE.Group();
      wing.position.set(s * 0.2, 0.05, 0);
      this.body.add(wing);
      shine(part(wing, [0.7, 0.05, 0.45], '#ff7a1f', [s * 0.38, 0, 0], { emissive: '#ff5a1f' }), 0.8);
      return wing;
    });
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    const p = game.player.object3d.position;
    this.retreatTimer -= dt;
    const target = new THREE.Vector3(p.x, p.y + 1, p.z);
    const chasing = this.chasing({ ...toPlayer, dist: pos.distanceTo(target) }, 12);
    let goal;
    if (!chasing) {
      // Flutter in circles around the roost.
      const a = game.elapsed * 1.4 + this.phase;
      goal = this.home.clone().add(new THREE.Vector3(Math.sin(a) * 3, Math.sin(a * 2) * 0.6, Math.cos(a) * 3));
    } else if (this.retreatTimer > 0) goal = pos.clone().add(new THREE.Vector3(-toPlayer.x * 4, 2.5, -toPlayer.z * 4));
    else goal = target;
    const to = goal.sub(pos);
    const d = to.length() || 1;
    this.velocity.lerp(to.multiplyScalar(Math.min(4.5, d * 2) / d), 1 - Math.exp(-3 * dt));
  }

  bitPlayer() {
    this.retreatTimer = attackTime(1.6);
  }

  animate(dt, game) {
    const flap = Math.sin(game.elapsed * 18 + this.phase) * 0.7;
    this.wings[0].rotation.z = flap;
    this.wings[1].rotation.z = -flap;
    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.2) this.body.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
  }
}

/** A magma slime: a hopping blob of molten rock with a dark crust. Three hits; it burns for 2. */
export class MagmaSlime extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 3, damage: 2, radius: 0.6, barHeight: 1.4, colors: ['#ff5a1f', '#ffd23f', '#2b2422'], hitSound: 'squish' });
    this.hopTimer = Math.random() * 2;
    this.shape = new THREE.Group();
    this.body.add(this.shape);
    shine(part(this.shape, [1.0, 0.75, 1.0], '#ff6a1f', [0, 0.38, 0], { emissive: '#ff4a12' }), 0.7);
    part(this.shape, [1.05, 0.2, 1.05], '#2b2422', [0, 0.72, 0]); // a dark crust on top
    part(this.shape, [0.3, 0.12, 0.3], '#2b2422', [0.25, 0.35, 0.5]);
    for (const s of [-1, 1]) part(this.shape, [0.14, 0.18, 0.04], '#1d1d1d', [s * 0.2, 0.5, 0.51]); // eyes
  }

  think(dt, game, toPlayer) {
    this.hopTimer -= dt;
    if (!this.onGround || this.hopTimer > 0) return;
    const chasing = this.chasing(toPlayer, 10, !game.player.swimming);
    const a = Math.random() * Math.PI * 2;
    const dirX = chasing ? toPlayer.x : Math.cos(a) * 0.4;
    const dirZ = chasing ? toPlayer.z : Math.sin(a) * 0.4;
    this.velocity.set(dirX * 3.4, 6.5, dirZ * 3.4);
    this.onGround = false;
    this.hopTimer = chasing ? 0.8 : 2.4;
  }

  landed() {
    this.squash = 1;
  }

  animate(dt) {
    this.squash = Math.max(0, (this.squash ?? 0) - dt * 4);
    const sy = this.onGround ? 1 - this.squash * 0.35 : 1.15;
    this.shape.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  }
}

const POUND_WINDUP = 0.8;
const POUND_RADIUS = 2.8;

/**
 * An obsidian golem: big, slow and tough (8 hits). When you get close it raises its fists, a red
 * circle shows on the ground, and it POUNDS the ground (3 damage to anyone in the circle).
 */
export class ObsidianGolem extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 8, damage: 3, radius: 0.9, barHeight: 3, colors: ['#1d1a24', '#ff5a1f', '#4a4258'], hitSound: 'stone', touchDamage: false });
    this.walkPhase = 0;
    this.poundTimer = 0;
    this.cooldown = 1;
    const rock = '#1d1a24';
    const edge = '#4a4258';
    part(this.body, [1.5, 1.4, 1.0], rock, [0, 1.8, 0]);
    part(this.body, [1.55, 0.15, 1.05], edge, [0, 2.5, 0]);
    part(this.body, [0.8, 0.7, 0.7], edge, [0, 2.85, 0.1]); // head
    for (const s of [-1, 1]) shine(part(this.body, [0.16, 0.1, 0.04], '#ff7a1f', [s * 0.18, 2.9, 0.46], { emissive: '#ff5a1f' }), 1.5);
    shine(part(this.body, [0.5, 0.5, 0.04], '#ff6a1f', [0, 1.9, 0.51], { emissive: '#ff4a12' }), 0.9); // a glowing heart
    this.arms = [-1, 1].map((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 1.0, 2.3, 0);
      this.body.add(arm);
      part(arm, [0.55, 1.3, 0.55], rock, [0, -0.6, 0]);
      part(arm, [0.7, 0.6, 0.7], edge, [0, -1.4, 0]); // fists
      return arm;
    });
    this.legs = [-1, 1].map((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.45, 1.1, 0);
      this.body.add(leg);
      part(leg, [0.6, 1.1, 0.6], rock, [0, -0.55, 0]);
      return leg;
    });
    this.warning = new THREE.Mesh(
      new THREE.CircleGeometry(POUND_RADIUS, 24),
      new THREE.MeshBasicMaterial({ color: '#ff3b1f', transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.warning.rotation.x = -Math.PI / 2;
    this.warning.position.y = 0.06;
    this.warning.visible = false;
    this.object3d.add(this.warning);
  }

  think(dt, game, toPlayer) {
    this.cooldown -= dt;
    this.moving = 0;
    if (this.poundTimer > 0) {
      this.velocity.x = this.velocity.z = 0;
      this.poundTimer -= dt;
      if (this.poundTimer <= 0) this.pound(game);
      return;
    }
    const chasing = this.chasing(toPlayer, 12, !game.player.swimming);
    if (chasing && toPlayer.dist < POUND_RADIUS && this.cooldown <= 0) {
      this.poundTimer = POUND_WINDUP;
      this.warning.visible = true;
      return;
    }
    const speed = chasing && toPlayer.dist > 1.5 ? 1.4 : 0;
    this.velocity.x = toPlayer.x * speed;
    this.velocity.z = toPlayer.z * speed;
    this.moving = speed;
  }

  pound(game) {
    this.warning.visible = false;
    this.cooldown = attackTime(2.2);
    const pos = this.object3d.position;
    const player = game.player;
    const p = player.object3d.position;
    game.particles?.burst(new THREE.Vector3(pos.x, 0.2, pos.z), { count: 30, colors: ['#4a4258', '#ff7a1f', '#1d1a24'], speed: 6, size: 0.2, up: 0.5 });
    game.cameraRig?.shake(0.3);
    game.sound?.play('thump', { volume: 1.5 });
    if (!player.dead && !player.swimming && Math.hypot(p.x - pos.x, p.z - pos.z) < POUND_RADIUS && p.y < 1) player.takeDamage(game, this.power, pos.x, pos.z);
  }

  defeat(game) {
    this.warning.visible = false;
    super.defeat(game);
  }

  animate(dt, game) {
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    if (this.moving || this.poundTimer > 0) this.body.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
    this.walkPhase += dt * (this.moving ? 4 : 0);
    const s = Math.sin(this.walkPhase);
    this.legs[0].rotation.x = s * 0.4;
    this.legs[1].rotation.x = -s * 0.4;
    // Fists raised high while winding up the pound.
    const raise = this.poundTimer > 0 ? -2.8 : -s * 0.3;
    for (const arm of this.arms) arm.rotation.x += (raise - arm.rotation.x) * (1 - Math.exp(-10 * dt));
  }
}

