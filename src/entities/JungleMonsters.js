import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { part } from '../models/character.js';

// The jungle's monsters: giant Venus fly traps, snakes and gorillas.

const TRAP_NOTICE = 5; // starts opening its mouth when you come this close
const TRAP_BITE_RANGE = 2.8; // the bite reaches this far
const TRAP_WINDUP = 1.4; // seconds the mouth hangs open before it snaps (slow!)
const TRAP_COOLDOWN = attackTime(2.4);

/**
 * A giant Venus fly trap. It can't move, and it attacks slowly: its jaws creak open (they glow
 * red), then SNAP shut for 5 hearts if you're still close. One hit defeats it.
 */
export class FlyTrap extends Monster {
  constructor({ x, z }) {
    super({
      hitSound: 'squish',
      x,
      z,
      health: 1,
      damage: 5,
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
    super({ x, z, health: 2, damage: 1, radius: 0.5, barHeight: 1, colors: ['#e0c22e', '#2f8f3a', '#1d1d1d'] });
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
    super({ x, z, health: 4, damage: 2, radius: 0.8, barHeight: 2.6, colors: ['#3b3b3b', '#5a4a42', '#ffffff'] });
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

/** A poison dart frog: hops after you like a little slime and nips for 1 heart. Two hits. */
export class Frog extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 2, damage: 1, radius: 0.45, barHeight: 1, colors: ['#3fd0ff', '#1d1d1d', '#ffd23f'], hitSound: 'squish' });
    this.hopTimer = Math.random();
    const color = ['#3fd0ff', '#ff3b8d', '#ffd23f'][Math.floor(Math.random() * 3)];
    part(this.body, [0.6, 0.35, 0.7], color, [0, 0.25, 0]);
    part(this.body, [0.5, 0.06, 0.5], '#1d1d1d', [0, 0.44, -0.05]); // spots
    for (const s of [-1, 1]) {
      part(this.body, [0.16, 0.16, 0.16], '#ffffff', [s * 0.2, 0.48, 0.25]); // big eyes
      part(this.body, [0.08, 0.08, 0.06], '#1d1d1d', [s * 0.2, 0.5, 0.33]);
      part(this.body, [0.18, 0.12, 0.4], color, [s * 0.35, 0.1, -0.1]); // legs
    }
  }

  think(dt, game, toPlayer) {
    this.hopTimer -= dt;
    if (!this.onGround || this.hopTimer > 0) return;
    const chasing = this.chasing(toPlayer, 8, !game.player.swimming);
    const a = Math.random() * Math.PI * 2;
    const dirX = chasing ? toPlayer.x : Math.cos(a) * 0.4;
    const dirZ = chasing ? toPlayer.z : Math.sin(a) * 0.4;
    this.velocity.set(dirX * 3.2, 6, dirZ * 3.2);
    this.onGround = false;
    this.hopTimer = chasing ? 0.9 : 2.2;
  }

  animate(dt) {
    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.2) {
      const turn = Math.atan2(this.velocity.x, this.velocity.z) - this.body.rotation.y;
      this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-10 * dt));
    }
    const sy = this.onGround ? 1 : 1.2;
    this.body.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  }
}

/** A sleek black panther: prowls fast and swipes for 2 hearts. Three hits. */
export class Panther extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 3, damage: 2, radius: 0.7, barHeight: 1.6, colors: ['#1d1d1d', '#3b3b3b', '#ffd23f'] });
    this.walkPhase = 0;
    const black = '#202028';
    part(this.body, [0.6, 0.6, 1.5], black, [0, 0.75, 0]); // body
    part(this.body, [0.5, 0.45, 0.5], black, [0, 0.95, 0.9]); // head
    for (const s of [-1, 1]) {
      part(this.body, [0.1, 0.06, 0.04], '#ffd23f', [s * 0.12, 1.02, 1.16], { emissive: '#ffd23f' }); // glowing eyes
      part(this.body, [0.12, 0.14, 0.08], black, [s * 0.16, 1.24, 0.85]); // ears
    }
    part(this.body, [0.12, 0.12, 0.9], black, [0, 0.95, -1.1]).rotation.x = -0.5; // tail
    this.legs = [];
    for (const [x, z] of [[-0.22, 0.55], [0.22, 0.55], [-0.22, -0.55], [0.22, -0.55]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.55, z);
      this.body.add(leg);
      part(leg, [0.18, 0.55, 0.2], black, [0, -0.27, 0]);
      this.legs.push(leg);
    }
  }

  think(dt, game, toPlayer) {
    const chasing = this.chasing(toPlayer, 11, !game.player.swimming);
    const speed = chasing ? 3.4 : 0;
    this.velocity.x = chasing ? toPlayer.x * speed : 0;
    this.velocity.z = chasing ? toPlayer.z * speed : 0;
    this.moving = speed;
  }

  animate(dt) {
    if (this.moving) {
      const turn = Math.atan2(this.velocity.x, this.velocity.z) - this.body.rotation.y;
      this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-8 * dt));
    }
    this.walkPhase += dt * (this.moving ? 9 : 0);
    this.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(this.walkPhase + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.5 : 0)) * 0.6));
  }
}

const VINE_GREEN = '#2e7d32';
const VINE_DARK = '#1b5e20';
const vineWarning = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.4, depthWrite: false });

/** One of the Viniac's huge arms: a chain of thorny segments. */
function vineArm(parent, length) {
  const root = new THREE.Group();
  parent.add(root);
  const joints = [];
  let at = root;
  for (let i = 0; i < length; i++) {
    const joint = new THREE.Group();
    joint.position.y = i === 0 ? 0 : 0.9;
    at.add(joint);
    const t = 0.7 * (1 - (i / length) * 0.6);
    part(joint, [t, 1, t], i % 2 ? VINE_GREEN : VINE_DARK, [0, 0.45, 0]);
    part(joint, [0.1, 0.25, 0.1], '#e8e0c0', [t / 2 + 0.05, 0.5, 0]).rotation.z = -0.6; // thorns
    part(joint, [0.1, 0.25, 0.1], '#e8e0c0', [-t / 2 - 0.05, 0.3, 0]).rotation.z = 0.6;
    joints.push(joint);
    at = joint;
  }
  return { root, joints };
}

const VINE_SLAMS = 3; // arms that can be coming down at once
const VINE_SLAM_EVERY = attackTime(0.8);
const VINE_WARNING = 1.1; // seconds the red circle shows before the arm lands
const VINE_SLAM_RADIUS = 2.6;

/**
 * The Viniac: the boss of the jungle. A giant carnivorous plant rooted to the spot. Its huge thorny
 * arms rise up and SLAM down where you are (a red circle shows where), up to three at once, for 5.
 * 70 health.
 */
export class Vine extends Monster {
  constructor({ x, z }) {
    super({
      hitSound: 'wood',
      x,
      z,
      health: 70,
      damage: 5,
      radius: 2.6,
      barHeight: 7.5,
      colors: [VINE_GREEN, '#ff3b8d', '#ffd23f'],
      touchDamage: false,
    });
    this.isVine = true;
    this.slams = [];
    this.slamTimer = 2;
    this.buildModel();
  }

  buildModel() {
    part(this.body, [2.4, 4, 2.4], VINE_DARK, [0, 2, 0]); // thick trunk
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(this.body, [1.2, 0.4, 2.4], VINE_GREEN, [Math.sin(a) * 1.8, 0.2, Math.cos(a) * 1.8]).rotation.y = a; // roots
    }
    // A huge flower head with a toothy mouth and angry eyes
    this.head = new THREE.Group();
    this.head.position.y = 5;
    this.body.add(this.head);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = part(this.head, [1.2, 0.3, 1.8], i % 2 ? '#ff3b8d' : '#ff6bb5', [Math.sin(a) * 1.5, 0, Math.cos(a) * 1.5]);
      petal.rotation.y = a;
      petal.rotation.x = 0.4;
    }
    part(this.head, [2.2, 1.6, 2.2], '#ffd23f', [0, 0.4, 0]); // middle
    part(this.head, [1.6, 0.6, 0.3], '#3b0d16', [0, 0.2, 1.15]); // mouth
    for (let i = 0; i < 5; i++) part(this.head, [0.15, 0.25, 0.1], '#ffffff', [-0.6 + i * 0.3, 0.4, 1.3]); // teeth
    for (const s of [-1, 1]) {
      part(this.head, [0.4, 0.4, 0.1], '#ffffff', [s * 0.5, 0.95, 1.12]);
      part(this.head, [0.2, 0.2, 0.06], '#d9293f', [s * 0.5, 0.95, 1.18], { emissive: '#d9293f' });
      part(this.head, [0.5, 0.12, 0.08], VINE_DARK, [s * 0.5, 1.25, 1.14]).rotation.z = s * -0.35;
    }
    // Idle arms waving round the trunk
    this.idleArms = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const arm = vineArm(this.body, 4);
      arm.root.position.set(Math.sin(a) * 1.6, 1, Math.cos(a) * 1.6);
      arm.root.rotation.y = a;
      arm.phase = i * 1.7;
      this.idleArms.push(arm);
    }
  }

  think(dt, game, toPlayer) {
    this.velocity.x = this.velocity.z = 0; // rooted
    const awake = this.chasing(toPlayer, 20, !game.player.swimming);
    this.slamTimer -= dt;
    if (awake && this.slamTimer <= 0 && this.slams.length < VINE_SLAMS && toPlayer.dist < 22) {
      this.slamTimer = VINE_SLAM_EVERY;
      const p = game.player.object3d.position;
      const arm = vineArm(this.object3d, 8);
      const warning = new THREE.Mesh(new THREE.CircleGeometry(VINE_SLAM_RADIUS, 24), vineWarning);
      warning.rotation.x = -Math.PI / 2;
      this.object3d.add(warning);
      this.slams.push({ x: p.x + (Math.random() - 0.5), z: p.z + (Math.random() - 0.5), timer: VINE_WARNING, arm, warning });
    }
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.health <= 0 || game.isUiOpen()) return;
    const pos = this.object3d.position;
    const player = game.player;
    for (const s of [...this.slams]) {
      s.timer -= dt;
      const lx = s.x - pos.x;
      const lz = s.z - pos.z;
      s.warning.position.set(lx, 0.05, lz);
      const side = Math.atan2(lx, lz);
      s.arm.root.position.set(lx - Math.sin(side) * 2.5, 0, lz - Math.cos(side) * 2.5);
      s.arm.root.rotation.y = side;
      const up = s.timer > 0;
      s.arm.joints.forEach((j, i) => (j.rotation.x = i === 0 ? (up ? -0.2 : 1.25) : up ? -0.05 : 0.12));
      if (!up && !s.landed) {
        s.landed = true;
        game.particles?.burst(new THREE.Vector3(s.x, 0.3, s.z), { count: 30, colors: ['#5a4632', '#2e7d32', '#ffffff'], speed: 6, size: 0.2 });
        const p = player.object3d.position;
        if (!player.dead && !player.swimming && Math.hypot(p.x - s.x, p.z - s.z) < VINE_SLAM_RADIUS) player.takeDamage(game, this.power, pos.x, pos.z);
      }
      if (s.timer < -0.5) {
        this.object3d.remove(s.arm.root, s.warning);
        this.slams.splice(this.slams.indexOf(s), 1);
      }
    }
  }

  animate(dt, game) {
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    const turn = Math.atan2(p.x - pos.x, p.z - pos.z) - this.head.rotation.y;
    this.head.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-2 * dt));
    for (const arm of this.idleArms) {
      arm.joints.forEach((j, i) => (j.rotation.x = 0.35 + Math.sin(game.elapsed * 1.8 + arm.phase + i * 0.7) * 0.25));
    }
  }
}

/**
 * Master Oak in battle: very strong (one hit hurts a LOT) but slow, and only 8 hit points.
 * He has to charge up every spin, even the first one (his staff glows brighter and brighter and
 * sparkles). Once it's charged, he spins the moment you come close. Hit him
 * while he's charging, then get out of reach before the spin! He doesn't flinch when hit.
 * When beaten he doesn't vanish: he bows, and the duel is over.
 */
const OAK_SPIN_TIME = 0.8;
const OAK_CHARGE_TIME = attackTime(3); // seconds to charge the next spin
const OAK_SPIN_REACH = 3.2;

export class OakFighter extends Monster {
  constructor({ x, z }, model) {
    super({ x, z, health: 8, damage: 10, radius: 0.6, barHeight: 2.6, colors: ['#3fae3a', '#8a5a35', '#ffd23f'], touchDamage: false });
    this.model = model;
    this.body.add(model.root);
    this.model.armR.rotation.order = 'YXZ';
    this.noCoins = true; // a master, not a monster
    this.spinTimer = 0; // the duel starts with him charging up his first spin
    this.charge = 0;
    this.walkPhase = 0;
    this.sparkTimer = 0;
  }

  get charged() {
    return this.charge >= OAK_CHARGE_TIME;
  }

  think(dt, game, toPlayer) {
    this.velocity.x = this.velocity.z = 0;
    if (this.spinTimer > 0) return; // busy spinning
    if (!toPlayer.playerDown) this.charge = Math.min(OAK_CHARGE_TIME, this.charge + dt);
    if (this.charged && !toPlayer.playerDown && toPlayer.dist < OAK_SPIN_REACH) {
      this.spinTimer = OAK_SPIN_TIME;
      this.hitThisSpin = false;
      return;
    }
    // Walk slowly toward you (but not right on top of you).
    const speed = toPlayer.playerDown || toPlayer.dist < 1.8 ? 0 : 1.5;
    this.velocity.x = toPlayer.x * speed;
    this.velocity.z = toPlayer.z * speed;
    this.moving = speed;
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.health <= 0 || game.isUiOpen()) return;
    if (this.spinTimer > 0) this.updateSpin(dt, game);
  }

  updateSpin(dt, game) {
    this.spinTimer = Math.max(0, this.spinTimer - dt);
    const pos = this.object3d.position;
    const player = game.player;
    const p = player.object3d.position;
    if (!this.hitThisSpin && !player.dead && Math.hypot(p.x - pos.x, p.z - pos.z) < OAK_SPIN_REACH && Math.abs(p.y - pos.y) < 2) {
      this.hitThisSpin = true;
      player.takeDamage(game, this.power, pos.x, pos.z);
    }
    if (game.elapsed % 0.08 < dt) {
      const a = Math.random() * Math.PI * 2;
      game.particles?.burst(new THREE.Vector3(pos.x + Math.cos(a) * 2.2, pos.y + 1.2, pos.z + Math.sin(a) * 2.2), {
        count: 3,
        colors: ['#7dff6b', '#3fae3a', '#ffffff'],
        speed: 2,
        size: 0.12,
        life: 0.4,
      });
    }
    if (this.spinTimer === 0) this.charge = 0; // start charging the next one
  }

  /** Master Oak doesn't flinch: hits hurt him, but don't knock him back or stop him. */
  hit(game, toPlayer, damage) {
    super.hit(game, toPlayer, damage);
    this.stunTimer = 0;
    this.velocity.set(0, 0, 0);
  }

  /** He bows instead of bursting. */
  defeat(game) {
    const where = this.object3d.position.clone();
    game.particles?.burst(where.clone().setY(where.y + 1.5), { count: 40, colors: ['#3fae3a', '#ffd23f', '#ffffff'], speed: 5, size: 0.16 });
    game.remove(this);
    this.onDefeated?.(where);
  }

  animate(dt, game) {
    const { root, armR, armL, legL, legR } = this.model;
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    const face = Math.atan2(p.x - pos.x, p.z - pos.z);
    this.walkPhase += dt * (this.moving ? 5 : 0);
    legL.rotation.x = Math.sin(this.walkPhase) * 0.5;
    legR.rotation.x = -Math.sin(this.walkPhase) * 0.5;
    const glow = this.model.staffGlow.material;
    if (this.spinTimer > 0) {
      // Spinning: staff held straight out, whirling round twice.
      const t = 1 - this.spinTimer / OAK_SPIN_TIME;
      root.rotation.y = face + t * Math.PI * 4;
      armR.rotation.x = -1.5;
      armR.rotation.y = -1.3;
      armL.rotation.x = -1;
      glow.emissiveIntensity = 1.5;
      return;
    }
    root.rotation.y = face;
    // Charging: staff raised, glowing brighter and brighter; fully charged it sparkles.
    const c = this.charge / OAK_CHARGE_TIME;
    armR.rotation.x = -0.4 - c * 2.3;
    armR.rotation.y = 0;
    armL.rotation.x = -0.3;
    glow.emissiveIntensity = 0.2 + c * 1.2;
    this.sparkTimer -= dt;
    if (this.charged && this.sparkTimer <= 0) {
      this.sparkTimer = 0.1;
      game.particles?.burst(this.model.staffGlow.getWorldPosition(new THREE.Vector3()), {
        count: 2,
        colors: ['#7dff6b', '#ffffff'],
        speed: 1.5,
        size: 0.1,
        life: 0.4,
        gravity: -2,
      });
    }
  }
}
