import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { createCharacter, poseWalk } from '../models/character.js';
import { createSword } from '../models/gear.js';
import { LOOKS } from '../models/people.js';
import { INTRO, ENDING } from '../story.js';

const SEEN_KEY = 'bobert-intro-seen';
const TYPE_SPEED = 45; // letters a second
const _look = new THREE.Vector3();

export function introSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Shared bits for cutscenes: black bars top and bottom, a big caption, narration typed into the
 * bottom bar (Enter, Space or a click moves on), a fade to black and a Skip button (or Esc).
 * While one plays it counts as an open menu, so the player's controls are off. It moves the
 * camera itself (it updates after the camera rig).
 */
class Cutscene extends Entity {
  constructor(className) {
    super();
    this.playing = false;
    this.el = document.createElement('div');
    this.el.className = `cutscene ${className} hidden`;
    this.el.innerHTML = `
      <div class="cutscene-bar top"></div>
      <div class="cutscene-caption"></div>
      <div class="cutscene-bar bottom"><div class="cutscene-text"></div><div class="cutscene-next">▶</div></div>
      <div class="cutscene-fade"></div>
      <button class="cutscene-skip">Skip (Esc)</button>`;
    this.captionEl = this.el.querySelector('.cutscene-caption');
    this.textEl = this.el.querySelector('.cutscene-text');
    this.nextEl = this.el.querySelector('.cutscene-next');
    this.fadeEl = this.el.querySelector('.cutscene-fade');
    this.el.querySelector('.cutscene-skip').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.skipRequested = true;
    });
    document.body.append(this.el);
  }

  get isOpen() {
    return this.playing;
  }

  onAdd(game) {
    this.game = game;
    game.ui.push(this);
  }

  begin() {
    this.playing = true;
    this.skipRequested = false;
    this.el.classList.remove('hidden');
    document.body.classList.add('in-cutscene');
    this.caption('');
    this.narrate(null);
    this.fade(0);
  }

  end() {
    this.playing = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('in-cutscene');
    this.game.cameraRig?.snap();
  }

  caption(text) {
    this.captionEl.textContent = text;
    this.captionEl.classList.toggle('shown', !!text);
  }

  /** Narration in the bottom bar: pages typed out one at a time. onDone when the last is read. */
  narrate(pages, onDone = null) {
    this.pages = pages ?? [];
    this.page = 0;
    this.shown = 0;
    this.onNarrated = onDone;
    this.textEl.textContent = '';
    this.pageTime = 0;
  }

  get narrating() {
    return this.page < this.pages.length;
  }

  /** 0 = clear, 1 = black. */
  fade(amount) {
    this.fadeEl.style.opacity = amount;
  }

  updateNarration(dt, game) {
    if (!this.narrating) {
      this.nextEl.style.visibility = 'hidden';
      return;
    }
    const text = this.pages[this.page];
    const typing = this.shown < text.length;
    this.pageTime += dt;
    const advance = game.input.wasPressed('Enter', 'Space', 'NumpadEnter') || game.input.clicked;
    // Pages also move on by themselves after a while, so the scene keeps flowing.
    const auto = !typing && this.pageTime > 2.5 + text.length * 0.03;
    if (advance && typing) this.shown = text.length;
    else if (advance || auto) {
      this.page++;
      this.shown = 0;
      this.pageTime = 0;
      if (!this.narrating) {
        this.textEl.textContent = '';
        const done = this.onNarrated;
        this.onNarrated = null;
        done?.();
        return;
      }
    } else if (typing) this.shown = Math.min(text.length, this.shown + TYPE_SPEED * dt);
    this.textEl.textContent = this.pages[this.page].slice(0, Math.floor(this.shown));
    this.nextEl.style.visibility = typing ? 'hidden' : 'visible';
  }

  /** Point the camera from `from` at `at` (smoothly, unless snap). */
  aim(game, from, at, snap = false) {
    const cam = game.camera;
    if (snap) cam.position.copy(from);
    else cam.position.lerp(from, 0.08);
    this.lookAt = this.lookAt && !snap ? this.lookAt.lerp(at, 0.08) : at.clone();
    cam.lookAt(this.lookAt);
  }
}

/** A person (model only, no brain) for cutscenes: the prince, the soldiers. */
function figure(game, look, x, z, facing) {
  const model = createCharacter(look.colors);
  look.decorate?.(model);
  model.root.position.set(x, game.heightAt(x, z), z);
  model.root.rotation.y = facing;
  game.scene.add(model.root);
  return model;
}

/**
 * The intro: Bobert juggles swords for King Stuart in Tulane Kingdom... one flies off and hits the
 * prince. The king banishes him, and Tulane soldiers march him to Crestview Village while the
 * story is told. Plays once, for new players (after picking how Bobert looks). Lives at game.intro.
 */
export class Intro extends Cutscene {
  constructor() {
    super('intro');
  }

  onAdd(game) {
    super.onAdd(game);
    game.intro = this;
  }

  /** Play it as soon as nothing else is open (like the customization screen). */
  queue() {
    this.queued = true;
  }

  play() {
    const game = this.game;
    const tulane = game.tulane;
    this.queued = false;
    this.begin();
    this.phase = 'court';
    this.t = 0;
    const p = tulane.jugglerSpot;
    game.teleport(p.x, p.z, { facing: 0 }); // facing the king on his throne
    this.prince = figure(game, LOOKS.prince, tulane.princeSpot.x, tulane.princeSpot.z, Math.PI);
    this.swords = [0, 1, 2].map(() => {
      const s = createSword(0);
      game.scene.add(s);
      return s;
    });
    this.fade(1);
    this.aim(game, new THREE.Vector3(p.x - 9, 4.5, p.z + 3), new THREE.Vector3(p.x, 1.6, p.z + 5), true);
  }

  update(dt, game) {
    if (!this.playing) {
      if (this.queued && !game.isUiOpen()) this.play();
      return;
    }
    if (this.skipRequested || game.input.wasPressed('Escape')) {
      this.finish(true);
      return;
    }
    this.t += dt;
    this.updateNarration(dt, game);
    if (this.phase === 'court') this.court(dt, game);
    else if (this.phase === 'fadeout') this.fadeOut(dt, game);
    else if (this.phase === 'march') this.march(dt, game);
    else if (this.phase === 'arrive') this.arrive(dt, game);
  }

  /** Juggling for the king... and the accident. */
  court(dt, game) {
    const t = this.t;
    const player = game.player;
    const p = player.object3d.position;
    const tulane = game.tulane;
    this.fade(Math.max(0, 1 - t));
    this.caption(t > 0.5 && t < 4 ? INTRO.kingdom : '');
    this.aim(game, new THREE.Vector3(p.x - 9, 4.5, p.z + 3), new THREE.Vector3(p.x, 1.6, p.z + 5));
    const head = new THREE.Vector3(tulane.princeSpot.x, 1.8, tulane.princeSpot.z);
    if (t < 4) {
      // Three swords spinning through the air over Bobert's head; arms up.
      this.swords.forEach((s, i) => {
        if (i === 0 && t > 3.5) {
          // This one flies off... straight at the prince!
          const k = Math.min(1, (t - 3.5) / 0.45);
          s.position.lerpVectors(this.flyFrom ?? (this.flyFrom = s.position.clone()), head, k);
          s.rotation.x += dt * 20;
          return;
        }
        const a = t * 5 + (i * Math.PI * 2) / 3;
        s.position.set(p.x + Math.sin(a) * 0.7, p.y + 2.7 + Math.cos(a) * 0.7, p.z);
        s.rotation.set(0, 0, -a);
      });
      player.model.armL.rotation.x = player.model.armR.rotation.x = -2.6 + Math.sin(t * 10) * 0.2;
    }
    if (t >= 3.95 && !this.bonked) {
      this.bonked = true;
      game.sound?.play('thwack');
      game.particles?.burst(head, { count: 24, colors: ['#ffffff', '#ffe66b'], speed: 4, size: 0.14 });
      for (const s of this.swords) s.position.y = Math.max(0.1, s.position.y - 2); // the others clatter down
    }
    if (this.bonked) {
      const k = Math.min(1, (t - 3.95) / 0.5);
      this.prince.root.rotation.x = -Math.PI / 2 * k; // he topples over backwards
      for (const s of this.swords) {
        s.position.y = 0.1;
        s.rotation.set(Math.PI / 2, 0, s.rotation.z);
      }
    }
    if (t >= 4.8 && !this.kingSpoke) {
      this.kingSpoke = true;
      game.dialog.show('King Stuart', INTRO.king, { focus: game.kingNpc, onClose: () => this.toMarch() });
    }
  }

  /** Fade to black, then the march to Crestview with the story told on the way. */
  toMarch() {
    this.phase = 'fadeout';
    this.t = 0;
  }

  fadeOut(dt, game) {
    this.fade(Math.min(1, this.t / 0.8));
    if (this.t >= 0.9) this.startMarch(game);
  }

  startMarch(game) {
    this.clearCourt(game);
    const road = game.road.path; // from the plaza to the dock
    const back = road.slice().reverse(); // ...walked the other way: toward the village
    // Start far enough out that the march lasts about as long as the story.
    const want = 34;
    let i = 0;
    let along = 0;
    for (; i < back.length - 1 && along < (this.lengthOf(back) - want); i++) along += Math.hypot(back[i + 1].x - back[i].x, back[i + 1].z - back[i].z);
    this.route = back.slice(i);
    this.routeIndex = 0;
    const start = this.route[0];
    game.teleport(start.x, start.z, { facing: 0 });
    this.soldiers = [-1, 1].map((s) => figure(game, LOOKS.soldier, start.x + s * 1.6, start.z, 0));
    this.phase = 'march';
    this.t = 0;
    this.narrate(INTRO.narration, () => (this.storyDone = true));
  }

  lengthOf(points) {
    let len = 0;
    for (let i = 0; i < points.length - 1; i++) len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
    return len;
  }

  /** Walking along the road between two soldiers. */
  march(dt, game) {
    this.fade(Math.max(0, 1 - this.t));
    const player = game.player;
    const pos = player.object3d.position;
    const speed = this.storyDone ? 6 : 2.2;
    let step = speed * dt;
    while (step > 0 && this.routeIndex < this.route.length - 1) {
      const next = this.route[this.routeIndex + 1];
      const d = Math.hypot(next.x - pos.x, next.z - pos.z);
      if (d <= step) {
        pos.x = next.x;
        pos.z = next.z;
        this.routeIndex++;
        step -= d;
      } else {
        pos.x += ((next.x - pos.x) / d) * step;
        pos.z += ((next.z - pos.z) / d) * step;
        step = 0;
      }
    }
    const ahead = this.route[Math.min(this.routeIndex + 1, this.route.length - 1)];
    const dir = new THREE.Vector3(ahead.x - pos.x, 0, ahead.z - pos.z);
    if (dir.lengthSq() > 0.0001) dir.normalize();
    const facing = Math.atan2(dir.x, dir.z);
    player.model.root.rotation.y = facing;
    player.velocity.set(0, 0, 0);
    this.walk = (this.walk ?? 0) + dt * 7;
    poseWalk(player.model, this.walk, 0.8);
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    this.soldiers.forEach((s, i) => {
      const o = i === 0 ? -1.6 : 1.6;
      s.root.position.set(pos.x + side.x * o, pos.y, pos.z + side.z * o);
      s.root.rotation.y = facing;
      poseWalk(s, this.walk + i, 0.8);
    });
    this.aim(game, new THREE.Vector3(pos.x - dir.x * 6 + side.x * 5, pos.y + 4.5, pos.z - dir.z * 6 + side.z * 5), new THREE.Vector3(pos.x + dir.x * 3, pos.y + 1.2, pos.z + dir.z * 3));
    const arrived = this.routeIndex >= this.route.length - 1;
    if (arrived && this.storyDone) {
      this.phase = 'arrive';
      this.t = 0;
      poseWalk(player.model, 0, 0);
      game.dialog.show('Tulane Soldier', INTRO.soldiers, { focus: { object3d: this.soldiers[1].root }, onClose: () => (this.soldiersLeave = true) });
    }
  }

  /** "Your new home, juggler." The soldiers march off, and the adventure begins. */
  arrive(dt, game) {
    const pos = game.player.object3d.position;
    this.aim(game, new THREE.Vector3(pos.x - 6, pos.y + 4, pos.z - 6), new THREE.Vector3(pos.x, pos.y + 1.2, pos.z));
    if (!this.soldiersLeave) return;
    this.leaveTime = (this.leaveTime ?? 0) + dt;
    this.caption(INTRO.village);
    for (const s of this.soldiers) {
      s.root.rotation.y = Math.PI + Math.atan2(pos.x, pos.z);
      s.root.position.x += Math.sin(s.root.rotation.y) * 3 * dt;
      s.root.position.z += Math.cos(s.root.rotation.y) * 3 * dt;
      poseWalk(s, (this.walk += dt * 7), 0.8);
    }
    if (this.leaveTime > 2.8) this.finish(false);
  }

  clearCourt(game) {
    if (this.prince) game.scene.remove(this.prince.root);
    for (const s of this.swords ?? []) game.scene.remove(s);
    this.prince = null;
    this.swords = [];
  }

  /** Done (or skipped): Bobert is in Crestview Village, and the game begins. */
  finish(skipped) {
    const game = this.game;
    this.clearCourt(game);
    for (const s of this.soldiers ?? []) game.scene.remove(s.root);
    this.soldiers = [];
    if (game.dialog.isOpen) {
      game.dialog.onClose = null;
      game.dialog.close();
    }
    if (skipped || this.phase !== 'arrive') game.teleport(1.5, 3, { facing: Math.PI });
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // storage blocked: it'll play again next time
    }
    this.phase = null;
    this.end();
    game.questLog?.toast(`Welcome to ${INTRO.village}!`, 4);
  }
}

/** The ending, after King Stuart is defeated: the story's last words, over Tulane's courtyard. */
export class Ending extends Cutscene {
  constructor() {
    super('ending');
  }

  onAdd(game) {
    super.onAdd(game);
    game.ending = this;
  }

  play() {
    this.begin();
    this.t = 0;
    this.narrate(ENDING, () => this.close());
    this.game.player.wearCrown?.();
    this.game.sound?.play('quest');
  }

  close() {
    this.end();
    this.game.questLog?.toast('Bobert of Tulane! (Keep exploring: the adventure goes on.)', 5);
  }

  update(dt, game) {
    if (!this.playing) return;
    if (this.skipRequested || game.input.wasPressed('Escape')) {
      this.close();
      return;
    }
    this.t += dt;
    this.updateNarration(dt, game);
    // Slowly circle round Bobert.
    const p = game.player.object3d.position;
    const a = this.t * 0.25;
    _look.set(p.x, p.y + 1.3, p.z);
    this.aim(game, new THREE.Vector3(p.x + Math.sin(a) * 6, p.y + 3, p.z + Math.cos(a) * 6), _look, this.t < 0.05);
  }
}
