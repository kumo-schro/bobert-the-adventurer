import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { Monster, attackTime } from './Monster.js';
import { part } from '../models/character.js';
import { THOMAGE } from '../config.js';

const WAKE_RANGE = 18;
const HOVER = 4.2; // how high he floats while casting (out of reach of a sword)
const CAST_WINDUP = 0.9; // the staff glows this long before a spell
const RUNE_WARNING = 1.3; // rune circles glow this long before they erupt
const RUNE_RADIUS = 1.9;
const TIRED_TIME = 3.6; // seconds he rests on the ground after his spells (hit him now!)
const SPELLS_BEFORE_REST = 3;

const ROBE = '#3b1f6e';
const ROBE_DARK = '#25124a';
const TRIM = '#ffd23f';
const SKIN = '#c9b7f0';
const BEARD = '#e8e0ff';
const ORB = '#ff5ec4';

const boltMaterial = new THREE.MeshBasicMaterial({ color: '#ff8fe0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const boltCore = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const boltGeometry = new THREE.OctahedronGeometry(0.42, 0);
const runeMaterial = () => new THREE.MeshBasicMaterial({ color: '#c04bff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });

/** A star bolt: a spinning pink star that flies in a straight line and hurts whoever it touches. */
class StarBolt extends Entity {
  constructor(from, velocity, damage) {
    super();
    this.velocity = velocity;
    this.damage = damage;
    this.life = 3.5;
    this.object3d.position.copy(from);
    const glow = new THREE.Mesh(boltGeometry, boltMaterial);
    const core = new THREE.Mesh(boltGeometry, boltCore);
    core.scale.setScalar(0.45);
    this.object3d.add(glow, core);
  }

  update(dt, game) {
    if (game.isUiOpen()) return;
    const pos = this.object3d.position;
    pos.addScaledVector(this.velocity, dt);
    this.object3d.rotation.y += dt * 9;
    this.object3d.rotation.x += dt * 5;
    if ((this.life -= dt) <= 0) return game.remove(this);
    const player = game.player;
    const p = player.object3d.position;
    if (player.dead || Math.hypot(p.x - pos.x, p.z - pos.z) > 0.9 || Math.abs(p.y + 1 - pos.y) > 1.2) return;
    const result = player.takeDamage(game, this.damage, pos.x - this.velocity.x, pos.z - this.velocity.z);
    if (result === 'dodged') return; // rolled right through it
    game.particles?.burst(pos.clone(), { count: 14, colors: ['#ff8fe0', '#ffffff', '#c04bff'], speed: 4, size: 0.12, life: 0.4 });
    game.remove(this);
  }
}

/** A glowing rune on the ground: it fills up, then erupts. */
class RuneCircle extends Entity {
  constructor(at, damage) {
    super();
    this.damage = damage;
    this.timer = RUNE_WARNING;
    this.object3d.position.copy(at);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(RUNE_RADIUS - 0.18, RUNE_RADIUS, 32), runeMaterial());
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(RUNE_RADIUS, 32), runeMaterial());
    for (const m of [this.ring, this.fill]) {
      m.rotation.x = -Math.PI / 2;
      this.object3d.add(m);
    }
    this.ring.position.y = 0.08;
    this.fill.position.y = 0.06;
    this.ring.material.opacity = 0.85;
  }

  update(dt, game) {
    if (game.isUiOpen()) return;
    this.timer -= dt;
    const t = 1 - Math.max(0, this.timer) / RUNE_WARNING;
    this.fill.scale.setScalar(Math.max(0.01, t));
    this.ring.rotation.z += dt * 2;
    if (this.timer > 0) return;
    // ERUPT
    const pos = this.object3d.position;
    const player = game.player;
    const p = player.object3d.position;
    if (!player.dead && Math.hypot(p.x - pos.x, p.z - pos.z) < RUNE_RADIUS + 0.3 && Math.abs(p.y - pos.y) < 1.6) {
      player.takeDamage(game, this.damage, pos.x, pos.z);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      game.particles?.burst(new THREE.Vector3(pos.x + Math.cos(a) * RUNE_RADIUS * 0.7, pos.y + 0.2, pos.z + Math.sin(a) * RUNE_RADIUS * 0.7), {
        count: 3,
        colors: ['#c04bff', '#ff8fe0', '#ffffff'],
        speed: 4,
        size: 0.16,
        life: 0.5,
        up: 1,
      });
    }
    game.sound?.play('burst', { volume: 0.5 });
    game.remove(this);
  }
}

/**
 * Thomage, the Nightmare Mage: the boss of the dream dimension. He floats above the dream hub, out
 * of reach of a sword, and casts spells: a fan of star bolts (his staff glows first: roll through
 * them!), and rune circles that light up around you and erupt. After a few spells he sinks to the
 * ground, tired: that's the time to hit him with your sword. Arrows, the Star Burst and a Sky
 * Strike (bounce off a dream mushroom!) reach him in the air too. At half health he gets faster
 * and teleports around.
 */
export class Thomage extends Monster {
  constructor({ x, y, z }) {
    super({ x, z, y, health: THOMAGE.health, damage: THOMAGE.damage, radius: 0.8, barHeight: 3.4, flying: true, touchDamage: false, colors: ['#7b4dff', '#ff8fe0', '#ffffff'] });
    this.boss = 'Thomage, the Nightmare Mage';
    this.ground = y; // the floor of the arena
    this.arena = { x, z };
    this.awake = false;
    this.state = 'float';
    this.timer = 1.5;
    this.spells = 0;
    this.spot = new THREE.Vector3(x, y + HOVER, z);
    this.object3d.position.set(x, y + HOVER, z);
    this.buildModel();
  }

  get angry() {
    return this.health <= this.maxHealth / 2;
  }

  buildModel() {
    const b = this.body;
    // Robe (wider at the bottom), with gold trim
    part(b, [1.3, 0.5, 1.1], ROBE_DARK, [0, 0.25, 0]);
    part(b, [1.1, 0.7, 0.95], ROBE, [0, 0.8, 0]);
    part(b, [0.9, 0.6, 0.8], ROBE, [0, 1.4, 0]);
    part(b, [1.34, 0.12, 1.14], TRIM, [0, 0.06, 0]);
    part(b, [0.14, 1.2, 0.05], TRIM, [0, 1.0, 0.49]);
    // Head, beard, glowing eyes
    part(b, [0.6, 0.6, 0.6], SKIN, [0, 2.0, 0]);
    part(b, [0.5, 0.45, 0.2], BEARD, [0, 1.65, 0.28]);
    for (const s of [-1, 1]) part(b, [0.12, 0.08, 0.04], '#ff5ec4', [s * 0.14, 2.05, 0.31], { emissive: '#ff5ec4' }).material.emissiveIntensity = 1.5;
    // Pointy hat with stars
    part(b, [0.95, 0.12, 0.95], ROBE_DARK, [0, 2.32, 0]);
    part(b, [0.6, 0.35, 0.6], ROBE_DARK, [0, 2.55, 0]);
    part(b, [0.4, 0.35, 0.4], ROBE_DARK, [0.05, 2.85, -0.05]);
    part(b, [0.22, 0.3, 0.22], ROBE_DARK, [0.12, 3.12, -0.12]);
    part(b, [0.12, 0.12, 0.04], TRIM, [0.15, 2.6, 0.31], { emissive: TRIM });
    // Arms and the staff
    this.armL = part(b, [0.28, 0.75, 0.28], ROBE, [-0.62, 1.35, 0.1]);
    this.staffArm = new THREE.Group();
    this.staffArm.position.set(0.62, 1.7, 0.1);
    b.add(this.staffArm);
    part(this.staffArm, [0.28, 0.75, 0.28], ROBE, [0, -0.3, 0]);
    part(this.staffArm, [0.12, 2.6, 0.12], '#5a3a22', [0.08, 0.1, 0.25]);
    this.orb = part(this.staffArm, [0.4, 0.4, 0.4], ORB, [0.08, 1.45, 0.25], { emissive: ORB });
    this.orb.material.emissiveIntensity = 0.6;
    // A wispy trail under the robe (he floats)
    this.trail = part(b, [0.7, 0.5, 0.6], '#7b4dff', [0, -0.25, 0], { emissive: '#7b4dff' });
    this.trail.material.transparent = true;
    this.trail.material.opacity = 0.5;
  }

  think(dt, game, toPlayer) {
    const pos = this.object3d.position;
    const p = game.player.object3d.position;
    if (!this.awake) {
      this.velocity.set(0, 0, 0);
      if (toPlayer.dist < WAKE_RANGE && !toPlayer.playerDown && Math.abs(p.y - this.ground) < 4) {
        this.awake = true;
        this.timer = 1.2;
        game.questLog?.toast('Thomage rises from the nightmare!', { icon: '🌙' });
        game.cameraRig?.shake(0.4);
        game.sound?.play('magic', { volume: 1.5 });
      }
      return;
    }
    // You left the dream (or fell off the island): he goes back to waiting, and gets his breath back.
    if (toPlayer.dist > 35 || Math.abs(p.y - this.ground) > 10) {
      this.awake = false;
      this.state = 'float';
      this.spells = 0;
      this.spot.set(this.arena.x, this.ground + HOVER, this.arena.z);
      this.velocity.set(0, 0, 0);
      return;
    }
    if (toPlayer.playerDown) {
      this.state = 'float';
      this.timer = 2;
    }
    this.timer -= dt;
    this.facing = Math.atan2(toPlayer.x, toPlayer.z);
    const speed = this.angry ? 1.35 : 1;

    if (this.state === 'float') {
      // Drift around the arena, keeping some distance from you.
      const away = toPlayer.dist < 6 ? -1 : toPlayer.dist > 10 ? 1 : 0;
      this.spot.x += toPlayer.x * away * 2.5 * dt;
      this.spot.z += toPlayer.z * away * 2.5 * dt;
      this.keepInArena(this.spot, 9);
      this.spot.y = this.ground + HOVER + Math.sin(game.elapsed * 1.6) * 0.3;
      if (this.timer <= 0 && !toPlayer.playerDown) {
        if (this.spells >= SPELLS_BEFORE_REST) {
          this.state = 'descend';
          this.timer = 0.7;
        } else {
          this.state = 'cast';
          this.spell = this.spells % 2 === 0 ? 'bolts' : 'runes';
          this.timer = CAST_WINDUP / speed;
        }
      }
    } else if (this.state === 'cast') {
      // The staff glows brighter and brighter, then the spell goes off.
      const t = 1 - this.timer / (CAST_WINDUP / speed);
      this.orb.material.emissiveIntensity = 0.6 + t * 3;
      this.orb.scale.setScalar(1 + t * 0.6);
      if (game.elapsed % 0.08 < dt) {
        game.particles?.burst(this.orb.getWorldPosition(new THREE.Vector3()), { count: 2, colors: ['#ff8fe0', '#ffffff'], speed: 2, size: 0.1, life: 0.3 });
      }
      if (this.timer <= 0) {
        if (this.spell === 'bolts') this.castBolts(game);
        else this.castRunes(game);
        this.spells++;
        this.orb.material.emissiveIntensity = 0.6;
        this.orb.scale.setScalar(1);
        this.state = 'float';
        this.timer = attackTime(this.angry ? 1.4 : 2.1);
      }
    } else if (this.state === 'descend') {
      this.spot.y = this.ground + 0.2;
      if (this.timer <= 0) {
        this.state = 'tired';
        this.timer = TIRED_TIME;
        game.particles?.burst(pos.clone(), { count: 16, colors: ['#7b4dff', '#ffffff'], speed: 3, size: 0.15, life: 0.6 });
      }
    } else if (this.state === 'tired') {
      // Out of breath on the ground: swing away!
      this.spot.y = this.ground + 0.2;
      if (this.timer <= 0) {
        this.state = 'float';
        this.spells = 0;
        this.timer = 1;
        if (this.angry) this.teleport(game);
      }
    }
    // Glide toward where he wants to be.
    const k = this.state === 'tired' ? 0 : 3;
    this.velocity.set((this.spot.x - pos.x) * k, (this.spot.y - pos.y) * 4, (this.spot.z - pos.z) * k);
  }

  keepInArena(v, radius) {
    const dx = v.x - this.arena.x;
    const dz = v.z - this.arena.z;
    const d = Math.hypot(dx, dz);
    if (d > radius) {
      v.x = this.arena.x + (dx / d) * radius;
      v.z = this.arena.z + (dz / d) * radius;
    }
  }

  /** A fan of star bolts, aimed at you. */
  castBolts(game) {
    const from = this.orb.getWorldPosition(new THREE.Vector3());
    const p = game.player.object3d.position;
    const target = new THREE.Vector3(p.x, p.y + 1, p.z);
    const dir = target.sub(from).normalize();
    const count = this.angry ? 5 : 3;
    const spread = 0.28;
    for (let i = 0; i < count; i++) {
      const a = (i - (count - 1) / 2) * spread;
      const v = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a).multiplyScalar(THOMAGE.boltSpeed);
      game.add(new StarBolt(from.clone(), v, this.damage));
    }
    game.sound?.play('bow', { volume: 1.2 });
  }

  /** Rune circles around you (one right under your feet): get out before they erupt! */
  castRunes(game) {
    const p = game.player.object3d.position;
    const spots = [[0, 0]];
    const count = this.angry ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random();
      spots.push([Math.cos(a) * 3.4, Math.sin(a) * 3.4]);
    }
    for (const [dx, dz] of spots) {
      const at = new THREE.Vector3(p.x + dx, this.ground, p.z + dz);
      if (Math.hypot(at.x - this.arena.x, at.z - this.arena.z) > 13) continue; // only on the island
      game.add(new RuneCircle(at, this.damage));
    }
    game.sound?.play('magic');
  }

  /** POOF: somewhere else on the island. */
  teleport(game) {
    const pos = this.object3d.position;
    game.particles?.burst(pos.clone(), { count: 24, colors: ['#7b4dff', '#ff8fe0', '#ffffff'], speed: 5, size: 0.16, life: 0.5 });
    const a = Math.random() * Math.PI * 2;
    this.spot.set(this.arena.x + Math.cos(a) * 7, this.ground + HOVER, this.arena.z + Math.sin(a) * 7);
    pos.copy(this.spot);
    game.particles?.burst(pos.clone(), { count: 24, colors: ['#7b4dff', '#ff8fe0', '#ffffff'], speed: 5, size: 0.16, life: 0.5 });
    game.sound?.play('dash');
  }

  hit(game, toPlayer, damage, how) {
    super.hit(game, toPlayer, damage, how);
    this.velocity.set(0, 0, 0); // he doesn't get knocked about much
    this.stunTimer = this.state === 'tired' ? 0.15 : 0.25;
  }

  animate(dt, game) {
    this.body.rotation.y = this.facing ?? 0;
    this.trail.scale.y = 1 + Math.sin(game.elapsed * 6) * 0.2;
    const tired = this.state === 'tired';
    this.body.rotation.x = tired ? 0.25 : 0;
    this.staffArm.rotation.x = this.state === 'cast' ? -1.6 : tired ? 0.3 : -0.2;
    this.armL.rotation.x = this.state === 'cast' ? -1.2 : 0;
    if (tired && game.elapsed % 0.5 < dt) {
      game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 2.6), { count: 2, colors: ['#ffffff'], speed: 0.6, size: 0.1, life: 0.6, gravity: -2 });
    }
  }
}
