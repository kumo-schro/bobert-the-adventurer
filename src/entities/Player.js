import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { pushOut, colliderAt } from '../core/collision.js';
import { createCharacter, poseWalk, turnToward, part } from '../models/character.js';
import { createSword, createShield, createBow, addArmor } from '../models/gear.js';
import { Arrow } from './Arrow.js';
import { SwordTrail } from './SwordTrail.js';
import { MOVES, poseAt } from './swordMoves.js';
import { PLAYER, SWORDS, FORGE, FOOD, BOW, SEA, DREAM, BUFFS, SKY_STRIKE, DODGE, MAGIC, CRYSTALS, FAME } from '../config.js';

const WALK_SPEED = PLAYER.walkSpeed;
const RUN_SPEED = PLAYER.runSpeed;
const SHIELD_SPEED = 3; // you move slowly while holding the wooden shield up
const SWIM_SPEED = 4.5;
const SWIM_FAST = 6.5;
const SWIM_DEPTH = SEA.swimDepth; // swimming happens underwater
const STEP_UP = 0.6; // tallest ledge you can walk up without jumping (stairs are 0.5)
const JUMP_SPEED = 9;
const BOUNCE_SPEED = 20; // off a dream bounce mushroom (about 7 high)
const GRAVITY = 28;
const RADIUS = 0.4;
const COMBO_WINDOW = 0.45; // swing again within this many seconds to chain the next move of the combo
const SLASH_ARC = Math.cos(THREE.MathUtils.degToRad(80)); // the slash sweeps 80 degrees to each side
const SPIN_TIME = 0.6; // seconds for one spin attack
const SPIN_CHARGE = 0.5; // hold the swing button this long (after a swing) to charge a spin
const SWORD_REST = Math.PI / 2 - 0.5; // how the sword sits in the hand (see createSword)
const FOLLOW_THROUGH = 0.25; // seconds the bow stays up after the arrow flies
const AIM_CONE = Math.cos(THREE.MathUtils.degToRad(35)); // arrows lock on to monsters roughly ahead
const HURT_INVULNERABLE = 1.2; // seconds of safety after being hit
const RESPAWN_TIME = 2.5;
const LUNGE_TIME = 0.12; // a swing steps you in toward a monster that's just out of reach
const BURST_TIME = 0.55; // how long the Star Burst ring takes to spread out

const _forward = new THREE.Vector3();
const _pose = {};
const _trailBase = new THREE.Vector3();
const _trailTip = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

/**
 * The player character: walks relative to the camera, jumps, rolls (Shift, and keep holding it to
 * run), swims, swings a sword (Return or click: hold it for a spin, swing in mid-air for a Sky
 * Strike), blocks with a shield (hold J), shoots a bow (K), eats food (F) and uses the Star Burst
 * dream power (L). Has health and coins, and gets back up at the last save crystal (or the
 * village) when knocked out. Controls are ignored while a dialog or menu is open.
 *
 * Gear from the shops: shieldTier (-1 none, 0 wooden, 1 iron), swordTier, bowTier (-1 none,
 * 0 bow, 1 power bow), armor, food.
 */
export class Player extends Entity {
  constructor({ x = 0, z = 0 } = {}) {
    super();
    this.spawn = new THREE.Vector3(x, 0, z);
    this.model = createCharacter();
    this.model.armR.rotation.order = 'YXZ'; // so the sword arm can sweep sideways (rotation.y)
    this.model.root.rotation.order = 'YXZ'; // so lying flat to swim works whichever way we face
    // A pivot between the root (which way we face) and the body, for twisting and leaning into
    // sword swings without changing which way we're facing.
    this.pose = new THREE.Group();
    while (this.model.root.children.length) this.pose.add(this.model.root.children[0]);
    this.model.root.add(this.pose);
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

    this.maxHealth = PLAYER.maxHealth;
    this.health = this.maxHealth;
    this.coins = 0;
    this.fame = 0; // won back by helping people (see FAME): with enough, Tulane's herald comes for you
    this.heartCrystals = 0; // from Pip's crystal shop: +1 max health each
    this.swiftCrystal = false; // more of Pip's crystals: a little faster on foot...
    this.seaCrystal = false; // ...faster swimming...
    this.luckyCrystal = false; // ...and more coins from every monster
    this.hasConduit = false; // the magic conduit (from the dream shrine) holds magic points...
    this.magic = 0; // ...which you get by defeating monsters, and spend on the Star Burst
    this.buffs = {}; // buff id (see BUFFS) -> seconds left
    this.knowsSkyStrike = false; // Master Oak teaches it: swing in mid-air to dive and slam
    this.knowsPerfectDodge = false; // Master Jackson teaches it: roll through an attack to counter
    this.hasDoubleJump = false; // dream abilities (see DREAM_ABILITIES)
    this.hasDreamDash = false;
    this.hasDreamHeal = false;
    this.skyStriking = false;
    this.usedDoubleJump = false;
    // Rolling (Shift): dodgeTimer > 0 while rolling, then a short cooldown.
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.dodgeLength = DODGE.time;
    this.dashHits = new Set(); // monsters a Dream Dash has already hurt
    this.perfectThisRoll = false;
    this.counterTimer = 0; // > 0 after a Perfect Dodge: the next swing is a counter-attack
    this.counterSwing = -1; // the swing that's a counter
    this.running = false;
    this.coyote = 0; // seconds left to jump after leaving the ground
    this.jumpBuffer = 0; // seconds left on a jump pressed in mid-air
    this.burstCooldown = 0;
    this.burstTimer = 0;
    this.shieldHits = 0; // the star shield from a Star Burst
    this.shieldTimer = 0;
    // The star shield's glowing bubble
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffe66b', transparent: true, opacity: 0.22, depthWrite: false }),
    );
    this.bubble.position.y = 1;
    this.bubble.visible = false;
    this.object3d.add(this.bubble);
    // The Star Burst's ring of light, spreading out over the ground
    this.burstRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({ color: '#ffe66b', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.burstRing.rotation.x = -Math.PI / 2;
    this.burstRing.position.y = 0.3;
    this.burstRing.visible = false;
    this.object3d.add(this.burstRing);

    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.swimming = false;
    this.walkPhase = 0;
    this.swimPhase = 0;
    this.attackTimer = 0;
    this.attackDuration = 1;
    this.move = MOVES[0]; // the sword move we're doing (see swordMoves.js)
    this.comboStep = 0;
    this.lastSwingEnd = -99;
    this.queuedSwing = false;
    this.swingId = 0;
    this.drawing = false; // pulling the bowstring back
    this.charge = 0; // seconds the string has been pulled
    this.shootTimer = 0; // > 0 just after an arrow flies
    this.stunTimer = 0;
    this.shielding = false;
    this.invulnerable = 0;
    this.sinceHurt = 999;
    this.regenTimer = 0;
    this.landTimer = 0; // a little squash when landing from a jump
    this.dead = false;
    this.deadTimer = 0;
  }

  onAdd(game) {
    game.player = this;
    this.game = game;
    this.trail = game.add(new SwordTrail());
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

  /** True in the middle of a roll (or a Dream Dash). */
  get rolling() {
    return this.dodgeTimer > 0;
  }

  /** Damage the arrow would do if it flew right now. The power bow hits harder the longer you charge. */
  get arrowDamage() {
    if (this.bowTier < 1) return BOW.damage;
    const charged = Math.max(0, this.charge - BOW.drawTime);
    return THREE.MathUtils.clamp(1 + Math.floor(charged / BOW.secondsPerDamage), 1, BOW.maxDamage);
  }

  /** How far through the current swing we are, 0..1. */
  get swingProgress() {
    return 1 - this.attackTimer / this.attackDuration;
  }

  /** True during a sword swing. */
  get isAttacking() {
    return this.attackTimer > 0;
  }

  /** True while the blade is in the part of the swing that can hit (you can't roll out of that). */
  get inStrike() {
    if (!this.isAttacking) return false;
    if (this.spinning) return true;
    const t = this.swingProgress;
    return t >= this.move.strike[0] * 0.6 && t <= this.move.strike[1];
  }

  /**
   * While the blade is sweeping round: { id, damage, counter, knockback }, otherwise null.
   * The first hits of the combo barely push (so the next one reaches); the finisher and the spin launch.
   * `id` changes every swing, so enemies can make sure each swing only hits them once.
   * Use slashReaches(monster) to see if the slash hits a particular monster.
   */
  get strike() {
    if (!this.isAttacking) return null;
    const counter = this.counterSwing === this.swingId;
    const bonus = counter ? DODGE.counterBonus : 0;
    if (this.spinning) return { id: this.swingId, damage: this.swordStats.damage + 1 + bonus, counter, knockback: 9 };
    const t = this.swingProgress;
    if (t < this.move.strike[0] || t > this.move.strike[1]) return null;
    const knockback = this.move.slam || counter ? 10 : 3.5;
    return { id: this.swingId, damage: this.swordStats.damage + bonus, counter, knockback };
  }

  /** Is this monster inside the sideways sweep of the sword (a wide arc in front of us)? */
  slashReaches(monster) {
    const pos = this.object3d.position;
    const m = monster.object3d.position;
    const dx = m.x - pos.x;
    const dz = m.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const reach = this.swordStats.reach + 0.9 + (this.spinning ? 1 : 0);
    if (dist - monster.radius > reach) return false;
    if (monster.flying && Math.abs(m.y - (pos.y + 1)) > monster.radius + 1.6) return false;
    if (dist < monster.radius + 0.4 || this.spinning) return true; // right on top of us, or spinning all the way round
    const facing = this.model.root.rotation.y;
    return (dx * Math.sin(facing) + dz * Math.cos(facing)) / dist > SLASH_ARC;
  }

  /** The ending: a gold circlet, for Bobert of Tulane. */
  wearCrown() {
    if (this.crown) return;
    this.crowned = true;
    this.crown = part(this.model.head, [0.66, 0.12, 0.66], '#ffcf3f', [0, 0.7, 0]);
    part(this.crown, [0.12, 0.12, 0.06], '#3fd0ff', [0, 0.02, 0.34]);
  }

  /** Fame for a good deed. Once there's enough, Tulane Kingdom sends its herald. */
  addFame(game, amount, { quiet = false } = {}) {
    const before = this.fame;
    this.fame += amount;
    if (!quiet) game.questLog?.toast(`+${amount} fame`, { icon: '⭐' });
    if (before < FAME.needed && this.fame >= FAME.needed) game.onFamous?.();
  }

  /** A heart crystal from Pip: one more health to your max. */
  addHeartCrystal() {
    this.heartCrystals++;
    this.maxHealth++;
    this.health = Math.min(this.maxHealth, this.health + 1);
  }

  /** Magic points (only if you have a magic conduit to hold them). */
  addMagic(amount) {
    if (!this.hasConduit) return;
    this.magic = Math.min(MAGIC.max, this.magic + amount);
  }

  addCoins(amount) {
    this.coins += amount;
    if (amount > 0) this.game?.sound?.play('coin');
  }

  /** Health back (from a pickup, food or a Dream Heal), with a little sparkle. */
  heal(amount) {
    const healed = Math.min(amount, this.maxHealth - this.health);
    this.health += healed;
    if (healed > 0) {
      this.game?.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1.6), {
        count: 12,
        colors: ['#ff4d6d', '#ff8fab', '#ffffff'],
        speed: 2.5,
        size: 0.12,
        gravity: -3,
      });
      this.game?.statusBar?.healed();
    }
    return healed;
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
  }

  /** The power bow: hold the bow key to charge up a stronger arrow. */
  upgradeBow() {
    this.bowTier = 1;
    this.bow.scale.setScalar(1.25);
    this.bow.traverse((o) => o.material?.color.set?.(o.material.color.getHex() === 0xf4ecd8 ? '#ffe08a' : '#5e2b8a'));
  }

  get usingBow() {
    return this.drawing || this.shootTimer > 0;
  }

  giveArmor() {
    if (this.armor) return;
    this.armor = true;
    this.maxHealth += FORGE.armorHearts;
    this.health = this.maxHealth;
    addArmor({ ...this.model, root: this.pose });
  }

  /** Returns false if your bag is already full. */
  addFood(id) {
    if (this.food.length >= FOOD.carry) return false;
    this.food.push(id);
    return true;
  }

  /**
   * Eat the food that best fits: the smallest snack that fills you up (or the biggest you have).
   * Returns { item, healed } (or null if you're not hurt).
   */
  eat(game) {
    const missing = this.maxHealth - this.health;
    if (missing <= 0) return null;
    const items = this.food.map((id) => FOOD.menu.find((f) => f.id === id)).filter(Boolean);
    const fits = items.filter((f) => f.heals >= missing).sort((a, b) => a.heals - b.heals)[0];
    const item = fits ?? [...items].sort((a, b) => b.heals - a.heals)[0];
    if (!item) return null;
    this.food.splice(this.food.indexOf(item.id), 1);
    const healed = this.heal(item.heals);
    game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1.8), {
      count: 16,
      colors: ['#ff4d6d', '#ff8fab', '#ffffff'],
      speed: 3,
      size: 0.14,
      gravity: -2,
    });
    return { item, healed };
  }

  // ---- Getting hurt ----

  /** Bounce the player away in direction (dx, dz). */
  knockback(dx, dz, power = 9) {
    this.velocity.set(dx * power, this.swimming ? 0 : 6, dz * power);
    this.onGround = false;
    this.stunTimer = 0.4;
  }

  /**
   * Something hit us from (fromX, fromZ). A roll dodges it, and the shield or a star shield block it.
   * `hazard`: the ground itself (lava), which you can't roll past.
   * Returns 'blocked', 'hurt', 'dodged' or 'ignored' (already hurt recently, or knocked out).
   */
  takeDamage(game, amount, fromX, fromZ, { hazard = false } = {}) {
    if (this.dead || this.godMode) return 'ignored'; // godMode: debug menu cheat
    if (this.rolling && !hazard) {
      // Rolled right through it! With Master Jackson's lesson, that's a Perfect Dodge.
      if (this.knowsPerfectDodge && !this.perfectThisRoll) this.perfectDodge(game);
      return 'dodged';
    }
    if (this.invulnerable > 0) return 'ignored';
    const pos = this.object3d.position;
    let dx = pos.x - fromX;
    let dz = pos.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;

    if (this.shieldHits > 0 && !hazard) {
      // The star shield soaks up the hit.
      this.shieldHits--;
      this.invulnerable = 0.5;
      game.particles?.burst(pos.clone().setY(pos.y + 1), { count: 18, colors: ['#ffe66b', '#ffffff'], speed: 5, size: 0.12, life: 0.5 });
      if (this.shieldHits === 0) this.endStarShield();
      game.sound?.play('block');
      return 'blocked';
    }

    // The shield only blocks what comes from in front.
    const facing = this.model.root.rotation.y;
    const fromFront = -dx * Math.sin(facing) - dz * Math.cos(facing) > -0.2;
    if (this.shielding && fromFront && !hazard) {
      this.knockback(dx, dz, this.shieldTier >= 1 ? 2 : 4);
      this.invulnerable = 0.4;
      game.particles?.burst(pos.clone().add(new THREE.Vector3(-dx * 0.6, 1.2, -dz * 0.6)), {
        count: 10,
        colors: ['#ffffff', '#ffe08a', '#bfe6ff'],
        speed: 4,
        size: 0.1,
        life: 0.4,
      });
      game.cameraRig?.shake(0.12);
      game.sound?.play('block');
      return 'blocked';
    }

    if (this.buffs.toughScales) amount = Math.max(1, amount - 1);
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = HURT_INVULNERABLE;
    this.sinceHurt = 0;
    this.knockback(dx, dz, 9);
    this.attackTimer = 0; // knocked out of a swing
    this.spinCharge = 0;
    this.drawing = false;
    game.hitStop?.(0.08);
    game.cameraRig?.shake(0.35);
    game.statusBar?.hurt();
    game.sound?.play('hurt');
    if (this.health === 0) this.knockOut(game);
    return 'hurt';
  }

  /** Rolled through an attack at the last moment: time slows down, and the next swing is a counter. */
  perfectDodge(game) {
    this.perfectThisRoll = true;
    this.counterTimer = DODGE.counterTime;
    this.invulnerable = Math.max(this.invulnerable, 0.4);
    game.slowMo?.(DODGE.slowMo, DODGE.slowMoScale);
    game.floatText?.(this.object3d.position.clone().setY(this.object3d.position.y + 2.4), 'Perfect!', 'perfect');
    game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1), { count: 20, colors: ['#ffffff', '#7af0ff', '#ffe66b'], speed: 5, size: 0.12, life: 0.5 });
    game.sound?.play('magic');
  }

  knockOut(game) {
    this.dead = true;
    this.deadTimer = RESPAWN_TIME;
    this.attackTimer = 0;
    this.dodgeTimer = 0;
    this.drawing = false;
    this.shootTimer = 0;
    this.counterTimer = 0;
    this.endStarShield();
    this.wearBowOnBack();
    game.statusBar?.showDefeated(true);
  }

  respawn(game) {
    this.dead = false;
    this.swimming = false;
    this.boat = null;
    this.health = this.maxHealth;
    this.object3d.position.copy(this.spawn);
    this.velocity.set(0, 0, 0);
    this.model.root.rotation.x = 0;
    this.model.root.position.set(0, 0, 0);
    this.prone = 0;
    this.invulnerable = 2;
    game.cameraRig?.snap();
    game.statusBar?.showDefeated(false);
    game.statusBar?.fade();
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
    if (game.towerIsland?.railingBlocks(pos, x, z)) return false;
    if (game.isWalkable(x, z)) return game.heightAt(x, z) <= pos.y + STEP_UP;
    // You get into the sea off the dock (or off the shore of an island out at sea). Once Captain
    // Max has shown you how, you can wade in from any beach of the home island too.
    if (game.dock?.isInside(pos.x, pos.z)) return true;
    if (this.canSwimFromBeach && game.terrain.isInside(pos.x, pos.z) && Math.hypot(x, z) < SEA.radius) return true;
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
      const floor = this.swimming ? pos.y - 1 : game.heightAt(pos.x, pos.z);
      pos.y = Math.max(floor, pos.y - 8 * dt); // drop to the ground (or float)
      if (this.deadTimer <= 0) this.respawn(game);
      return;
    }

    // Health slowly comes back when you stay out of trouble.
    if (this.health < this.maxHealth && this.sinceHurt > PLAYER.regenDelay) {
      this.regenTimer += dt;
      if (this.regenTimer >= PLAYER.regenInterval) {
        this.regenTimer = 0;
        this.heal(1);
      }
    } else {
      this.regenTimer = 0;
    }

    const controls = !game.isUiOpen() && this.stunTimer === 0;
    this.shielding = controls && this.hasShield && !this.swimming && !this.usingBow && !this.rolling && input.held('shield');

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
    const moving = _move.lengthSq() > 0;

    // Shift: roll, and keep holding it to run. (Running stops when you let go or stop moving.)
    const rollHeld = controls && input.held('dodge');
    if (!rollHeld || !moving) this.running = false;
    if (this.boat) {
      // Sailing: the boat goes where you steer, and you sit in it.
      const seat = this.boat.drive(dt, game, _move, rollHeld);
      pos.copy(seat);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.model.root.rotation.y = this.boat.heading;
      this.animateSailing(game);
      return;
    }
    if (controls && input.hit('dodge') && moving) this.tryRoll(game);
    if (rollHeld && moving && !this.rolling && this.onGround) this.running = true;

    let speed = this.running ? RUN_SPEED : WALK_SPEED;
    if (this.swimming) speed = rollHeld ? SWIM_FAST : SWIM_SPEED;
    if (this.shielding) speed = this.shieldTier >= 1 ? WALK_SPEED : SHIELD_SPEED;
    if (this.drawing) speed = Math.min(speed, SHIELD_SPEED); // steady while aiming
    if (this.isAttacking && !this.spinning && this.onGround) speed *= PLAYER.swingSlowdown; // plant your feet to swing
    if (this.swimming && this.buffs.fastFins) speed *= BUFFS.fastFins.swim;
    if (this.swimming && this.seaCrystal) speed *= CRYSTALS.sea.swim;
    if (!this.swimming && this.swiftCrystal) speed *= CRYSTALS.swift.speed;
    if (!this.swimming && this.buffs.quickFeet) speed *= BUFFS.quickFeet.speed;
    this.updateAbilities(dt, game);
    this.lungeTimer = Math.max(0, (this.lungeTimer ?? 0) - dt);
    if (this.stunTimer === 0 && !this.rolling && !this.skyStriking && this.lungeTimer === 0) {
      const grip = this.swimming ? 5 : this.onGround ? 16 : 5;
      const accel = 1 - Math.exp(-grip * dt);
      this.velocity.x += (_move.x * speed - this.velocity.x) * accel;
      this.velocity.z += (_move.z * speed - this.velocity.z) * accel;
    }

    // Jumping: a jump pressed just before landing still happens, and you can still jump a moment
    // after running off a ledge.
    this.coyote = this.onGround ? PLAYER.coyoteTime : Math.max(0, this.coyote - dt);
    this.jumpBuffer = controls && input.hit('jump') ? PLAYER.jumpBuffer : Math.max(0, this.jumpBuffer - dt);
    if (controls && !this.swimming && this.jumpBuffer > 0 && this.coyote > 0 && !this.rolling) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      game.sound?.play('jump');
    } else if (controls && !this.onGround && !this.swimming && this.hasDoubleJump && !this.usedDoubleJump && input.hit('jump') && this.coyote === 0) {
      // Double Jump (dream ability): a second jump in mid-air.
      this.velocity.y = JUMP_SPEED * 0.9;
      this.usedDoubleJump = true;
      this.jumpBuffer = 0;
      game.particles?.burst(pos.clone(), { count: 12, colors: ['#c8a8ff', '#ffffff'], speed: 3, size: 0.12, life: 0.4 });
      game.sound?.play('jump', { volume: 1.2 });
    }
    // No sword swings (or arrows) while the shield is up.
    const free = controls && !this.shielding && !this.isAttacking && !this.usingBow && !this.rolling;
    const swingPressed = input.hit('swing') || input.clicked;
    // Pressing swing during a swing lines up the next move of the combo.
    if (swingPressed && this.isAttacking && !this.spinning && this.swingProgress > 0.25) this.queuedSwing = true;
    if (swingPressed && this.rolling) this.queuedSwing = true; // swing as soon as the roll ends
    const height = pos.y - game.heightAt(pos.x, pos.z);
    if (free && swingPressed && this.knowsSkyStrike && !this.onGround && !this.swimming && !this.skyStriking && height > 1.2) {
      this.startSkyStrike(game);
    } else if (free && (swingPressed || this.queuedSwing)) {
      this.startSwing(game);
    } else if (free && this.hasBow && input.hit('bow')) {
      this.startDraw(game);
    }
    if (controls && input.hit('eat')) this.tryEat(game);
    if (controls && input.hit('power')) this.starBurst(game);
    this.updateSpin(dt, game, controls);
    // The slash clonking into a tree, a rock, a wall or a chest (once per swing).
    const strike = this.strike;
    if (strike && this.thingSoundSwing !== strike.id) {
      this.thingSoundSwing = strike.id;
      const thing = this.hitSoundSwing === strike.id ? null : this.slashHitsThing(game);
      if (thing) game.sound?.play(thing, { volume: 0.8 });
    }
    const wasAttacking = this.isAttacking;
    const before = this.swingProgress;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (wasAttacking && !this.isAttacking) {
      this.lastSwingEnd = game.elapsed;
      if (!controls) this.queuedSwing = false;
    }
    if (this.attackTimer === 0) this.spinning = false;
    // The overhead finisher slams into the ground.
    if (this.isAttacking && !this.spinning && this.move.slam && before < this.move.slam && this.swingProgress >= this.move.slam) {
      this.groundSlam(game);
    }
    if (this.drawing) {
      this.charge = Math.min(this.charge + dt, BOW.drawTime + BOW.maxDamage * BOW.secondsPerDamage);
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

    // A Dream Dash goes right through monsters (and hurts them); otherwise they're solid.
    const dashing = this.rolling && this.hasDreamDash;
    pushOut(pos, RADIUS, game.colliders, dashing ? (c) => c.isMonster : null);
    if (dashing) this.dashThrough(game);
    this.updateWater(game);

    if (this.swimming) {
      this.skyStriking = false;
      const surface = SEA.level - SWIM_DEPTH + Math.sin(game.elapsed * 2.2) * 0.05;
      if (pos.y <= surface) {
        pos.y = surface;
        this.velocity.y = 0;
      }
      this.onGround = false;
    } else {
      const ground = game.heightAt(pos.x, pos.z);
      if (pos.y <= ground) {
        if (!this.onGround && this.velocity.y < -7) {
          game.sound?.play('land', { volume: Math.min(1.5, -this.velocity.y / 14) });
          this.landTimer = 0.18;
          game.particles?.burst(pos.clone().setY(ground + 0.1), { count: 8, colors: this.dustColors(game), speed: 2.2, size: 0.14, life: 0.4, up: 0.2 });
        }
        pos.y = ground;
        this.velocity.y = 0;
        this.onGround = true;
        this.usedDoubleJump = false;
        if (this.skyStriking) this.skyStrikeLand(game);
        const pad = game.dream?.bounceAt(pos.x, pos.y, pos.z);
        if (pad) {
          this.velocity.y = BOUNCE_SPEED;
          this.onGround = false;
          game.dream.boing(pad, game);
        }
      } else if (pos.y > ground + 0.05) {
        this.onGround = false; // walked off a ledge
      }
    }

    this.animate(dt, controls, game);
  }

  /** What the ground kicks up under your feet. */
  dustColors(game) {
    const p = this.object3d.position;
    if (p.y > 50) return ['#ffffff', '#e8d8ff']; // the dream clouds
    if (game.terrain?.isGrass(p.x, p.z) && Math.hypot(p.x, p.z) < 200) return ['#c9a46b', '#e0c9a0', '#9fd67a'];
    return ['#e0c9a0', '#f5dfa0', '#ffffff'];
  }

  /** Shift: roll the way you're moving. Nothing can hurt you mid-roll. */
  tryRoll(game) {
    if (this.rolling || this.dodgeCooldown > 0 || this.swimming || this.shielding || this.skyStriking) return;
    if (this.inStrike) return; // committed to the swing
    if (!this.onGround && this.coyote === 0) return;
    const len = Math.hypot(_move.x, _move.z);
    if (len < 0.1) return;
    const dash = this.hasDreamDash;
    const speed = dash ? DREAM.dashSpeed : DODGE.speed;
    this.dodgeLength = dash ? DREAM.dashTime : DODGE.time;
    this.dodgeTimer = this.dodgeLength;
    this.rollDir = Math.atan2(_move.x, _move.z);
    this.model.root.rotation.y = this.rollDir;
    this.velocity.set((_move.x / len) * speed, this.velocity.y > 0 ? this.velocity.y : 0, (_move.z / len) * speed);
    // Cancel whatever we were doing.
    this.attackTimer = 0;
    this.spinning = false;
    this.queuedSwing = false;
    this.spinCharge = 0;
    this.drawing = false;
    this.perfectThisRoll = false;
    this.dashHits.clear();
    const at = this.object3d.position.clone().setY(this.object3d.position.y + 0.2);
    game.particles?.burst(at, { count: 10, colors: dash ? ['#ffffff', '#c8a8ff', '#7af0ff'] : this.dustColors(game), speed: 2.5, size: 0.14, life: 0.35, up: 0.2 });
    game.sound?.play(dash ? 'dash' : 'dodge');
  }

  /** The Dream Dash hurts every monster it passes through (once each). */
  dashThrough(game) {
    const pos = this.object3d.position;
    for (const m of [...game.monsters]) {
      if (this.dashHits.has(m) || m.health <= 0) continue;
      const mp = m.object3d.position;
      const d = Math.hypot(mp.x - pos.x, mp.z - pos.z);
      if (d > m.radius + 0.8 || Math.abs(mp.y - pos.y) > 2 + m.radius) continue;
      this.dashHits.add(m);
      if (m.dodges?.(game)) continue;
      m.hit(game, { x: (pos.x - mp.x) / (d || 1), z: (pos.z - mp.z) / (d || 1) }, DREAM.dashDamage);
    }
  }

  /** Jump in when we leave the dock; climb out when we reach land. */
  updateWater(game) {
    const pos = this.object3d.position;
    const onLand = game.isWalkable(pos.x, pos.z);
    if (!this.swimming && !onLand) {
      this.swimming = true;
      this.dodgeTimer = 0; // a roll stops with a splash
      this.splash(game, 30);
      game.sound?.play('splash');
      this.splashes = (this.splashes ?? 0) + 1;
      if (this.splashes <= 2) game.questLog?.toast('Splash! To get out, swim back to the dock or a beach.', { icon: '🌊' });
    } else if (this.swimming && onLand) {
      this.swimming = false;
      pos.y = Math.max(pos.y, game.heightAt(pos.x, pos.z));
      this.velocity.y = 0;
      this.onGround = true;
      this.splash(game, 12);
      game.sound?.play('splash', { volume: 0.5 });
    }
  }

  bubbles(game) {
    const pos = this.object3d.position;
    game.particles?.burst(new THREE.Vector3(pos.x, pos.y + 1.6, pos.z), {
      count: 3,
      colors: ['#e8fbff', '#bfe6ff'],
      speed: 0.6,
      size: 0.1,
      life: 1.4,
      gravity: -3, // float up
    });
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
      game.questLog?.toast("You're not hurt. Save it for later!");
      return;
    }
    const { item, healed } = eaten;
    game.questLog?.toast(`${item.name}: ${this.health >= this.maxHealth ? 'all better!' : `+${healed} health`}`, { icon: item.icon });
    game.sound?.play('eat');
  }

  /** K: start pulling the bowstring back. The arrow flies after BOW.drawTime seconds. */
  startDraw(game) {
    this.drawing = true;
    this.charge = 0;
    this.holdBow();
    game.sound?.play('draw');
  }

  /** The monster we'd most like to hit: close by, and roughly where we're facing (or moving). */
  aimTarget(game, range, facing) {
    const pos = this.object3d.position;
    let best = null;
    let bestScore = Infinity;
    for (const m of game.monsters) {
      if (m.health <= 0 || m.hidden) continue;
      const mp = m.object3d.position;
      const dx = mp.x - pos.x;
      const dz = mp.z - pos.z;
      const dist = Math.hypot(dx, dz) - m.radius;
      if (dist > range || Math.abs(mp.y - pos.y) > 3 + m.radius) continue;
      const ahead = (dx * Math.sin(facing) + dz * Math.cos(facing)) / (Math.hypot(dx, dz) || 1);
      if (ahead < -0.2 && dist > this.swordStats.reach + 1) continue; // behind us, unless it's close enough to turn and hit
      const score = dist * (1.6 - ahead); // closer and more in front is better
      if (score < bestScore) {
        best = m;
        bestScore = score;
      }
    }
    return best;
  }

  /** The closest monster within `range` (any direction), or null. */
  nearestMonster(game, range) {
    const pos = this.object3d.position;
    let best = null;
    let bestDist = range;
    for (const m of game.monsters) {
      if (m.health <= 0) continue;
      const mp = m.object3d.position;
      const d = Math.hypot(mp.x - pos.x, mp.z - pos.z) - m.radius;
      if (d < bestDist && Math.abs(mp.y - pos.y) < 4) {
        best = m;
        bestDist = d;
      }
    }
    return best;
  }

  /** Fire an arrow, locking on to a monster that's roughly ahead of us. */
  shoot(game) {
    game.sound?.play('bow');
    const damage = this.arrowDamage;
    this.drawing = false;
    this.charge = 0;
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
    start.y = pos.y + (this.swimming ? 1.2 : 1.3);
    game.add(new Arrow(start, Arrow.aim(start, aimAt, angle), damage));
    this.shootTimer = FOLLOW_THROUGH;
  }

  /**
   * Start the next sword move: keep swinging quickly to go through the whole combo. The swing
   * turns you toward the nearest monster in front of you, and steps you in toward it.
   */
  startSwing(game) {
    const chained = this.queuedSwing || game.elapsed - this.lastSwingEnd < COMBO_WINDOW;
    this.comboStep = chained ? (this.comboStep + 1) % MOVES.length : 0;
    this.move = MOVES[this.comboStep];
    this.attackDuration = this.move.duration;
    this.attackTimer = this.move.duration;
    this.queuedSwing = false;
    this.swingId++;
    if (this.counterTimer > 0) {
      this.counterSwing = this.swingId; // the Perfect Dodge's counter-attack
      this.counterTimer = 0;
    }
    // Aim: face the input direction if there is one, otherwise where we're already facing.
    let facing = this.model.root.rotation.y;
    if (_move.lengthSq() > 0) facing = Math.atan2(_move.x, _move.z);
    const target = this.aimTarget(game, this.swordStats.reach + PLAYER.autoAim, facing);
    if (target) {
      const pos = this.object3d.position;
      const mp = target.object3d.position;
      facing = Math.atan2(mp.x - pos.x, mp.z - pos.z);
      // Step in if it's a little out of reach.
      const gap = Math.hypot(mp.x - pos.x, mp.z - pos.z) - target.radius - this.swordStats.reach;
      if (gap > 0.3 && this.onGround && !this.swimming) {
        const step = Math.min(gap, 2.2) / LUNGE_TIME;
        this.velocity.x = Math.sin(facing) * step;
        this.velocity.z = Math.cos(facing) * step;
        this.lungeTimer = LUNGE_TIME;
      }
    }
    this.model.root.rotation.y = facing;
    game.sound?.play('swish');
  }

  /** Sky Strike (Master Oak's second move): dive straight down with the overhead swing. */
  startSkyStrike(game) {
    this.skyStriking = true;
    this.velocity.set(0, -SKY_STRIKE.speed, 0);
    this.comboStep = MOVES.length - 1; // the big overhead finisher
    this.move = MOVES[this.comboStep];
    this.attackDuration = this.attackTimer = this.move.duration;
    this.queuedSwing = false;
    this.swingId++;
    game.sound?.play('swish');
  }

  /** The Sky Strike hits the ground: everything close by gets slammed (and training posts break). */
  skyStrikeLand(game) {
    this.skyStriking = false;
    const pos = this.object3d.position;
    const r = SKY_STRIKE.radius;
    for (const m of [...game.monsters]) {
      const mp = m.object3d.position;
      const dx = pos.x - mp.x;
      const dz = pos.z - mp.z;
      const d = Math.hypot(dx, dz);
      if (d > r + m.radius || Math.abs(mp.y - pos.y) > 2.5 || m.health <= 0) continue;
      m.hit(game, { x: dx / (d || 1), z: dz / (d || 1) }, SKY_STRIKE.damage, { skyStrike: true });
    }
    for (const e of [...game.entities]) e.onSkyStrike?.(game, pos, r);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      game.particles?.burst(new THREE.Vector3(pos.x + Math.cos(a) * r * 0.7, pos.y + 0.2, pos.z + Math.sin(a) * r * 0.7), { count: 2, colors: ['#ffffff', '#ffe08a', '#c9a46b'], speed: 3, size: 0.2, life: 0.5, up: 0.5 });
    }
    game.hitStop?.(0.1);
    game.cameraRig?.shake(0.6);
    game.sound?.play('thump', { volume: 1.4 });
  }

  /** The finisher's sword hits the ground: a puff of dust and a thump. */
  groundSlam(game) {
    const tip = this.sword.localToWorld(new THREE.Vector3(0, 0.9, 0));
    const ground = this.swimming ? tip.y : game.heightAt(tip.x, tip.z);
    game.particles?.burst(new THREE.Vector3(tip.x, ground + 0.1, tip.z), {
      count: 22,
      colors: this.swimming ? ['#e8fbff', '#bfe6ff'] : ['#c9a46b', '#e0c9a0', '#ffffff'],
      speed: 4,
      size: 0.18,
      life: 0.6,
      up: 0.4,
    });
    game.cameraRig?.shake(0.35);
  }

  /** Called by a monster when our sword connects: sparks, a tiny pause and a shake. */
  swordHit(game, monster) {
    const m = monster.object3d.position;
    const finisher = this.move.slam && !this.spinning;
    game.particles?.burst(new THREE.Vector3(m.x, m.y + Math.max(0.6, monster.radius), m.z), {
      count: finisher ? 26 : 16,
      colors: ['#ffffff', '#fff3b0', '#ffd23f'],
      speed: finisher ? 8 : 6,
      size: 0.12,
      life: 0.35,
      up: 0.5,
    });
    const counter = this.counterSwing === this.swingId;
    game.hitStop?.(counter ? 0.18 : finisher ? 0.11 : 0.055);
    game.cameraRig?.shake(counter ? 0.5 : finisher ? 0.3 : 0.15);
    // One hit sound per swing, even when it hits a crowd.
    if (this.hitSoundSwing !== this.swingId) {
      this.hitSoundSwing = this.swingId;
      game.sound?.play(monster.hitSound ?? 'thwack');
      if (finisher || this.spinning || counter) game.sound?.play('thump');
      if (counter) {
        game.sound?.play('counter');
        game.floatText?.(m.clone().setY(m.y + monster.radius * 2 + 1.4), 'Counter!', 'perfect');
      }
    }
  }

  /**
   * What the slash bumps into besides monsters: 'wood' (trees, chests, training posts), 'stone'
   * (boulders, walls, lamp posts), or null. Checks a few spots along the sword's arc.
   */
  slashHitsThing(game) {
    if (this.swimming) return null;
    const pos = this.object3d.position;
    const facing = this.spinning ? this.spinFacing : this.model.root.rotation.y;
    const reach = this.swordStats.reach + 0.6;
    const angles = this.spinning ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (i / 8) * Math.PI * 2) : [-0.9, -0.45, 0, 0.45, 0.9];
    const skip = (c) => c.isMonster || c.sound === false; // monsters make their own sound; villagers don't clink
    for (const a of angles) {
      for (const d of [reach * 0.6, reach]) {
        const c = colliderAt(pos.x + Math.sin(facing + a) * d, pos.z + Math.cos(facing + a) * d, game.colliders, skip);
        if (c) return c.sound || 'stone';
      }
    }
    return null;
  }

  wearBowOnBack() {
    this.pose.add(this.bow);
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

  /** Timers for the roll, the counter-attack, the Star Burst and its star shield, and buffs. */
  updateAbilities(dt, game) {
    const wasRolling = this.rolling;
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    if (wasRolling && !this.rolling) {
      this.dodgeCooldown = DODGE.cooldown;
      // Come out of the roll at running speed, not a standstill.
      const keep = (this.hasDreamDash ? RUN_SPEED : WALK_SPEED) / Math.max(1, Math.hypot(this.velocity.x, this.velocity.z));
      this.velocity.x *= Math.min(1, keep);
      this.velocity.z *= Math.min(1, keep);
    } else this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.counterTimer = Math.max(0, this.counterTimer - dt);
    this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    if (this.shieldHits > 0 && (this.shieldTimer -= dt) <= 0) this.endStarShield();
    if (this.bubble.visible) this.bubble.scale.setScalar(1 + Math.sin(game.elapsed * 6) * 0.04);
    // The Star Burst ring spreads out and fades.
    if (this.burstTimer > 0) {
      this.burstTimer = Math.max(0, this.burstTimer - dt);
      const t = 1 - this.burstTimer / BURST_TIME;
      this.burstRing.visible = this.burstTimer > 0;
      this.burstRing.scale.setScalar(0.5 + (1 - (1 - t) ** 3) * DREAM.burstRadius);
      this.burstRing.material.opacity = 0.9 * (1 - t);
      this.burstRing.position.y = 0.3 + (this.swimming ? 1 : 0);
    }
    for (const [id, left] of Object.entries(this.buffs)) {
      if (left - dt > 0) this.buffs[id] = left - dt;
      else {
        delete this.buffs[id];
        game.questLog?.toast(`Your ${BUFFS[id].name} wore off.`, { icon: BUFFS[id].icon });
      }
    }
  }

  /**
   * L: the Star Burst (with a magic conduit). A ring of starlight hurts and knocks back every
   * monster around you and leaves a star shield; with Dream Heal it heals you too.
   */
  starBurst(game) {
    if (!this.hasConduit) {
      game.questLog?.toast('You have no dream powers yet...', { icon: '✨' });
      return;
    }
    if (this.burstCooldown > 0) return;
    if (this.magic < MAGIC.burstCost) {
      game.questLog?.toast('Not enough magic! Defeat monsters to fill your conduit.', { icon: '🔮' });
      game.statusBar?.needMagic();
      return;
    }
    this.magic -= MAGIC.burstCost;
    this.burstCooldown = DREAM.burstCooldown;
    this.burstTimer = BURST_TIME;
    this.burstRing.visible = true;
    const pos = this.object3d.position;
    const r = DREAM.burstRadius;
    for (const m of [...game.monsters]) {
      const mp = m.object3d.position;
      const dx = pos.x - mp.x;
      const dz = pos.z - mp.z;
      const d = Math.hypot(dx, dz);
      if (d > r + m.radius || Math.abs(mp.y - pos.y) > 4 + m.radius || m.health <= 0) continue;
      if (m.dodges?.(game)) continue;
      m.hit(game, { x: dx / (d || 1), z: dz / (d || 1) }, DREAM.burstDamage, { burst: true });
      if (m.health > 0 && !m.boss) m.velocity?.set((-dx / (d || 1)) * 14, m.aquatic ? 0 : 6, (-dz / (d || 1)) * 14);
    }
    this.shieldHits = DREAM.shieldHits;
    this.shieldTimer = DREAM.shieldTime;
    this.bubble.visible = true;
    if (this.hasDreamHeal) this.heal(DREAM.healAmount);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      game.particles?.burst(new THREE.Vector3(pos.x + Math.cos(a) * 1.2, pos.y + 0.8, pos.z + Math.sin(a) * 1.2), { count: 2, colors: ['#ffe66b', '#ffffff', '#c8a8ff'], speed: 7, size: 0.16, life: 0.6, up: 0.1 });
    }
    game.hitStop?.(0.06);
    game.cameraRig?.shake(0.45);
    game.sound?.play('burst');
  }

  /** Start (or top up) a buff from BUFFS for its usual time. */
  addBuff(game, id) {
    this.buffs[id] = BUFFS.seconds;
    game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1.2), { count: 24, colors: ['#7dff8a', '#ffe66b', '#ffffff'], speed: 3, size: 0.13, gravity: -3 });
  }

  endStarShield() {
    this.shieldHits = 0;
    this.bubble.visible = false;
  }

  /**
   * The spin attack (taught by Master Oak): keep holding the swing button to charge it up (the
   * sword sparkles), then let go to spin round, hitting everything nearby.
   */
  updateSpin(dt, game, controls) {
    if (!this.knowsSpin) return;
    const holding = controls && game.input.held('swing') && !this.shielding && !this.usingBow && !this.swimming;
    if (holding) {
      const before = this.spinCharge ?? 0;
      if (!this.spinning) this.spinCharge = before + dt; // charges up during the first swing too
      if (before < SPIN_CHARGE && this.spinCharge >= SPIN_CHARGE) game.sound?.play('charged'); // ready!
      if (this.spinCharge >= SPIN_CHARGE && game.elapsed % 0.15 < dt) {
        const tip = this.sword.getWorldPosition(new THREE.Vector3());
        game.particles?.burst(tip, { count: 2, colors: ['#ffe08a', '#ffffff'], speed: 1.5, size: 0.08, life: 0.4, gravity: -2 });
      }
      return;
    }
    if (this.spinCharge >= SPIN_CHARGE && controls && !this.spinning && !this.inStrike && !this.rolling) {
      this.spinning = true;
      this.attackTimer = SPIN_TIME;
      this.spinFacing = this.model.root.rotation.y;
      this.swingId++;
      game.sound?.play('swish', { volume: 1.6 });
      game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 1), {
        count: 24,
        colors: ['#ffffff', '#ffe08a', '#bfe6ff'],
        speed: 6,
        size: 0.12,
        life: 0.4,
        up: 0.2,
      });
    }
    this.spinCharge = 0;
  }

  /** Sitting in the boat, holding the tiller. */
  animateSailing(game) {
    const { root, armL, armR, legL, legR } = this.model;
    root.visible = true;
    root.rotation.x = 0;
    root.position.set(0, -0.45, 0);
    legL.rotation.x = legR.rotation.x = -1.4;
    armR.rotation.set(-0.8 + Math.sin(game.elapsed * 2) * 0.1, 0, 0);
    armL.rotation.x = -0.5;
    this.model.head.rotation.y = 0;
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

    // Face the way we're going (but not mid-swing or mid-roll: the swing aims, the roll commits).
    // With the shield up, face the nearest monster instead, so the shield is between you.
    const threat = this.shielding ? this.nearestMonster(game, 8) : null;
    if (threat) {
      const tp = threat.object3d.position;
      turnToward(this.model, Math.atan2(tp.x - this.object3d.position.x, tp.z - this.object3d.position.z), dt, 16);
    } else if (horizontal > 0.5 && controls && !this.usingBow && !this.isAttacking && !this.rolling) {
      turnToward(this.model, Math.atan2(this.velocity.x, this.velocity.z), dt, 14);
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
      const lastStroke = Math.floor(this.swimPhase / Math.PI);
      this.swimPhase += dt * (stroking ? 4.2 : 2.5);
      if (stroking && Math.floor(this.swimPhase / Math.PI) !== lastStroke) game.sound?.play('swim'); // one arm pulls through the water
      const p = this.swimPhase;
      if (stroking) {
        // Front crawl: each arm goes up over the water, reaches forward, pulls down and back
        // under the water. Legs flutter-kick, and the head turns to the side to breathe.
        armR.rotation.x = p % (Math.PI * 2);
        armL.rotation.x = (p + Math.PI) % (Math.PI * 2);
        legL.rotation.x = Math.sin(p * 3) * 0.3;
        legR.rotation.x = -Math.sin(p * 3) * 0.3;
        this.model.head.rotation.y = Math.max(0, Math.sin(p)) * 0.7;
        if (Math.floor(p / Math.PI) !== Math.floor((p - dt * 4.2) / Math.PI)) this.bubbles(game); // a stream of bubbles
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
      const lastStep = Math.floor(this.walkPhase / Math.PI);
      this.walkPhase += horizontal * dt * 1.6;
      // A soft footstep each time a foot comes down (and a puff of dust when running).
      if (horizontal > 2 && Math.floor(this.walkPhase / Math.PI) !== lastStep && !this.rolling) {
        game.sound?.play('step', { volume: this.running ? 1 : 0.6 });
        if (this.running) game.particles?.burst(this.object3d.position.clone().setY(this.object3d.position.y + 0.1), { count: 3, colors: this.dustColors(game), speed: 1.2, size: 0.12, life: 0.35, up: 0.3 });
      }
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

    // The body twists, leans and steps into each move (see swordMoves.js).
    const pose = this.pose;
    pose.rotation.set(0, 0, 0);
    pose.position.set(0, 0, 0);
    if (this.spinning) {
      // Spin all the way round with the sword held straight out, crouched low.
      const t = 1 - this.attackTimer / SPIN_TIME;
      root.rotation.y = this.spinFacing + (1 - (1 - t) ** 2) * Math.PI * 2;
      armR.rotation.x = -1.4;
      armR.rotation.y = -1.2;
      armL.rotation.x = -0.9;
      armL.rotation.y = 0.8;
      pose.rotation.x = 0.15;
      pose.position.y = -0.15;
      this.sword.rotation.x = Math.PI - 0.15;
    } else if (this.isAttacking) {
      const t = this.swingProgress;
      const p = poseAt(this.move, t, _pose);
      // Blend in at the very start and back out at the end, so the walk animation flows into it.
      const w = Math.min(1, t / 0.06) * (t > 0.8 ? 1 - THREE.MathUtils.smoothstep(t, 0.8, 1) : 1);
      const mix = (from, to) => from + (to - from) * w;
      armR.rotation.x = mix(armR.rotation.x, p.armRx);
      armR.rotation.y = mix(armR.rotation.y, p.armRy);
      armL.rotation.x = mix(armL.rotation.x, p.armLx);
      armL.rotation.y = mix(armL.rotation.y ?? 0, p.armLy);
      pose.rotation.y = p.twist * w;
      pose.rotation.x = p.lean * w;
      pose.position.z = p.lunge * w;
      pose.position.y = p.drop * w;
      this.sword.rotation.x = SWORD_REST + (Math.PI - 0.15 - SWORD_REST) * p.blade * w;
    } else {
      armL.rotation.y = 0;
      if (this.running && this.onGround) pose.rotation.x = 0.18; // lean into a run
    }
    if (this.rolling) {
      // A forward roll: tuck in and flip head over heels around the middle of the body.
      const t = 1 - this.dodgeTimer / this.dodgeLength;
      const a = (this.hasDreamDash ? 0.25 : 1) * THREE.MathUtils.smoothstep(t, 0, 1) * Math.PI * 2;
      const c = 0.55; // height of the middle of the body
      pose.rotation.set(a, 0, 0);
      pose.position.set(0, c - c * Math.cos(a) - 0.15 * Math.sin(t * Math.PI), -c * Math.sin(a));
      armL.rotation.x = armR.rotation.x = -1.2;
      legL.rotation.x = legR.rotation.x = -1.3;
    }
    // A little squash when landing from a jump.
    this.landTimer = Math.max(0, this.landTimer - dt);
    const squash = Math.sin((this.landTimer / 0.18) * Math.PI) * 0.12;
    pose.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    this.updateTrail();
  }

  /** Leave a glowing swoosh behind the blade while swinging. */
  updateTrail() {
    if (!this.trail) return;
    if (!this.isAttacking || this.dead) return;
    this.model.root.updateMatrixWorld(true);
    const length = this.swordTier >= 1 ? 1.2 : 0.95;
    const base = this.sword.localToWorld(_trailBase.set(0, 0.35, 0));
    const tip = this.sword.localToWorld(_trailTip.set(0, length, 0));
    const color = this.counterSwing === this.swingId ? '#7af0ff' : this.spinning ? '#ffd23f' : this.move.slam ? '#ff9a3d' : this.swordTier >= 1 ? '#7fc4ff' : '#e8fbff';
    this.trail.add(base, tip, color);
  }
}
