import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { part, createCharacter, poseWalk } from '../models/character.js';
import { LOOKS } from '../models/people.js';
import { KING } from '../config.js';

const WALK_SPEED = 2.1;
const WINDUP = 0.7; // sword raised (and the ground in front glows red)...
const SWEEP = 0.3; // ...then the big sideways sweep
const REST = attackTime(1.3);
const SHIELD_ANGLE = 1.2; // his shield covers this far either side of straight ahead (radians)
const SWEEP_ANGLE = 1.25;

const warningMaterial = new THREE.MeshBasicMaterial({ color: '#ff3b1f', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });

/**
 * King Stuart of Tulane, the last boss. He marches at you behind his big shield, which blocks
 * every hit from the front (swing round behind him, or use a spin attack or a Sky Strike, which
 * come from every side). When he's close he raises his sword, the ground in front of him glows
 * red, and he SWEEPS. At half health he calls his guards.
 */
export class KingStuart extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: KING.health, damage: KING.damage, radius: 0.7, barHeight: 2.9, colors: ['#ffcf3f', '#c0392b', '#ffffff'], touchDamage: false });
    this.model = createCharacter(LOOKS.king.colors);
    LOOKS.king.decorate(this.model);
    part(this.model.handR, [0.14, 1.5, 0.08], '#e8edf2', [0, -0.1, 0.75]).rotation.x = Math.PI / 2; // big sword
    part(this.model.handR, [0.5, 0.1, 0.14], '#ffcf3f', [0, 0, 0.1]);
    this.shield = part(this.model.handL, [0.14, 0.9, 0.7], '#2f5fb8', [0.12, 0.1, 0.25]); // tall blue shield
    part(this.model.handL, [0.16, 0.36, 0.3], '#ffcf3f', [0.13, 0.1, 0.25]);
    this.body.add(this.model.root);
    this.facing = Math.PI;
    this.state = 'walk';
    this.timer = 1.5;
    this.walkPhase = 0;
    this.calledGuards = false;
    this.blocked = 0;
    this.warning = new THREE.Mesh(new THREE.CircleGeometry(KING.sweepRange, 24, -SWEEP_ANGLE, SWEEP_ANGLE * 2), warningMaterial);
    this.warning.rotation.x = -Math.PI / 2;
    this.warning.position.y = 0.06;
    this.warning.visible = false;
    this.object3d.add(this.warning);
  }

  /** Is the player in front of him (inside his shield)? */
  inFront(game, angle = SHIELD_ANGLE) {
    const pos = this.object3d.position;
    const p = game.player.object3d.position;
    const toward = Math.atan2(p.x - pos.x, p.z - pos.z);
    return Math.abs(Math.atan2(Math.sin(toward - this.facing), Math.cos(toward - this.facing))) < angle;
  }

  /** A normal sword swing from the front just bounces off his shield. */
  dodges(game) {
    return !game.player.spinning && this.state === 'walk' && this.inFront(game);
  }

  /** CLANG! (It's a block, not a dodge, but it works the same way.) */
  dodge(game) {
    const pos = this.object3d.position;
    game.sound?.play('block');
    game.particles?.burst(new THREE.Vector3(pos.x + Math.sin(this.facing) * 0.6, pos.y + 1.2, pos.z + Math.cos(this.facing) * 0.6), { count: 12, colors: ['#ffffff', '#ffe66b'], speed: 4, size: 0.1, life: 0.3 });
    this.blocked++;
    if (this.blocked === 1 || this.blocked % 6 === 0) game.questLog?.toast('CLANG! His shield guards his front...');
  }

  /** Arrows from the front are blocked too; a Sky Strike comes down on every side at once. */
  hit(game, toPlayer, damage, how = {}) {
    if (!how.skyStrike && this.dodges(game)) {
      this.dodge(game);
      return;
    }
    super.hit(game, toPlayer, damage);
    this.stunTimer = 0; // a king doesn't get knocked about
    this.velocity.set(0, 0, 0);
    if (!this.calledGuards && this.health > 0 && this.health <= this.maxHealth / 2) this.callGuards(game);
  }

  callGuards(game) {
    this.calledGuards = true;
    game.questLog?.toast('King Stuart calls his guards!');
    const pos = this.object3d.position;
    for (let i = 0; i < KING.guards; i++) {
      const a = this.facing + Math.PI + (i - (KING.guards - 1) / 2) * 1.2;
      game.add(new TulaneGuard({ x: pos.x + Math.sin(a) * 5, z: pos.z + Math.cos(a) * 5 }));
    }
  }

  think(dt, game, toPlayer) {
    const want = Math.atan2(toPlayer.x, toPlayer.z);
    const turn = Math.atan2(Math.sin(want - this.facing), Math.cos(want - this.facing));
    this.timer -= dt;
    this.moving = 0;
    if (this.state === 'walk') {
      this.facing += turn * (1 - Math.exp(-4 * dt));
      const speed = toPlayer.dist > 2 && !toPlayer.playerDown ? WALK_SPEED : 0;
      this.velocity.x = Math.sin(this.facing) * speed;
      this.velocity.z = Math.cos(this.facing) * speed;
      this.moving = speed;
      if (this.timer <= 0 && toPlayer.dist < KING.sweepRange + 0.5 && !toPlayer.playerDown) {
        this.state = 'windup';
        this.timer = WINDUP;
        this.warning.visible = true;
      }
    } else if (this.state === 'windup') {
      this.velocity.x = this.velocity.z = 0;
      if (this.timer <= 0) {
        this.state = 'sweep';
        this.timer = SWEEP;
        this.hitThisSweep = false;
        game.sound?.play('swish', { volume: 1.6 });
      }
    } else if (this.state === 'sweep') {
      this.velocity.x = this.velocity.z = 0;
      const player = game.player;
      if (!this.hitThisSweep && !player.dead && toPlayer.dist < KING.sweepRange && this.inFront(game, SWEEP_ANGLE)) {
        this.hitThisSweep = true;
        const pos = this.object3d.position;
        player.takeDamage(game, this.power, pos.x, pos.z);
      }
      if (this.timer <= 0) {
        this.state = 'rest';
        this.timer = REST;
        this.warning.visible = false;
      }
    } else {
      this.velocity.x = this.velocity.z = 0;
      if (this.timer <= 0) {
        this.state = 'walk';
        this.timer = attackTime(1.6);
      }
    }
  }

  /** He goes down in a burst of gold. */
  defeat(game) {
    this.warning.visible = false;
    const where = this.object3d.position.clone();
    game.particles?.burst(where.clone().setY(where.y + 1.5), { count: 80, colors: ['#ffcf3f', '#c0392b', '#ffffff', '#2f5fb8'], speed: 8, size: 0.22, life: 1.6 });
    game.cameraRig?.shake(0.6);
    super.defeat(game);
  }

  animate(dt) {
    const { root, armR, armL } = this.model;
    root.rotation.y = this.facing;
    this.warning.rotation.z = this.facing - Math.PI / 2;
    this.walkPhase += dt * (this.moving ? 6 : 0);
    poseWalk(this.model, this.walkPhase, this.moving ? 0.8 : 0);
    armL.rotation.x = -0.9; // shield up in front
    armL.rotation.z = -0.4;
    if (this.state === 'windup') {
      armR.rotation.x = -2.6; // sword high over his head
      armR.rotation.z = 0.6;
    } else if (this.state === 'sweep') {
      const t = 1 - this.timer / SWEEP;
      armR.rotation.x = -1.4;
      armR.rotation.z = 1.2 - t * 2.6; // the sweep, from his right side across to his left
    } else {
      armR.rotation.x = -0.4;
      armR.rotation.z = 0.1;
    }
  }
}

/** A Tulane guard: a soldier with a spear, called by King Stuart. Four hits; 2 damage. */
export class TulaneGuard extends Monster {
  constructor({ x, z }) {
    super({ x, z, health: 4, damage: 2, radius: 0.5, barHeight: 2.3, colors: ['#2f5fb8', '#b0b6bd', '#ffcf3f'] });
    this.model = createCharacter(LOOKS.soldier.colors);
    LOOKS.soldier.decorate(this.model);
    this.body.add(this.model.root);
    this.walkPhase = 0;
  }

  think(dt, game, toPlayer) {
    const chasing = this.chasing(toPlayer, 18, !game.player.swimming);
    const speed = chasing ? 2.5 : 0;
    this.velocity.x = chasing ? toPlayer.x * speed : 0;
    this.velocity.z = chasing ? toPlayer.z * speed : 0;
    this.moving = speed;
  }

  animate(dt, game) {
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    this.model.root.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
    this.walkPhase += dt * (this.moving ? 7 : 0);
    poseWalk(this.model, this.walkPhase, this.moving ? 1 : 0);
  }
}
