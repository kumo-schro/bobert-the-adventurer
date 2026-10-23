import * as THREE from 'three';
import { Monster, attackTime } from './Monster.js';
import { JACKSON } from '../config.js';

const CIRCLE_DISTANCE = 2.8; // he keeps about this far away, circling you...
const CIRCLE_SPEED = 2.4;
const WINDUP = 0.45; // ...then draws back his practice sword for this long...
const JAB_TIME = 0.2; // ...and darts in
const JAB_SPEED = 9;
const JAB_REACH = 1.5;
const RECOVER = attackTime(0.6);
const DODGE_SPEED = 9;

/**
 * Master Jackson in his duel. He's the master of dodging: every sword swing, arrow and Sky Strike
 * misses as he leaps aside. Only a spin attack (it comes from every side at once) can catch him.
 * He circles you, then darts in with quick jabs of his wooden practice sword. When beaten he bows.
 */
export class JacksonFighter extends Monster {
  constructor({ x, z }, model) {
    super({
      x,
      z,
      health: JACKSON.health,
      damage: JACKSON.damage,
      radius: 0.6,
      barHeight: 2.6,
      colors: ['#ff8a1f', '#d9293f', '#ffffff'],
      touchDamage: false,
    });
    this.boss = 'Master Jackson';
    this.model = model;
    this.body.add(model.root);
    this.noCoins = true; // a master, not a monster
    this.state = 'circle';
    this.timer = 1.5;
    this.circleDir = 1;
    this.walkPhase = 0;
    this.dodged = 0;
  }

  /** Anything but a spin attack misses. */
  dodges(game) {
    return !game.player.spinning;
  }

  /** Leap sideways out of the way. */
  dodge(game, toPlayer) {
    const side = Math.random() < 0.5 ? 1 : -1;
    this.velocity.set(-toPlayer.z * side * DODGE_SPEED, 4, toPlayer.x * side * DODGE_SPEED);
    this.onGround = false;
    this.stunTimer = 0.25; // keeps the leap going
    this.state = 'circle';
    this.timer = 0.8;
    const pos = this.object3d.position;
    game.particles?.burst(new THREE.Vector3(pos.x, pos.y + 0.3, pos.z), { count: 10, colors: ['#ffffff', '#c9a46b'], speed: 2.5, size: 0.14, life: 0.35 });
    game.sound?.play('dodge');
    this.dodged++;
    if (this.dodged === 1 || this.dodged % 6 === 0) game.questLog?.toast('Master Jackson dodged it! Nothing gets past him... except maybe a spin?');
  }

  /** Arrows and Sky Strikes are dodged too. Spins land, but he doesn't flinch. */
  hit(game, toPlayer, damage) {
    if (this.dodges(game)) {
      this.dodge(game, toPlayer);
      return;
    }
    super.hit(game, toPlayer, damage);
    this.stunTimer = 0;
    this.velocity.set(0, 0, 0);
    this.state = 'circle';
    this.timer = 1;
  }

  think(dt, game, toPlayer) {
    if (this.stunTimer > 0) return; // mid-leap
    this.timer -= dt;
    this.moving = 0;
    if (toPlayer.playerDown) {
      this.velocity.x = this.velocity.z = 0;
      return;
    }
    if (this.state === 'circle') {
      // Circle round you, keeping his distance.
      const away = toPlayer.dist - CIRCLE_DISTANCE;
      const vx = toPlayer.x * away * 1.5 - toPlayer.z * this.circleDir * CIRCLE_SPEED;
      const vz = toPlayer.z * away * 1.5 + toPlayer.x * this.circleDir * CIRCLE_SPEED;
      const len = Math.hypot(vx, vz) || 1;
      const speed = Math.min(CIRCLE_SPEED * 1.4, len);
      this.velocity.x = (vx / len) * speed;
      this.velocity.z = (vz / len) * speed;
      this.moving = speed;
      if (this.timer <= 0 && toPlayer.dist < CIRCLE_DISTANCE + 1.5) {
        this.state = 'windup';
        this.timer = WINDUP;
      }
    } else if (this.state === 'windup') {
      this.velocity.x = this.velocity.z = 0;
      if (this.timer <= 0) {
        this.state = 'jab';
        this.timer = JAB_TIME;
        this.jabHit = false;
        this.jabDir = { x: toPlayer.x, z: toPlayer.z };
        game.sound?.play('swish');
      }
    } else if (this.state === 'jab') {
      this.velocity.x = this.jabDir.x * JAB_SPEED;
      this.velocity.z = this.jabDir.z * JAB_SPEED;
      this.moving = JAB_SPEED;
      const player = game.player;
      if (!this.jabHit && !player.dead && toPlayer.dist < JAB_REACH) {
        this.jabHit = true;
        const pos = this.object3d.position;
        player.takeDamage(game, this.power, pos.x, pos.z);
      }
      if (this.timer <= 0) {
        this.state = 'recover';
        this.timer = RECOVER;
      }
    } else {
      this.velocity.x = this.velocity.z = 0;
      if (this.timer <= 0) {
        this.state = 'circle';
        this.timer = 1 + Math.random() * 1.2;
        if (Math.random() < 0.4) this.circleDir = -this.circleDir;
      }
    }
  }

  /** He bows instead of bursting. */
  defeat(game) {
    const where = this.object3d.position.clone();
    game.particles?.burst(where.clone().setY(where.y + 1.5), { count: 40, colors: ['#ff8a1f', '#ffd23f', '#ffffff'], speed: 5, size: 0.16 });
    game.remove(this);
    this.onDefeated?.(where);
  }

  animate(dt, game) {
    const { root, armR, armL, legL, legR } = this.model;
    const p = game.player.object3d.position;
    const pos = this.object3d.position;
    root.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
    this.walkPhase += dt * (this.moving ? 4 + this.moving : 0);
    legL.rotation.x = Math.sin(this.walkPhase) * 0.6;
    legR.rotation.x = -Math.sin(this.walkPhase) * 0.6;
    armL.rotation.x = -0.5; // guard up
    if (this.state === 'windup') armR.rotation.x = 0.9; // sword drawn back
    else if (this.state === 'jab') armR.rotation.x = -1.6; // thrust forward
    else armR.rotation.x = -0.5 + Math.sin(game.elapsed * 6) * 0.1; // ready, bouncing on his toes
  }
}
