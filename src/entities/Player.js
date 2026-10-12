import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { pushOut } from '../core/collision.js';
import { createCharacter, poseWalk, turnToward } from '../models/character.js';
import { createSword, createShield, createBow, addArmor, createAxe, createPickaxe } from '../models/gear.js';
import { Arrow } from './Arrow.js';
import { PLAYER, SWORDS, FORGE, FOOD, BOW, SEA } from '../config.js';

const WALK_SPEED = 6;
const RUN_SPEED = 11;
const SHIELD_SPEED = 3; // you move slowly while holding the wooden shield up
const SWIM_SPEED = 4.5;
const SWIM_FAST = 6.5;
const SWIM_DEPTH = 1.1; // how far below the water surface your feet are
const STEP_UP = 0.6; // tallest ledge you can walk up without jumping (stairs are 0.5)
const JUMP_SPEED = 9;
const GRAVITY = 28;
const RADIUS = 0.4;
const ATTACK_TIME = 0.55; // seconds for one sword swing
const STRIKE_WINDOW = [0.25, 0.8]; // part of the swing that can hit things
const SLASH_ARC = Math.cos(THREE.MathUtils.degToRad(80)); // the slash sweeps 80 degrees to each side
const SWORD_REST = Math.PI / 2 - 0.5; // how the sword sits in the hand (see createSword)
const FOLLOW_THROUGH = 0.3; // seconds the bow stays up after the arrow flies
const AIM_CONE = Math.cos(THREE.MathUtils.degToRad(35)); // arrows lock on to monsters roughly ahead
const HURT_INVULNERABLE = 1.2; // seconds of safety after being hit
const RESPAWN_TIME = 2.5;

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

/**
 * The player character: walks relative to the camera, jumps, swims, swings a sword (Return or
 * click), blocks with a shield (hold J), shoots a bow (K), eats food (F), has hearts and coins,
 * and respawns in the village when knocked out. Controls are ignored while a dialog or menu is open.
 *
 * Gear from the shops: shieldTier (-1 none, 0 wooden, 1 iron), swordTier, bowTier (-1 none,
 * 0 bow, 1 power bow), arrows, armor, food, hasAxe / hasPickaxe. Materials: wood, stone.
 * tempHealth is golden extra hearts (from special food) that soak up damage first.
 */
export class Player extends Entity {
  constructor({ x = 0, z = 0 } = {}) {
    super();
    this.spawn = new THREE.Vector3(x, 0, z);
    this.model = createCharacter();
    this.model.armR.rotation.order = 'YXZ'; // so the sword arm can sweep sideways (rotation.y)
    this.model.root.rotation.order = 'YXZ'; // so lying flat to swim works whichever way we face
    this.prone = 0; // 0 = upright, 1 = lying flat on the water doing the front crawl
    this.object3d.add(this.model.root);
    this.object3d.position.copy(this.spawn);

    this.swordTier = 0;
    this.sword = createSword(this.swordTier);
    this.model.handR.add(this.sword);
    this.shieldTier = -1; // bought from the blacksmith
    this.shield = createShield(0);
    this.shield.visible = false;
    this.model.handL.add(this.shield);
    this.bowTier = -1;
    this.bow = createBow();
    this.bow.visible = false;
    this.wearBowOnBack();
    this.armor = false;
    this.food = []; // ids from FOOD.menu, at most FOOD.carry
    this.hasAxe = false;
    this.hasPickaxe = false;
    this.wood = 0;
    this.stone = 0;
    this.toolTimer = 0; // > 0 while chopping or mining
    this.tool = null; // the axe or pickaxe model while it's out

    this.maxHealth = PLAYER.maxHealth;
    this.health = this.maxHealth;
    this.tempHealth = 0;
    this.coins = 0;

    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.swimming = false;
    this.walkPhase = 0;
    this.swimPhase = 0;
    this.attackTimer = 0;
    this.swingId = 0;
    this.drawing = false; // pulling the bowstring back
    this.charge = 0; // seconds the string has been pulled
    this.shootTimer = 0; // > 0 just after an arrow flies
    this.arrows = 0;
    this.stunTimer = 0;
    this.shielding = false;
    this.invulnerable = 0;
    this.sinceHurt = 999;
    this.regenTimer = 0;
    this.dead = false;
    this.deadTimer = 0;
  }

  onAdd(game) {
    game.player = this;
  }

  get swordStats() {
    return SWORDS[this.swordTier];
  }

  get hasShield() {
    return this.shieldTier >= 0;
  }

  get hasBow() {
    return this.bowTier >= 0;
  }

  /** Damage the arrow would do if it flew right now. The power bow hits harder the longer you charge. */
  get arrowDamage() {
    if (this.bowTier < 1) return BOW.damage;
    return THREE.MathUtils.clamp(Math.floor(this.charge / BOW.secondsPerDamage), 1, BOW.maxDamage);
  }

  /** True during a sword swing. */
  get isAttacking() {
    return this.attackTimer > 0;
  }

  /**
   * While the blade is sweeping round: { id, damage }, otherwise null.
   * `id` changes every swing, so enemies can make sure each swing only hits them once.
   * Use slashReaches(monster) to see if the slash hits a particular monster.
   */
  get strike() {
    if (!this.isAttacking) return null;
    const t = 1 - this.attackTimer / ATTACK_TIME;
    if (t < STRIKE_WINDOW[0] || t > STRIKE_WINDOW[1]) return null;
    return { id: this.swingId, damage: this.swordStats.damage };
  }

  /** Is this monster inside the sideways sweep of the sword (a wide arc in front of us)? */
  slashReaches(monster) {
    const pos = this.object3d.position;
    const m = monster.object3d.position;
    const dx = m.x - pos.x;
    const dz = m.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist - monster.radius > this.swordStats.reach + 0.9) return false;
    if (monster.flying && Math.abs(m.y - (pos.y + 1)) > monster.radius + 1.6) return false;
    if (dist < monster.radius + 0.4) return true; // right on top of us
    const facing = this.model.root.rotation.y;
    return (dx * Math.sin(facing) + dz * Math.cos(facing)) / dist > SLASH_ARC;
  }

  addCoins(amount) {
    this.coins += amount;
  }

  // ---- Gear from the shops ----

  giveShield() {
    this.shieldTier = Math.max(this.shieldTier, 0);
    this.shield.visible = true;
  }

  /** The Iron Shield: walk at full speed while blocking, and bounce monsters away. */
  upgradeShield() {
    this.shieldTier = 1;
    this.model.handL.remove(this.shield);
    this.shield = createShield(1);
    this.model.handL.add(this.shield);
  }

  upgradeSword() {
    this.swordTier = Math.min(this.swordTier + 1, SWORDS.length - 1);
    this.model.handR.remove(this.sword);
    this.sword = createSword(this.swordTier);
    this.model.handR.add(this.sword);
  }

  giveBow() {
    this.bowTier = Math.max(this.bowTier, 0);
    this.bow.visible = true;
    this.arrows = Math.max(this.arrows, BOW.startArrows);
  }

  /** Returns how many actually fit in the quiver. */
  addArrows(count) {
    const added = Math.min(count, BOW.maxArrows - this.arrows);
    this.arrows += added;
    return added;
  }

  /** The power bow: hold the bow key to charge up a stronger arrow. */
  upgradeBow() {
    this.bowTier = 1;
    this.bow.scale.setScalar(1.25);
    this.bow.traverse((o) => o.material?.color.set?.(o.material.color.getHex() === 0xf4ecd8 ? '#ffe08a' : '#5e2b8a'));
  }

  giveTool(kind) {
    if (kind === 'axe') this.hasAxe = true;
    else this.hasPickaxe = true;
  }

  /** Swing the axe or pickaxe once (the chopping/mining itself is done by whoever asked). */
  useTool(kind) {
    if (this.tool) this.model.handR.remove(this.tool);
    this.tool = kind === 'axe' ? createAxe() : createPickaxe();
    this.model.handR.add(this.tool);
    this.sword.visible = false;
    this.toolTimer = 0.45;
  }

  get usingBow() {
    return this.drawing || this.shootTimer > 0;
  }

  giveArmor() {
    if (this.armor) return;
    this.armor = true;
    this.maxHealth += FORGE.armorHearts;
    this.health = this.maxHealth;
    addArmor(this.model);
  }

  /** Returns false if your bag is already full. */
  addFood(id) {
    if (this.food.length >= FOOD.carry) return false;
    this.food.push(id);
    return true;
  }

  /**
   * Eat the food that best fits: when hurt, the smallest snack that fills you up (or the biggest
   * you have); at full health, the one with the most golden extra hearts.
   * Returns { item, healed, extra } (or null if there's nothing worth eating).
   */
  eat(game) {
    const missing = this.maxHealth - this.health;
    const items = this.food.map((id) => FOOD.menu.find((f) => f.id === id));
    let item;
    if (missing > 0) {
      const fits = items.filter((f) => f.heals >= missing).sort((a, b) => a.heals - b.heals || a.extra - b.extra)[0];
      item = fits ?? [...items].sort((a, b) => b.heals - a.heals)[0];
    } else {
      item = items.filter((f) => f.extra > 0 && this.tempHealth < FOOD.maxExtra).sort((a, b) => b.extra - a.extra)[0];
    }
    if (!item) return null;
    this.food.splice(this.food.indexOf(item.id), 1);
    const healed = Math.min(missing, item.heals);
    this.health += healed;
    const extra = Math.min(item.extra, FOOD.maxExtra - this.tempHealth);
    this.tempHealth += extra;
    game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1.8), {
      count: 16,
      colors: ['#ff4d6d', '#ff8fab', '#ffffff'],
      speed: 3,
      size: 0.14,
      gravity: -2,
    });
    return { item, healed, extra };
  }

  // ---- Getting hurt ----

  /** Bounce the player away in direction (dx, dz). */
  knockback(dx, dz, power = 9) {
    this.velocity.set(dx * power, this.swimming ? 0 : 6, dz * power);
    this.onGround = false;
    this.stunTimer = 0.4;
  }

  /**
   * Something hit us from (fromX, fromZ). The shield blocks it completely.
   * Returns 'blocked', 'hurt', or 'ignored' (already hurt recently, or knocked out).
   */
  takeDamage(game, amount, fromX, fromZ) {
    if (this.dead || this.invulnerable > 0) return 'ignored';
    const pos = this.object3d.position;
    let dx = pos.x - fromX;
    let dz = pos.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;

    if (this.shielding) {
      this.knockback(dx, dz, this.shieldTier >= 1 ? 2 : 4);
      this.invulnerable = 0.4;
      game.particles?.burst(pos.clone().add(new THREE.Vector3(-dx * 0.6, 1.2, -dz * 0.6)), {
        count: 10,
        colors: ['#ffffff', '#ffe08a', '#bfe6ff'],
        speed: 4,
        size: 0.1,
        life: 0.4,
      });
      return 'blocked';
    }

    // Golden extra hearts go first.
    const soaked = Math.min(this.tempHealth, amount);
    this.tempHealth -= soaked;
    this.health = Math.max(0, this.health - (amount - soaked));
    this.invulnerable = HURT_INVULNERABLE;
    this.sinceHurt = 0;
    this.knockback(dx, dz, 9);
    game.statusBar?.hurt();
    if (this.health === 0) this.knockOut(game);
    return 'hurt';
  }

  knockOut(game) {
    this.dead = true;
    this.deadTimer = RESPAWN_TIME;
    this.attackTimer = 0;
    this.drawing = false;
    this.tempHealth = 0;
    this.shootTimer = 0;
    this.wearBowOnBack();
    game.statusBar?.showDefeated(true);
  }

  respawn(game) {
    this.dead = false;
    this.swimming = false;
    this.health = this.maxHealth;
    this.object3d.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.model.root.rotation.x = 0;
    this.model.root.position.set(0, 0, 0);
    this.prone = 0;
    this.invulnerable = 2;
    game.statusBar?.showDefeated(false);
  }

  // ---- Moving around ----

  /** Can we move our feet to (x, z)? Handles the sea, the dock, ledges and stairs. */
  canMoveTo(game, x, z) {
    const pos = this.object3d.position;
    if (this.swimming) {
      // Climb out wherever there's low land (a beach, the dock).
      if (game.isWalkable(x, z)) return game.heightAt(x, z) <= SEA.level + 1.5;
      return Math.hypot(x, z) < SEA.radius;
    }
    if (game.isWalkable(x, z)) return game.heightAt(x, z) <= pos.y + STEP_UP;
    // You get into the sea off the dock (or off the shore of an island out at sea).
    if (game.dock?.isInside(pos.x, pos.z)) return true;
    return game.lands.some((land) => land.swimFromShore && land.isInside(pos.x, pos.z) && pos.y < 0.5);
  }

  update(dt, game) {
    const { input, camera } = game;
    const pos = this.object3d.position;
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.sinceHurt += dt;

    if (this.dead) {
      this.deadTimer -= dt;
      this.model.root.rotation.x = THREE.MathUtils.lerp(this.model.root.rotation.x, -Math.PI / 2, 1 - Math.exp(-8 * dt));
      this.model.root.visible = true;
      const floor = this.swimming ? SEA.level - 0.3 : game.heightAt(pos.x, pos.z);
      pos.y = Math.max(floor, pos.y - 8 * dt); // drop to the ground (or float)
      if (this.deadTimer <= 0) this.respawn(game);
      return;
    }

    // Hearts slowly come back when you stay out of trouble.
    if (this.health < this.maxHealth && this.sinceHurt > PLAYER.regenDelay) {
      this.regenTimer += dt;
      if (this.regenTimer >= PLAYER.regenInterval) {
        this.regenTimer = 0;
        this.health++;
      }
    } else {
      this.regenTimer = 0;
    }

    const controls = !game.isUiOpen() && this.stunTimer === 0;
    this.shielding = controls && this.hasShield && !this.swimming && !this.usingBow && input.held('shield');

    // Camera-relative movement on the ground plane.
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.set(-_forward.z, 0, _forward.x);

    _move.set(0, 0, 0);
    if (controls) {
      const f = input.axisOf('back', 'forward');
      const r = input.axisOf('left', 'right');
      _move.addScaledVector(_forward, f).addScaledVector(_right, r);
      if (_move.lengthSq() > 0) _move.normalize();
    }

    const fast = input.held('run');
    let speed = fast ? RUN_SPEED : WALK_SPEED;
    if (this.swimming) speed = fast ? SWIM_FAST : SWIM_SPEED;
    else if (this.shielding) speed = this.shieldTier >= 1 ? WALK_SPEED : SHIELD_SPEED;
    if (this.drawing) speed = Math.min(speed, SHIELD_SPEED); // steady while aiming
    if (this.stunTimer === 0) {
      const grip = this.swimming ? 5 : this.onGround ? 14 : 4;
      const accel = 1 - Math.exp(-grip * dt);
      this.velocity.x += (_move.x * speed - this.velocity.x) * accel;
      this.velocity.z += (_move.z * speed - this.velocity.z) * accel;
    }

    if (controls && this.onGround && !this.swimming && input.hit('jump')) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }
    // No sword swings (or arrows) while the shield is up.
    const free = controls && !this.shielding && !this.isAttacking && !this.usingBow && this.toolTimer === 0;
    if (free && (input.hit('swing') || input.clicked)) {
      this.attackTimer = ATTACK_TIME;
      this.swingId++;
    } else if (free && this.hasBow && input.hit('bow')) {
      this.startDraw(game);
    }
    if (controls && input.hit('eat')) this.tryEat(game);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.updateTool(dt);
    if (this.drawing) {
      this.charge = Math.min(this.charge + dt, BOW.maxDamage * BOW.secondsPerDamage);
      // The plain bow fires as soon as it's drawn; the power bow keeps charging while you hold the key.
      const letGo = this.bowTier < 1 || !input.held('bow') || !controls;
      if (this.charge >= BOW.drawTime && letGo) this.shoot(game);
    } else if (this.shootTimer > 0 && (this.shootTimer = Math.max(0, this.shootTimer - dt)) === 0) this.wearBowOnBack();
    this.velocity.y -= GRAVITY * dt;

    // Move one axis at a time so we slide along walls and the island edge instead of sticking.
    const nx = pos.x + this.velocity.x * dt;
    if (this.canMoveTo(game, nx, pos.z)) pos.x = nx;
    const nz = pos.z + this.velocity.z * dt;
    if (this.canMoveTo(game, pos.x, nz)) pos.z = nz;
    pos.y += this.velocity.y * dt;

    pushOut(pos, RADIUS, game.colliders);
    this.updateWater(game);

    if (this.swimming) {
      const surface = SEA.level - SWIM_DEPTH + Math.sin(game.elapsed * 2.2) * 0.05;
      if (pos.y <= surface) {
        pos.y = surface;
        this.velocity.y = 0;
      }
      this.onGround = false;
    } else {
      const ground = game.heightAt(pos.x, pos.z);
      if (pos.y <= ground) {
        pos.y = ground;
        this.velocity.y = 0;
        this.onGround = true;
      } else if (pos.y > ground + 0.05) {
        this.onGround = false; // walked off a ledge
      }
    }

    this.animate(dt, controls, game);
  }

  /** Jump in when we leave the dock; climb out when we reach land. */
  updateWater(game) {
    const pos = this.object3d.position;
    const onLand = game.isWalkable(pos.x, pos.z);
    if (!this.swimming && !onLand) {
      this.swimming = true;
      this.splash(game, 30);
      game.questLog?.toast('Splash! To get out, swim back to the dock or a beach.');
    } else if (this.swimming && onLand) {
      this.swimming = false;
      pos.y = Math.max(pos.y, game.heightAt(pos.x, pos.z));
      this.velocity.y = 0;
      this.onGround = true;
      this.splash(game, 12);
    }
  }

  splash(game, count) {
    game.particles?.burst(this.object3d.position.clone().setY(SEA.level + 0.2), {
      count,
      colors: ['#ffffff', '#bfe6ff', '#3cc6ea'],
      speed: 4,
      size: 0.16,
      life: 0.7,
    });
  }

  tryEat(game) {
    if (!this.food.length) {
      game.questLog?.toast('No food! Hana the baker sells some in the village.');
      return;
    }
    const eaten = this.eat(game);
    if (!eaten) {
      game.questLog?.toast("You're not hungry. Your hearts are full!");
      return;
    }
    const { item, healed, extra } = eaten;
    const parts = [];
    if (healed) parts.push(`+${healed} ${healed === 1 ? 'heart' : 'hearts'}`);
    if (extra) parts.push(`+${extra} golden ${extra === 1 ? 'heart' : 'hearts'}`);
    game.questLog?.toast(`Yum! ${item.icon} ${item.name} ${parts.join(', ') || ''}`.trim());
  }

  /** K: start pulling the bowstring back. The arrow flies after BOW.drawTime seconds. */
  startDraw(game) {
    if (this.arrows <= 0) {
      game.questLog?.toast('Out of arrows! The blacksmith sells more.');
      return;
    }
    this.drawing = true;
    this.charge = 0;
    this.holdBow();
  }

  updateTool(dt) {
    if (this.toolTimer <= 0) return;
    this.toolTimer = Math.max(0, this.toolTimer - dt);
    if (this.toolTimer === 0) {
      this.model.handR.remove(this.tool);
      this.tool = null;
      this.sword.visible = true;
    }
  }

  /** Fire an arrow, locking on to a monster that's roughly ahead of us. */
  shoot(game) {
    const damage = this.arrowDamage;
    this.drawing = false;
    this.charge = 0;
    this.arrows--;
    const pos = this.object3d.position;
    let angle = this.model.root.rotation.y;
    let target = null;
    let bestDist = Infinity;
    for (const m of game.monsters) {
      const dx = m.object3d.position.x - pos.x;
      const dz = m.object3d.position.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 24 || dist < 0.01) continue;
      if ((dx * Math.sin(angle) + dz * Math.cos(angle)) / dist < AIM_CONE) continue;
      if (dist < bestDist) {
        target = m;
        bestDist = dist;
      }
    }
    const aimAt = target?.object3d.position.clone().setY(target.object3d.position.y + target.radius);
    if (aimAt) angle = Math.atan2(aimAt.x - pos.x, aimAt.z - pos.z);
    this.model.root.rotation.y = angle;

    const start = pos.clone().add(new THREE.Vector3(Math.sin(angle) * 0.6, 0, Math.cos(angle) * 0.6));
    start.y = this.swimming ? SEA.level + 0.9 : pos.y + 1.3;
    game.add(new Arrow(start, Arrow.aim(start, aimAt, angle), damage));
    this.shootTimer = FOLLOW_THROUGH;
  }

  wearBowOnBack() {
    this.model.root.add(this.bow);
    this.bow.position.set(0, 1.15, -0.26);
    this.bow.rotation.set(0, 0, 0.6);
    if (this.hasShield) this.shield.visible = true;
  }

  holdBow() {
    this.model.handL.add(this.bow);
    this.bow.position.set(0, -0.05, 0.1);
    this.bow.rotation.set(Math.PI / 2, 0, 0);
    this.shield.visible = false;
  }

  /** Turn to look at a point (used when someone talks to us). */
  face(x, z, dt) {
    const pos = this.object3d.position;
    turnToward(this.model, Math.atan2(x - pos.x, z - pos.z), dt, 8);
  }

  animate(dt, controls, game) {
    const { root, armL, armR, legL, legR } = this.model;
    const horizontal = Math.hypot(this.velocity.x, this.velocity.z);

    // Blink while invulnerable after a hit.
    root.visible = this.invulnerable <= 0 || Math.floor(this.invulnerable * 12) % 2 === 0;

    if (horizontal > 0.5 && controls && !this.usingBow) {
      turnToward(this.model, Math.atan2(this.velocity.x, this.velocity.z), dt);
    }

    armL.rotation.z = 0;
    armR.rotation.z = 0;
    this.model.head.rotation.y = 0;

    // Swimming: lie flat on the water when moving, float upright (treading water) when still.
    const stroking = this.swimming && horizontal > 1;
    this.prone += ((stroking ? 1 : 0) - this.prone) * (1 - Math.exp(-5 * dt));
    root.rotation.x = 1.35 * this.prone;
    // Lift and shift the body so it lies along the surface, centered where we are.
    const facing = root.rotation.y;
    root.position.set(-Math.sin(facing) * 0.85 * this.prone, 0.95 * this.prone, -Math.cos(facing) * 0.85 * this.prone);

    if (this.swimming) {
      this.swimPhase += dt * (stroking ? 4.2 : 2.5);
      const p = this.swimPhase;
      if (stroking) {
        // Front crawl: each arm goes up over the water, reaches forward, pulls down and back
        // under the water. Legs flutter-kick, and the head turns to the side to breathe.
        armR.rotation.x = p % (Math.PI * 2);
        armL.rotation.x = (p + Math.PI) % (Math.PI * 2);
        legL.rotation.x = Math.sin(p * 3) * 0.3;
        legR.rotation.x = -Math.sin(p * 3) * 0.3;
        this.model.head.rotation.y = Math.max(0, Math.sin(p)) * 0.7;
        if (Math.floor(p / Math.PI) !== Math.floor((p - dt * 4.2) / Math.PI)) this.splash(game, 3); // hand hits the water
      } else {
        // Treading water: hands scull side to side, legs pedal slowly.
        armR.rotation.x = -0.3;
        armL.rotation.x = -0.3;
        armR.rotation.z = -0.9 - Math.sin(p * 2) * 0.35;
        armL.rotation.z = 0.9 + Math.sin(p * 2) * 0.35;
        legL.rotation.x = Math.sin(p) * 0.5;
        legR.rotation.x = -Math.sin(p) * 0.5;
      }
    } else if (this.onGround) {
      this.walkPhase += horizontal * dt * 1.6;
      poseWalk(this.model, this.walkPhase, Math.min(horizontal / WALK_SPEED, 1.3) * 0.8);
    } else {
      legL.rotation.x = -0.5;
      legR.rotation.x = 0.3;
      armR.rotation.x = -2.6;
      armL.rotation.x = -0.4;
    }

    if (this.shielding) {
      // Shield up across the front of the body, sword arm down.
      armL.rotation.x = -1.25;
      armL.rotation.z = -0.55;
      armR.rotation.x = 0.25;
    } else if (this.hasShield && !this.swimming) {
      armL.rotation.x = armL.rotation.x * 0.3 - 0.6; // carry the shield a little forward
    }
    // Keep the shield's face pointing forward whatever the arm is doing.
    this.shield.rotation.x = -armL.rotation.x;
    this.shield.rotation.y = this.shielding ? 0.5 : 0;

    armR.rotation.y = 0;
    this.sword.rotation.x = SWORD_REST;
    if (this.usingBow) {
      // Bow arm straight out, string hand pulled back further the longer you draw.
      const pull = this.drawing ? Math.min(1, this.charge / BOW.drawTime) : 0;
      armL.rotation.x = -Math.PI / 2;
      armR.rotation.x = -Math.PI / 2 + 0.2 + pull * 0.5;
      armR.rotation.y = pull * 0.6;
      armR.rotation.z = 0;
    }

    if (this.toolTimer > 0) {
      // Chop / mine: lift the tool up, then bring it down hard.
      const t = 1 - this.toolTimer / 0.45;
      armR.rotation.x = t < 0.4 ? THREE.MathUtils.lerp(0, -2.7, t / 0.4) : THREE.MathUtils.lerp(-2.7, -0.4, (t - 0.4) / 0.6);
    }

    if (this.isAttacking) {
      // A sideways slash: arm out level, wind back to the right, then sweep across to the left.
      const t = 1 - this.attackTimer / ATTACK_TIME;
      const windUp = 0.25;
      armR.rotation.x = -1.4;
      armR.rotation.y =
        t < windUp
          ? THREE.MathUtils.lerp(0, -1.6, t / windUp)
          : THREE.MathUtils.lerp(-1.6, 1.4, 1 - (1 - (t - windUp) / (1 - windUp)) ** 3);
      this.sword.rotation.x = Math.PI - 0.15; // blade held out flat, along the arm
    }
  }
}
