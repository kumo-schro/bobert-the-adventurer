import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { part } from '../models/character.js';
import { VELIZAR } from '../config.js';

const WAKE_RANGE = 20;
const WALK_SPEED = 1.8;
const STAY_NEAR = 10; // he doesn't leave his lair
const WINDUP = 1.0; // rears up (and the ground in front glows red) before the flames
const BREATH = 1.3; // seconds of fire
const BREATH_COOLDOWN = attackTime(3.2);
const BITE_WINDUP = 0.35; // jaws open...
const BITE_COOLDOWN = attackTime(1.6); // ...SNAP, then a rest before the next bite

const RED = '#a3201c';
const DARK = '#5c1310';
const BELLY = '#ff9a3d';
const HORN = '#2b2422';
const warningMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b1f', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
const flameMaterial = (color, opacity) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

/** A cone of fire with its tip at the origin, pointing along +Z. */
function flameCone(length, radius, material) {
  const geometry = new THREE.ConeGeometry(radius, length, 16, 1, true);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, length / 2);
  return new THREE.Mesh(geometry, material);
}

/**
 * Velizar, the dragon of the fire island. He sleeps in his lair beside the volcano until you
 * come close, then wakes with a roar. He stomps after you (never far from his lair) and breathes
 * fire: first he rears up and the ground in front of him glows red, then flames pour out in a
 * cone. Get out of the way, then hit him while he catches his breath! Get too close in front of
 * him and he bites. 30 health.
 */
export class Velizar extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: VELIZAR.health, damage: VELIZAR.damage, radius: 2, barHeight: 5.2, colors: ['#ff5a1f', '#a3201c', '#ffd23f'] });
    this.isVelizar = true;
    this.awake = false;
    this.state = 'walk';
    this.timer = 2;
    this.biteCooldown = 0;
    this.facing = Math.PI;
    this.walkPhase = 0;
    this.buildModel();
    this.warning = new THREE.Mesh(new THREE.CircleGeometry(VELIZAR.flameRange, 24, -VELIZAR.flameWidth, VELIZAR.flameWidth * 2), warningMaterial);
    this.warning.rotation.x = -Math.PI / 2;
    this.warning.position.y = 0.06;
    this.warning.visible = false;
    this.object3d.add(this.warning);
    // The fire itself: glowing cones pouring from his mouth down to the ground.
    const length = VELIZAR.flameRange - 2.5;
    const radius = length * Math.tan(VELIZAR.flameWidth);
    this.flames = new THREE.Group();
    this.flames.add(flameCone(length, radius, flameMaterial('#ff4a12', 0.55)), flameCone(length * 0.85, radius * 0.55, flameMaterial('#ffd23f', 0.6)));
    this.flames.position.set(0, 3.2, 3.4);
    this.flames.rotation.x = 0.38; // aimed down at the ground in front of him
    this.flames.visible = false;
    this.body.add(this.flames);
  }

  buildModel() {
    const b = this.body;
    // Body, belly and back spikes
    part(b, [2.4, 1.8, 3.6], RED, [0, 2.0, 0]);
    part(b, [1.8, 0.4, 3.0], BELLY, [0, 1.15, 0.1]);
    for (let i = 0; i < 5; i++) part(b, [0.3, 0.5 - i * 0.05, 0.4], HORN, [0, 3.1, 1.2 - i * 0.65]);
    // Legs
    this.legs = [];
    for (const [x, z] of [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 1.5, z);
      b.add(leg);
      part(leg, [0.7, 1.5, 0.8], DARK, [0, -0.75, 0]);
      part(leg, [0.8, 0.25, 1.0], HORN, [0, -1.45, 0.15]); // claws
      this.legs.push(leg);
    }
    // Neck and head (the head pivots to rear up and breathe)
    this.neck = new THREE.Group();
    this.neck.position.set(0, 2.6, 1.6);
    b.add(this.neck);
    part(this.neck, [1.0, 1.0, 1.6], RED, [0, 0.4, 0.6]).rotation.x = -0.5;
    this.head = new THREE.Group();
    this.head.position.set(0, 1.2, 1.4);
    this.neck.add(this.head);
    part(this.head, [1.3, 1.0, 1.6], RED, [0, 0, 0.3]);
    part(this.head, [1.0, 0.5, 1.0], DARK, [0, -0.25, 1.2]); // snout
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.45, 0.6);
    this.head.add(this.jaw);
    part(this.jaw, [1.0, 0.25, 1.4], DARK, [0, 0, 0.5]);
    this.mouthGlow = part(this.head, [0.8, 0.2, 0.9], '#ff7a1f', [0, -0.42, 1.0], { emissive: '#ff5a1f' });
    for (const s of [-1, 1]) {
      part(this.head, [0.25, 0.2, 0.1], '#ffd23f', [s * 0.4, 0.2, 1.11], { emissive: '#ffd23f' }).material.emissiveIntensity = 1.4; // eyes
      part(this.head, [0.2, 0.9, 0.25], HORN, [s * 0.45, 0.7, -0.2]).rotation.x = -0.6; // horns
      part(this.head, [0.15, 0.4, 0.15], HORN, [s * 0.5, -0.1, 1.6]); // fangs
    }
    // Wings
    this.wings = [-1, 1].map((s) => {
      const wing = new THREE.Group();
      wing.position.set(s * 1.1, 2.9, 0.4);
      b.add(wing);
      part(wing, [2.8, 0.12, 2.2], DARK, [s * 1.5, 0, -0.4]);
      part(wing, [2.8, 0.08, 0.15], HORN, [s * 1.5, 0.08, 0.7]); // the wing's bone
      part(wing, [1.6, 0.1, 1.4], '#c4402a', [s * 2.6, 0, -1.2]);
      return wing;
    });
    // Tail
    this.tail = new THREE.Group();
    this.tail.position.set(0, 1.9, -1.8);
    b.add(this.tail);
    for (let i = 0; i < 4; i++) part(this.tail, [0.9 - i * 0.18, 0.8 - i * 0.15, 1.2], i % 2 ? DARK : RED, [0, -i * 0.25, -0.6 - i * 1.1]);
    part(this.tail, [0.8, 0.6, 0.15], HORN, [0, -1.0, -5.0]); // the spade at the end
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    if (!this.awake) {
      this.velocity.x = this.velocity.z = 0;
      if (toPlayer.dist < WAKE_RANGE && !toPlayer.playerDown) {
        this.awake = true;
        this.timer = 1.5;
        game.questLog?.toast('Velizar wakes up with a ROAR!');
        game.cameraRig?.shake(0.5);
        game.sound?.play('thump', { volume: 2 });
      }
      return;
    }
    const wantFacing = Math.atan2(toPlayer.x, toPlayer.z);
    const turn = Math.atan2(Math.sin(wantFacing - this.facing), Math.cos(wantFacing - this.facing));
    this.timer -= dt;
    this.biteCooldown -= dt;
    this.moving = 0;
    const inFront = Math.abs(turn) < 0.8 && toPlayer.dist < VELIZAR.biteRange && !toPlayer.playerDown;
    if (this.state === 'walk' && inFront && this.biteCooldown <= 0) {
      this.state = 'bite';
      this.timer = BITE_WINDUP;
    }
    if (this.state === 'bite') {
      this.velocity.x = this.velocity.z = 0;
      if (this.timer <= 0) {
        // SNAP!
        if (inFront && !game.player.dead) game.player.takeDamage(game, VELIZAR.biteDamage + (this.power - this.damage), pos.x, pos.z);
        game.sound?.play('thwack', { volume: 1.5 });
        this.biteCooldown = BITE_COOLDOWN;
        this.state = 'walk';
        this.timer = Math.max(this.timer, 0.8);
      }
      return;
    }
    if (this.state === 'walk') {
      this.facing += turn * (1 - Math.exp(-3 * dt));
      const fromHome = Math.hypot(pos.x - this.home.x, pos.z - this.home.z);
      const tooFarOut = fromHome > STAY_NEAR && toPlayer.x * (pos.x - this.home.x) + toPlayer.z * (pos.z - this.home.z) > 0;
      const speed = toPlayer.dist > 6 && !tooFarOut && !toPlayer.playerDown ? WALK_SPEED : 0;
      this.velocity.x = Math.sin(this.facing) * speed;
      this.velocity.z = Math.cos(this.facing) * speed;
      this.moving = speed;
      if (this.timer <= 0 && toPlayer.dist < VELIZAR.flameRange + 3 && !toPlayer.playerDown) {
        this.state = 'windup';
        this.timer = WINDUP;
        this.warning.visible = true;
      }
    } else if (this.state === 'windup') {
      // Rearing up: still turning (slowly) to follow you, so step sideways out of the red.
      this.velocity.x = this.velocity.z = 0;
      this.facing += turn * (1 - Math.exp(-1.5 * dt));
      if (this.timer <= 0) {
        this.state = 'breathe';
        this.timer = BREATH;
        this.burned = false;
        game.sound?.play('splash', { volume: 1.5 }); // a big WHOOSH of fire
        game.cameraRig?.shake(0.25);
      }
    } else if (this.state === 'breathe') {
      this.velocity.x = this.velocity.z = 0;
      this.breathe(dt, game);
      if (this.timer <= 0) {
        this.state = 'rest';
        this.timer = attackTime(1.6);
        this.warning.visible = false;
      }
    } else {
      // Catching his breath: now's your chance!
      this.velocity.x = this.velocity.z = 0;
      if (this.timer <= 0) {
        this.state = 'walk';
        this.timer = BREATH_COOLDOWN;
      }
    }
  }

  /** Flames pour out in a cone in front of him; anyone in it gets burned (once per breath). */
  breathe(dt, game) {
    const pos = this.object3d.position;
    const mouth = this.mouthGlow.getWorldPosition(new THREE.Vector3());
    for (let i = 0; i < 3; i++) {
      const a = this.facing + (Math.random() - 0.5) * VELIZAR.flameWidth * 1.6;
      const d = 1 + Math.random() * VELIZAR.flameRange;
      game.particles?.burst(new THREE.Vector3(pos.x + Math.sin(a) * d, 0.4 + Math.random() * 1.2, pos.z + Math.cos(a) * d), {
        count: 2,
        colors: ['#ff5a1f', '#ffb02e', '#ffd23f'],
        speed: 2,
        size: 0.28,
        gravity: -3,
        life: 0.45,
      });
    }
    game.particles?.burst(mouth, { count: 2, colors: ['#ffd23f', '#ff7a1f'], speed: 3, size: 0.2, life: 0.3 });
    // Flickering flames
    const flicker = 0.9 + Math.random() * 0.2;
    this.flames.scale.set(flicker, flicker, 0.95 + Math.random() * 0.1);
    const player = game.player;
    if (this.burned || player.dead) return;
    const p = player.object3d.position;
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - this.facing), Math.cos(Math.atan2(dx, dz) - this.facing));
    if (dist < VELIZAR.flameRange + 0.5 && Math.abs(off) < VELIZAR.flameWidth && p.y < 3) {
      this.burned = true;
      player.takeDamage(game, VELIZAR.flameDamage + (this.power - this.damage), pos.x, pos.z);
    }
  }

  /** He goes down in a huge burst of embers. */
  defeat(game) {
    const where = this.object3d.position.clone();
    this.warning.visible = false;
    game.particles?.burst(where.clone().setY(2.5), { count: 120, colors: ['#ff5a1f', '#ffd23f', '#a3201c', '#ffffff'], speed: 10, size: 0.3, life: 1.6 });
    game.cameraRig?.shake(0.8);
    game.sound?.play('thump', { volume: 2 });
    super.defeat(game);
  }

  animate(dt, game) {
    this.body.rotation.y = this.facing;
    this.warning.rotation.z = this.facing - Math.PI / 2; // the red cone points where he is facing
    this.walkPhase += dt * (this.moving ? 4 : 0);
    this.legs.forEach((leg, i) => (leg.rotation.x = Math.sin(this.walkPhase + (i % 3 ? Math.PI : 0)) * 0.4));
    const flap = this.awake ? Math.sin(game.elapsed * (this.state === 'windup' ? 9 : 2.5)) * 0.35 : 0.5;
    this.wings[0].rotation.z = flap;
    this.wings[1].rotation.z = -flap;
    this.tail.rotation.y = Math.sin(game.elapsed * 1.5) * 0.3;
    // Rear up before the flames; head down and mouth open while breathing.
    const rear = this.state === 'windup' ? 0.6 : 0;
    const open = this.state === 'breathe' ? 0.6 : this.state === 'bite' ? 0.9 : this.state === 'windup' ? 0.25 : 0.05;
    this.neck.rotation.x += (-rear + (this.state === 'breathe' ? 0.25 : 0) - this.neck.rotation.x) * (1 - Math.exp(-8 * dt));
    this.jaw.rotation.x += (open - this.jaw.rotation.x) * (1 - Math.exp(-10 * dt));
    this.flames.visible = this.state === 'breathe';
    this.mouthGlow.material.emissiveIntensity = this.state === 'windup' ? 1 + Math.sin(game.elapsed * 20) * 0.5 : this.state === 'breathe' ? 2 : 0.2;
    this.head.rotation.x = this.awake ? 0 : 0.4; // asleep: head down
  }
}
