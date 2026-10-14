import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { pushOut } from '../core/collision.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { createCharacter, poseWalk, turnToward } from '../models/character.js';

const WALK_SPEED = 2.4;
const HURRY_SPEED = 3.4; // when walking over to give a quest
const TALK_DISTANCE = 2.3; // how close they walk before speaking
const NEAR_DISTANCE = 3.5; // close enough to press T
const RADIUS = 0.4;

const markerMaterial = new THREE.MeshLambertMaterial({ emissive: '#ffb300', emissiveIntensity: 0.7 });
const EXCLAMATION = ['#', '#', '#', '.', '#'];
const QUESTION = ['###', '..#', '.##', '...', '.#.'];

function createMarker(rows) {
  const b = new VoxelBuilder();
  const size = 0.17;
  rows.forEach((row, r) => {
    [...row].forEach((cell, c) => {
      if (cell === '#') b.add((c - (row.length - 1) / 2) * size, (rows.length - 1 - r) * size, 0, '#ffd23f', size);
    });
  });
  const mesh = b.build({ castShadow: false, receiveShadow: false, material: markerMaterial });
  mesh.visible = false;
  return mesh;
}

/**
 * A townsperson. They stroll around (or stand still), stop and face you when you come
 * close, and talk when you press T.
 *
 *   new Npc({
 *     name: 'Pip', look: LOOKS.kid, position: { x, z },
 *     wander: { x: 0, z: 0, radius: 14 },   // or null to stand still
 *     quest,                                // a Quest (see quest/Quest.js), or `quests: [a, b]`, or…
 *     lines: ['Hello!'],                    // …just something to say
 *     onInteract: (game) => {},             // …or something else entirely (like a shop)
 *     interactText: 'Press T to shop',
 *     home: { x, z },                       // their front door: they go to bed there at night
 *   })
 *
 * If the quest has `seekDistance` > 0 the NPC walks over to you on their own when you're
 * that close. (Nobody does this right now: you go to them.)
 */
export class Npc extends Entity {
  constructor({
    name,
    look,
    position,
    wander = null,
    quest = null,
    lines = [],
    onInteract = null,
    interactText = null,
    startDelay = 0,
    facing = 0,
    home = null,
    quests = null,
    onTalk = null,
    createModel = null, // for animal friends (see models/critters.js); otherwise a person in `look`
  }) {
    super();
    this.name = name;
    // One quest, or a list given one after another (`quests`).
    this.quests = quests ?? (quest ? [quest] : []);
    for (const q of this.quests) q.giver = this;
    this.lines = lines;
    this.onInteract = onInteract;
    this.onTalk = onTalk; // called every time you talk to them (before anything else)
    this.interactText = interactText ?? `Press T to talk to ${name}`;
    this.wander = wander;
    this.home = home;
    this.asleep = false;
    this.zzzTimer = 0;
    this.object3d.position.set(position.x, position.y ?? 0, position.z);

    this.model = createModel ? createModel() : createCharacter(look.colors);
    look?.decorate?.(this.model);
    this.object3d.add(this.model.root);
    this.model.root.rotation.y = facing;
    // People who stand in one place (shopkeepers) walk back to it in the morning.
    this.post = wander ? null : { x: position.x, z: position.z, facing };

    this.markers = { '!': createMarker(EXCLAMATION), '?': createMarker(QUESTION) };
    this.object3d.add(this.markers['!'], this.markers['?']);

    this.state = 'idle';
    this.pauseTimer = startDelay || 1 + Math.random() * 2;
    this.target = null;
    this.walkPhase = 0;
    this.stuckTimer = 0;
    this.collider = { x: position.x, z: position.z, radius: RADIUS, sound: false };
  }

  /** The quest this person is on right now (the first one not finished yet), or null. */
  get quest() {
    return this.quests.find((q) => q.stage !== 'complete') ?? this.quests.at(-1) ?? null;
  }

  onAdd(game) {
    game.colliders.push(this.collider);
  }

  onRemove(game) {
    game.colliders.splice(game.colliders.indexOf(this.collider), 1);
  }

  talk(game) {
    this.onTalk?.(game);
    if (this.onInteract) {
      this.onInteract(game);
      return;
    }
    const { pages, onClose } = this.quest ? this.quest.dialogFor(this) : { pages: this.lines };
    this.state = 'talking';
    game.dialog.show(this.name, pages, {
      focus: this,
      onClose: () => {
        this.state = 'idle';
        this.pauseTimer = 2;
        onClose?.();
      },
    });
  }

  goToSleep() {
    this.asleep = true;
    this.stuckTimer = 0;
    this.object3d.visible = false;
    this.collider.x = this.collider.z = 1e6; // out of the way
  }

  wakeUp() {
    this.asleep = false;
    this.object3d.visible = true;
    this.object3d.position.set(this.home.x, 0, this.home.z);
    this.target = null;
    this.pauseTimer = 1 + Math.random() * 2;
  }

  /** Little "z"s floating up from the front door. */
  snore(dt, game) {
    this.zzzTimer -= dt;
    if (this.zzzTimer > 0) return;
    this.zzzTimer = 1.4;
    game.particles?.burst(new THREE.Vector3(this.home.x, 2.6, this.home.z), {
      count: 1,
      colors: ['#ffffff', '#bfe6ff'],
      speed: 0.3,
      size: 0.22,
      life: 2.2,
      gravity: -0.8,
    });
  }

  /** Pick somewhere new to stroll to. */
  pickTarget() {
    const { x, z, radius } = this.wander;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    this.target = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
  }

  walkToward(tx, tz, speed, dt, game) {
    const pos = this.object3d.position;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return dist;
    const before = pos.clone();
    pos.x += (dx / dist) * speed * dt;
    pos.z += (dz / dist) * speed * dt;
    pushOut(pos, RADIUS, game.colliders, this.collider);
    turnToward(this.model, Math.atan2(dx, dz), dt);
    // Bumped into a house? Give up on this spot after a moment.
    this.stuckTimer = pos.distanceTo(before) < speed * dt * 0.3 ? this.stuckTimer + dt : 0;
    this.moving = speed;
    return dist;
  }

  update(dt, game) {
    this.quest?.update?.(dt, game); // some quests need to keep an eye on things (like a duel)
    if (this.hidden) return; // off doing something else (Master Oak, mid-duel)
    const pos = this.object3d.position;
    const player = game.player;
    const p = player.object3d.position;
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    const dist = Math.hypot(dx, dz);
    this.moving = 0;

    // Bedtime: villagers with a home walk back to their front door and go inside at night.
    const bedtime = this.home && game.dayNight?.isNight;
    if (this.asleep) {
      if (bedtime) this.snore(dt, game);
      else this.wakeUp();
      return;
    }

    if (this.state === 'talking') {
      turnToward(this.model, Math.atan2(dx, dz), dt);
      player.face(pos.x, pos.z, dt);
    } else if (!game.isUiOpen() && !player.dead) {
      const seek = this.quest?.seekDistance ?? 0;
      this.pauseTimer -= dt;
      if (seek > 0 && dist < seek && this.pauseTimer <= 0) {
        // Hurry over to the player to talk.
        if (dist > TALK_DISTANCE) this.walkToward(p.x, p.z, HURRY_SPEED, dt, game);
        else this.talk(game);
      } else if (bedtime) {
        // Off to bed (you can still say goodnight on the way).
        const left = this.walkToward(this.home.x, this.home.z, WALK_SPEED * 1.3, dt, game);
        if (left < 0.4 || this.stuckTimer > 1.5) this.goToSleep();
        else if (dist < NEAR_DISTANCE) game.dialog.offerInteraction(this.interactText, dist, () => this.talk(game));
      } else if (dist < NEAR_DISTANCE) {
        turnToward(this.model, Math.atan2(dx, dz), dt, 5);
        game.dialog.offerInteraction(this.interactText, dist, () => this.talk(game));
      } else if (this.post && Math.hypot(this.post.x - pos.x, this.post.z - pos.z) > 0.3) {
        this.walkToward(this.post.x, this.post.z, WALK_SPEED, dt, game); // back to work!
        this.returnTimer = (this.returnTimer ?? 0) + dt;
        // Can't find the way round a house? Just turn up at work (nobody's looking).
        if (this.stuckTimer > 2 || this.returnTimer > 15) pos.set(this.post.x, pos.y, this.post.z);
      } else if (this.post) {
        this.returnTimer = 0;
        turnToward(this.model, this.post.facing, dt, 4);
      } else if (this.wander && this.pauseTimer <= 0) {
        if (!this.target) this.pickTarget();
        const left = this.walkToward(this.target.x, this.target.z, WALK_SPEED, dt, game);
        if (left < 0.3 || this.stuckTimer > 0.6) {
          this.target = null;
          this.stuckTimer = 0;
          this.pauseTimer = 2 + Math.random() * 4;
        }
      }
    }

    this.walkPhase += this.moving * dt * 1.6;
    poseWalk(this.model, this.walkPhase, this.moving > 0 ? 0.7 : 0);
    this.model.idle?.(game.elapsed);
    if (this.state === 'talking') this.model.armR.rotation.x = -0.9 + Math.sin(game.elapsed * 6) * 0.25; // gesturing

    if (!this.asleep) {
      this.collider.x = pos.x;
      this.collider.z = pos.z;
    }

    // Quest marker bobs and spins above their head.
    const symbol = this.state === 'talking' ? null : this.quest?.marker;
    for (const [key, marker] of Object.entries(this.markers)) {
      marker.visible = key === symbol;
      marker.position.y = 2.75 + Math.sin(game.elapsed * 3) * 0.12;
      marker.rotation.y += dt * 2;
    }
  }
}
