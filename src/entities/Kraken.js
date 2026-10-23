import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { part } from '../models/character.js';
import { SEA } from '../config.js';

const NOTICE_RANGE = 20;
const DRIFT_SPEED = 1.2;
const SLAM_RANGE = 7; // starts a tentacle slam when you swim this close
const SLAM_RADIUS = 2.4; // the slam hurts anyone this close to where it lands
const WARNING_TIME = 1.3; // the tentacle rises (and a red circle shows) this long before it slams
const SLAM_COOLDOWN = attackTime(2.2);

const PURPLE = '#7b3fd1';
const DARK = '#5a2a9e';
const SUCKER = '#f2a6c8';

const warningMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.4, depthWrite: false });

function tentacle(parent, length, thickness) {
  const root = new THREE.Group();
  parent.add(root);
  const joints = [];
  let at = root;
  for (let i = 0; i < length; i++) {
    const joint = new THREE.Group();
    joint.position.y = i === 0 ? 0 : 0.7;
    at.add(joint);
    const t = thickness * (1 - (i / length) * 0.6);
    part(joint, [t, 0.75, t], i % 2 ? PURPLE : DARK, [0, 0.35, 0]);
    part(joint, [0.14, 0.14, 0.06], SUCKER, [0, 0.35, t / 2 + 0.02]);
    joints.push(joint);
    at = joint;
  }
  return { root, joints };
}

/**
 * The kraken: a huge purple squid that lurks far out at sea. It drifts toward swimmers and
 * slams a tentacle down where you are (watch for the red circle and swim away!) for 5 hearts.
 * 10 hits to defeat.
 */
export class Kraken extends Monster {
  constructor({ x, z }) {
    super({
      x,
      z,
      health: 10,
      damage: 5,
      radius: 2.2,
      barHeight: 4.6,
      colors: [PURPLE, DARK, SUCKER],
      aquatic: true,
      touchDamage: false,
    });
    this.boss = 'The Kraken';
    this.slam = null; // { x, z, timer } while a slam is coming
    this.slamCooldown = 2;
    this.buildModel();
  }

  buildModel() {
    const head = new THREE.Group();
    this.head = head;
    this.body.add(head);
    part(head, [2.6, 2.2, 2.4], PURPLE, [0, 1.0, 0]);
    part(head, [2.0, 1.2, 1.9], DARK, [0, 2.6, -0.2]); // tall mantle
    part(head, [1.2, 0.8, 1.2], PURPLE, [0, 3.5, -0.4]);
    for (const side of [-1, 1]) {
      part(head, [0.7, 0.7, 0.1], '#ffe94a', [side * 0.65, 1.3, 1.22], { emissive: '#ffe94a' }).material.emissiveIntensity = 0.6;
      part(head, [0.25, 0.5, 0.06], '#1d1d1d', [side * 0.65, 1.3, 1.28]);
      part(head, [0.7, 0.14, 0.08], DARK, [side * 0.65, 1.8, 1.22]).rotation.z = side * -0.3; // grumpy brows
    }
    // Tentacles waving around it.
    this.arms = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const arm = tentacle(this.body, 4, 0.45);
      arm.root.position.set(Math.cos(a) * 2.1, -0.3, Math.sin(a) * 2.1);
      arm.root.rotation.y = -a + Math.PI / 2;
      arm.phase = i * 1.3;
      this.arms.push(arm);
    }
    // The slamming tentacle and its warning circle live in world space (not turned with the head).
    this.slammer = tentacle(this.object3d, 7, 0.6);
    this.slammer.root.visible = false;
    this.warning = new THREE.Mesh(new THREE.CircleGeometry(SLAM_RADIUS, 24), warningMaterial);
    this.warning.rotation.x = -Math.PI / 2;
    this.warning.visible = false;
    this.object3d.add(this.warning);
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    const player = game.player;
    const fromHome = Math.hypot(pos.x - this.home.x, pos.z - this.home.z);
    const hunting = this.chasing(toPlayer, NOTICE_RANGE, player.swimming);

    let dirX = 0;
    let dirZ = 0;
    if (hunting && toPlayer.dist > 3.5) {
      dirX = toPlayer.x;
      dirZ = toPlayer.z;
    } else if (!hunting && fromHome > 2) {
      dirX = (this.home.x - pos.x) / fromHome;
      dirZ = (this.home.z - pos.z) / fromHome;
    }
    this.velocity.x = dirX * DRIFT_SPEED;
    this.velocity.z = dirZ * DRIFT_SPEED;

    this.slamCooldown -= dt;
    if (hunting && !this.slam && this.slamCooldown <= 0 && toPlayer.dist < SLAM_RANGE) {
      const p = player.object3d.position;
      this.slam = { x: p.x, z: p.z, timer: WARNING_TIME };
    }
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.health <= 0 || game.isUiOpen()) return;
    this.updateSlam(dt, game);
  }

  updateSlam(dt, game) {
    const { slammer, warning } = this;
    const pos = this.object3d.position;
    if (!this.slam) {
      slammer.root.visible = warning.visible = false;
      return;
    }
    const s = this.slam;
    s.timer -= dt;
    const lx = s.x - pos.x;
    const lz = s.z - pos.z;
    warning.position.set(lx, 0.06, lz);
    warning.visible = true;
    slammer.root.visible = true;
    // Rise up out of the water beside the target, curled back, then whip down onto it.
    const side = Math.atan2(lx, lz);
    slammer.root.position.set(lx - Math.sin(side) * 2, -0.5, lz - Math.cos(side) * 2);
    slammer.root.rotation.y = side;
    const rising = Math.max(0, s.timer / WARNING_TIME);
    const curl = s.timer > 0 ? -0.15 - (1 - rising) * 0.25 : 1.35;
    slammer.joints.forEach((j, i) => (j.rotation.x = i === 0 ? (s.timer > 0 ? -0.2 : 1.2) : curl * 0.35));

    if (s.timer <= 0 && !s.landed) {
      s.landed = true;
      const player = game.player;
      const p = player.object3d.position;
      game.particles?.burst(new THREE.Vector3(s.x, pos.y + 0.3, s.z), {
        count: 40,
        colors: ['#ffffff', '#bfe6ff', '#3cc6ea'],
        speed: 7,
        size: 0.22,
      });
      if (player.swimming && Math.hypot(p.x - s.x, p.z - s.z) < SLAM_RADIUS) {
        player.takeDamage(game, this.power, pos.x, pos.z);
      }
    }
    if (s.timer < -0.5) {
      this.slam = null;
      this.slamCooldown = SLAM_COOLDOWN;
    }
  }

  animate(dt, game) {
    const pos = this.object3d.position;
    const p = game.player.object3d.position;
    const turn = Math.atan2(p.x - pos.x, p.z - pos.z) - this.head.rotation.y;
    this.head.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-2 * dt));
    this.head.position.y = Math.sin(game.elapsed * 1.3) * 0.15 - 0.4;
    for (const arm of this.arms) {
      arm.joints.forEach((j, i) => {
        j.rotation.x = (i === 0 ? 0.5 : 0.35) + Math.sin(game.elapsed * 2 + arm.phase + i * 0.8) * 0.25;
      });
    }
  }
}
