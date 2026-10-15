import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { pushOut } from '../core/collision.js';
import { part } from '../models/character.js';
import { SEA, BUFFS, MONSTERS } from '../config.js';

const GRAVITY = 25;
/** Magic points a monster gives when it's defeated: (its health + its damage) / 4, at least 1. */
export const magicPoints = (monster) => Math.max(1, Math.round((monster.maxHealth + monster.damage) / 4));

/** How long to wait between attacks, sped up by MONSTERS.attackSpeed (use it for every attack timer). */
export const attackTime = (seconds) => seconds / MONSTERS.attackSpeed;

const CONTACT_COOLDOWN = attackTime(1);
const GIVE_UP_DISTANCE = 30; // once a monster is after you, it follows until you're this far away
const NIGHT_SPEED = 1.2; // monsters move 20% faster at night...
const NIGHT_DAMAGE = 1; // ...and hit 1 heart harder

/**
 * Shared enemy behavior: health + health bar, taking sword hits (once per swing),
 * getting knocked back, hurting the player on contact, flashing, and dying in a burst
 * of bits that pays out coins.
 *
 * Subclasses build their model inside `this.body`, and override:
 *   think(dt, game, toPlayer)  - set this.velocity (x/z, and y to jump) to move
 *   animate(dt, game)          - wiggle, squash, etc.
 *
 * Options: { x, z, y, health, radius, coins, damage, barHeight, colors (death burst),
 *            aquatic, flying, touchDamage, hitSound }
 * hitSound: what our sword sounds like hitting it ('thwack', 'squish', 'stone' or 'wood', see core/Sound.js).
 * Aquatic monsters (sharks, eels) swim at the water surface, can't go on land, and only
 * bite players who are swimming. Land monsters only reach players on land.
 * Flying monsters (gargoyles) move freely in 3D and can reach you anywhere.
 * touchDamage: false for monsters that hurt you some other way (the kraken's tentacles).
 * Set `onDefeated(position)` to react when it dies.
 *
 * A monster with dodges(game) -> true and dodge(game, toPlayer) leaps aside instead of being hit.
 *
 * Use `chasing(toPlayer, noticeRange)` in think(): once a monster notices you it keeps
 * following until you get far away. At night monsters are faster and hit harder (`power`).
 */
export class Monster extends Entity {
  constructor({
    x,
    z,
    y = 0,
    health = 2,
    radius = 0.6,
    coins = 3,
    damage = 1,
    barHeight = 1.6,
    colors = ['#ffffff'],
    aquatic = false,
    flying = false,
    touchDamage = true,
    hitSound = 'thwack',
  }) {
    super();
    this.aquatic = aquatic;
    this.flying = flying;
    this.touchDamage = touchDamage;
    this.hitSound = hitSound;
    this.home = new THREE.Vector3(x, aquatic ? SEA.level - SEA.monsterDepth : y, z);
    this.object3d.position.copy(this.home);
    this.maxHealth = health;
    this.health = health;
    this.radius = radius;
    this.coins = coins;
    this.damage = damage;
    this.colors = colors;
    this.onDefeated = null;

    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.stunTimer = 0;
    this.flashTimer = 0;
    this.contactCooldown = 0;
    this.lastSwing = -1;
    this.aggro = false;
    this.collider = { x, z, radius, isMonster: true };

    this.body = new THREE.Group();
    this.object3d.add(this.body);
    this.buildHealthBar(barHeight);
  }

  buildHealthBar(height) {
    this.healthBar = new THREE.Group();
    this.healthBar.position.y = height;
    const width = Math.max(0.9, this.radius * 1.4);
    part(this.healthBar, [width + 0.14, 0.24, 0.04], '#2b3a55', [0, 0, 0]).castShadow = false;
    this.healthFill = part(this.healthBar, [width, 0.12, 0.05], '#ff4d6d', [0, 0, 0.01]);
    this.healthFill.castShadow = false;
    this.healthFillWidth = width;
    this.healthBar.visible = false;
    this.object3d.add(this.healthBar);
  }

  onAdd(game) {
    this.game = game;
    if (!this.flying) game.colliders.push(this.collider); // flyers go over everything
    game.monsters.push(this);
  }

  onRemove(game) {
    const i = game.colliders.indexOf(this.collider);
    if (i !== -1) game.colliders.splice(i, 1);
    const m = game.monsters.indexOf(this);
    if (m !== -1) game.monsters.splice(m, 1);
  }

  /** Aquatic monsters: is (x, z) open water, away from the shore? */
  canSwimAt(game, x, z) {
    return !game.isWalkable(x, z, -1.5) && Math.hypot(x, z) < SEA.radius;
  }

  /** How many hearts this monster's attacks take (more at night). */
  get power() {
    return this.damage + (this.game?.dayNight?.isNight ? NIGHT_DAMAGE : 0);
  }

  /** Movement speed multiplier (faster at night). */
  get speedScale() {
    return this.game?.dayNight?.isNight ? NIGHT_SPEED : 1;
  }

  /**
   * Should we be chasing the player? Starts when they come within `noticeRange` and keeps
   * going until they get GIVE_UP_DISTANCE away (or are knocked out / somewhere we can't follow).
   */
  chasing(toPlayer, noticeRange, canReach = true) {
    if (toPlayer.playerDown || !canReach || this.game?.player.invisible) this.aggro = false;
    else if (toPlayer.dist < noticeRange) this.aggro = true;
    else if (toPlayer.dist > GIVE_UP_DISTANCE) this.aggro = false;
    return this.aggro;
  }

  think(_dt, _game, _toPlayer) {}

  animate(_dt, _game) {}

  update(dt, game) {
    this.healthBar.quaternion.copy(game.camera.quaternion);
    if (game.isUiOpen()) return; // monsters wait politely while you read

    const pos = this.object3d.position;
    const player = game.player;
    const p = player.object3d.position;
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const toPlayer = { x: dx / dist, z: dz / dist, dist, playerDown: player.dead };

    this.stunTimer -= dt;
    if (this.stunTimer <= 0) this.think(dt, game, toPlayer);

    // Physics
    if (this.flying) this.fly(dt);
    else {
      if (this.aquatic) this.swim(dt, game);
      else this.walk(dt, game);
      pushOut(pos, this.radius, game.colliders, this.collider);
    }
    this.collider.x = pos.x;
    this.collider.z = pos.z;

    // Sword slashes (each swing counts once, and one swing can hit lots of monsters)
    const strike = player.strike;
    if (strike && strike.id !== this.lastSwing && player.slashReaches(this)) {
      this.lastSwing = strike.id;
      if (this.dodges?.(game)) this.dodge(game, toPlayer); // some masters just aren't there when the sword arrives
      else {
        player.swordHit?.(game, this);
        this.hit(game, toPlayer, strike.damage);
        if (this.health <= 0) return;
      }
    }

    // Touching the player hurts them. Sea monsters only reach swimmers, land monsters only
    // walkers, flyers anyone they can get close to.
    this.contactCooldown -= dt;
    let reachable;
    if (this.flying) reachable = Math.abs(pos.y - (p.y + 1)) < this.radius + 1;
    else if (this.aquatic) reachable = player.swimming;
    else reachable = !player.swimming && pos.y < 1 && p.y < 1.5;
    if (this.touchDamage && !player.dead && !player.invisible && reachable && dist < this.radius + 0.6 && this.contactCooldown <= 0) {
      const result = player.takeDamage(game, this.power, pos.x, pos.z);
      this.contactCooldown = CONTACT_COOLDOWN;
      if (result === 'blocked' && player.shieldTier >= 1) this.bounce(toPlayer); // the Iron Shield pushes back
      else if (result === 'hurt') this.bitPlayer?.(toPlayer);
    }

    // Flash white when hit
    this.flashTimer -= dt;
    this.setFlash(this.flashTimer > 0);

    this.animate(dt, game);
  }

  walk(dt, game) {
    const pos = this.object3d.position;
    this.velocity.y -= GRAVITY * dt;
    const nx = pos.x + this.velocity.x * dt * this.speedScale;
    const nz = pos.z + this.velocity.z * dt * this.speedScale;
    if (game.isWalkable(nx, nz, this.radius)) {
      pos.x = nx;
      pos.z = nz;
    }
    pos.y += this.velocity.y * dt;
    if (pos.y <= 0) {
      pos.y = 0;
      if (!this.onGround) this.landed?.();
      this.onGround = true;
      this.velocity.y = 0;
      if (this.stunTimer <= 0) this.velocity.x = this.velocity.z = 0;
    }
  }

  fly(dt) {
    if (this.stunTimer > 0) this.velocity.multiplyScalar(Math.exp(-3 * dt));
    this.object3d.position.addScaledVector(this.velocity, dt * this.speedScale);
  }

  swim(dt, game) {
    const pos = this.object3d.position;
    if (this.stunTimer > 0) this.velocity.multiplyScalar(Math.exp(-3 * dt)); // drifting after a hit
    const nx = pos.x + this.velocity.x * dt * this.speedScale;
    const nz = pos.z + this.velocity.z * dt * this.speedScale;
    if (this.canSwimAt(game, nx, pos.z)) pos.x = nx;
    if (this.canSwimAt(game, pos.x, nz)) pos.z = nz;
    pos.y = SEA.level - SEA.monsterDepth; // down under the water with you
    this.velocity.y = 0;
  }

  /** Knocked away by the Iron Shield. */
  bounce(toPlayer) {
    this.velocity.set(-toPlayer.x * 9, this.aquatic ? 0 : 4, -toPlayer.z * 9);
    this.onGround = false;
    this.stunTimer = 0.8;
  }

  setFlash(on) {
    if (on === this.flashing) return;
    this.flashing = on;
    this.body.traverse((o) => {
      if (!o.material?.emissive) return;
      o.userData.emissive ??= { color: o.material.emissive.clone(), intensity: o.material.emissiveIntensity };
      const original = o.userData.emissive;
      o.material.emissive.copy(on ? new THREE.Color('#ffffff') : original.color);
      o.material.emissiveIntensity = on ? 0.9 : original.intensity;
    });
  }

  hit(game, toPlayer, damage = 1) {
    this.health -= damage;
    this.flashTimer = 0.15;
    this.stunTimer = 0.35;
    this.velocity.set(-toPlayer.x * 7, this.aquatic ? 0 : this.flying ? 2 : 5, -toPlayer.z * 7); // knocked back
    this.onGround = false;

    this.healthBar.visible = true;
    const fraction = Math.max(0, this.health / this.maxHealth);
    this.healthFill.scale.x = Math.max(0.001, fraction);
    this.healthFill.position.x = (-this.healthFillWidth / 2) * (1 - fraction);

    const center = this.object3d.position.clone().setY(this.object3d.position.y + this.radius);
    game.particles?.burst(center, { count: 14, colors: this.colors, speed: 6, size: 0.2 });

    if (this.health <= 0) this.defeat(game);
  }

  defeat(game) {
    const where = this.object3d.position.clone();
    game.particles?.burst(where.clone().setY(where.y + this.radius), {
      count: 30 + this.radius * 30,
      colors: this.colors,
      speed: 8,
      size: 0.25,
      life: 1.4,
    });
    if (this.coins) {
      const coins = this.coins * (game.player.buffs?.luckyTail ? BUFFS.luckyTail.coins : 1); // Lucky Tail buff
      game.player.addCoins(coins);
      game.particles?.burst(where.clone().setY(where.y + 1), { count: coins * 3, colors: ['#ffc93c', '#ffe08a'], speed: 5, size: 0.14 });
    }
    // Magic points for the dream abilities: (health + damage) / 4, at least 1 (with a magic conduit).
    if (game.player.hasConduit) {
      game.player.addMagic(magicPoints(this));
      game.particles?.burst(where.clone().setY(where.y + 1.2), { count: 10, colors: ['#b47dff', '#7af0ff', '#ffffff'], speed: 3, size: 0.12, gravity: -3 });
      game.sound?.play('magic');
    }
    game.remove(this);
    this.onDefeated?.(where);
  }
}
