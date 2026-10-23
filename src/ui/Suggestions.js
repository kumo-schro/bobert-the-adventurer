import * as THREE from 'three';
import { Entity } from '../core/Entity.js';

// What to call things people click on (by entity class). Entities can also have their own
// describe(point) or a `name` (townsfolk).
const NAMES = {
  Ground: 'the ground',
  Water: 'the sea',
  Forest: 'a tree',
  Gathering: 'a boulder',
  Cave: 'the mountain with the cave',
  StoneCircle: 'the rainbow stones',
  Dock: 'the dock',
  Road: 'the road',
  TowerIsland: 'the sea tower',
  SmallIsland: 'a little island',
  CharibdisCave: "Charibdis's sea cave",
  Cellar: "Ward's cellar",
  Jungle: 'the jungle',
  Flowers: 'the flowers',
  Mountains: 'the mountains far away',
  Clouds: 'a cloud',
  Sky: 'the sky',
  Chest: 'a treasure chest',
  Trapdoor: 'the old trapdoor',
  Collectible: 'a glowing thing to collect',
  Artifact: 'the precious artifact',
  Butterflies: 'a butterfly',
  Player: 'Bobert (you)',
  Slime: 'a slime',
  Spider: 'a cave spider',
  Shark: 'a shark',
  Eel: 'an eel',
  Kraken: 'the Kraken',
  Gargoyle: 'a gargoyle',
  Charibdis: 'Charibdis',
  FlyTrap: 'a giant Venus fly trap',
  Snake: 'a snake',
  Gorilla: 'a gorilla',
};

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

/**
 * "Suggest a change": press / (or click the 💡 button), click on anything in the game, and
 * type how you'd like it changed. It's saved with where you are, what you clicked, what quest
 * you're on, and a small screenshot, to /api/recommendations (recommendations.json when playing
 * locally, the Vercel Blob store on the live site). Nothing happens automatically: the game's
 * owner reads them later. Lives at game.suggestions.
 */
export class Suggestions extends Entity {
  constructor() {
    super();
    this.mode = null; // null, 'picking' or 'typing'
    this.banner = document.createElement('div');
    this.banner.className = 'suggest-banner hidden';
    this.banner.innerHTML = 'Click on the thing you want to change. <span>(Esc to cancel, Enter to skip)</span>';

    this.panel = document.createElement('form');
    this.panel.className = 'modal suggest-panel hidden';
    this.panel.innerHTML = `
      <div class="modal-header"><div class="modal-title">💡 Suggest a change</div></div>
      <p class="modal-message suggest-target"></p>
      <textarea class="suggest-text" maxlength="1000" rows="4" placeholder="How would you like it changed? (For example: make the well bigger and give it a bucket that goes up and down)"></textarea>
      <input class="suggest-name" maxlength="40" placeholder="Your name (optional)" />
      <div class="suggest-status"></div>
      <div class="modal-footer">
        <button type="button" class="ghost" data-cancel="1">Cancel</button>
        <button type="submit" class="primary suggest-send">Send idea</button>
      </div>`;
    this.textEl = this.panel.querySelector('.suggest-text');
    this.nameEl = this.panel.querySelector('.suggest-name');
    this.statusEl = this.panel.querySelector('.suggest-status');
    this.panel.addEventListener('submit', (e) => {
      e.preventDefault();
      this.send();
    });
    this.panel.querySelector('[data-cancel]').addEventListener('click', () => this.close());
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      if (e.key === 'Enter' && !e.shiftKey && e.target === this.textEl) {
        e.preventDefault();
        this.send();
      }
    });
    document.body.append(this.button, this.banner, this.panel);
    try {
      this.nameEl.value = localStorage.getItem('voxel-meadow-name') ?? '';
    } catch {
      // storage blocked: no remembered name
    }
  }

  get isOpen() {
    return this.mode !== null;
  }

  onAdd(game) {
    this.game = game;
    game.suggestions = this;
    game.ui.push(this);
  }

  startPicking() {
    this.mode = 'picking';
    this.banner.classList.remove('hidden');
    document.body.classList.add('picking');
  }

  close() {
    this.mode = null;
    this.banner.classList.add('hidden');
    this.panel.classList.add('hidden');
    document.body.classList.remove('picking');
    this.textEl.blur();
    this.nameEl.blur();
  }

  /** Work out what's under the mouse, take the snapshot, and open the text box. */
  pick(clientX, clientY) {
    const game = this.game;
    let target = { label: 'something in the game (nothing in particular)' };
    if (clientX !== undefined) {
      const rect = game.renderer.domElement.getBoundingClientRect();
      _ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      game.scene.updateMatrixWorld(); // make sure everything is where it was last drawn
      _raycaster.setFromCamera(_ndc, game.camera);
      const hits = _raycaster.intersectObjects(game.scene.children, true).filter((h) => isVisible(h.object) && h.distance < 1500);
      const hit = hits.find((h) => this.entityFor(h.object)) ?? hits[0];
      if (hit) target = this.describeHit(hit);
    }
    this.target = target;
    this.context = this.snapshotContext(target);
    this.screenshot = this.takeScreenshot(clientX, clientY);

    this.mode = 'typing';
    this.banner.classList.add('hidden');
    document.body.classList.remove('picking');
    this.panel.querySelector('.suggest-target').textContent = `You picked: ${target.label}`;
    this.statusEl.textContent = '';
    this.textEl.value = '';
    this.panel.classList.remove('hidden');
    setTimeout(() => this.textEl.focus(), 0);
  }

  entityFor(object) {
    for (let o = object; o; o = o.parent) {
      const entity = this.game.entities.find((e) => e.object3d === o);
      if (entity) return entity;
    }
    return null;
  }

  describeHit(hit) {
    const entity = this.entityFor(hit.object);
    const point = hit.point;
    const kind = entity?.constructor.name ?? 'Unknown';
    let label = NAMES[kind] ?? kind;
    if (entity?.describe) label = entity.describe(point) ?? label;
    else if (entity?.name && kind === 'Npc') label = entity.name;
    else if (kind === 'Slime' && entity.artifact) label = 'the Gelationus Slime';
    else if (kind === 'Eel' && entity.kind?.health >= 10) label = 'the Sea Serpent';
    else if (kind === 'Ground') label = this.game.terrain.isGrass(point.x, point.z) ? 'the grass' : 'the beach';
    return { label, entity: kind, point: roundVector(point), distance: Math.round(hit.distance) };
  }

  /** Where are we, broadly? */
  areaName(x, y, z) {
    const game = this.game;
    if (game.dream?.contains(x, y, z)) return 'the dream dimension';
    if (game.cellar?.isInside(x, z, -2)) return "Ward's cellar";
    if (game.jungle?.isInside(x, z, -6)) return 'the jungle island';
    if (game.charibdisCave?.isInsideCave(x, z)) return "inside Charibdis's sea cave";
    if (game.cave?.isUnderRoof(x, z)) return 'inside the mountain cave';
    for (const land of game.lands) {
      if (land.constructor.name === 'TowerIsland' && land.isInside(x, z, -4)) return 'the tower island';
      if (land.constructor.name === 'SmallIsland' && land.isInside(x, z, -3)) return 'a little island';
    }
    if (game.dock?.isInside(x, z, -1)) return 'the dock';
    if (game.terrain?.isInside(x, z, -2)) return Math.hypot(x, z) < 30 ? 'the village' : 'the main island';
    return 'out at sea';
  }

  snapshotContext(target) {
    const game = this.game;
    const p = game.player;
    const pos = p.object3d.position;
    const quests = [...(game.questLog?.entries ?? new Map()).values()]
      .filter((e) => !e.done)
      .map((e) => `${e.title}: ${e.objective}`);
    return {
      target,
      area: this.areaName(pos.x, pos.y, pos.z),
      player: {
        position: roundVector(pos),
        swimming: p.swimming,
        health: `${p.health}/${p.maxHealth}`,
        coins: p.coins,
        gear: [
          p.hasShield && (p.shieldTier >= 1 ? 'iron shield' : 'shield'),
          p.swordTier >= 1 ? "knight's sword" : 'sword',
          p.hasBow && (p.bowTier >= 1 ? 'power bow' : 'bow'),
          p.armor && 'armor',
          p.hasConduit && 'magic conduit',
        ].filter(Boolean),
      },
      quests,
      mainQuest: game.quests?.main.stage,
      time: game.dayNight?.isNight ? 'night' : 'day',
      checkpoint: new URLSearchParams(location.search).get('checkpoint'),
      camera: { yaw: round(game.cameraRig?.yaw), pitch: round(game.cameraRig?.pitch) },
      page: location.origin + location.pathname,
      screen: `${innerWidth}x${innerHeight}`,
    };
  }

  /** A small JPEG of what the player sees, with a ring around what they clicked. */
  takeScreenshot(clientX, clientY) {
    try {
      const game = this.game;
      game.renderer.render(game.scene, game.camera); // the drawing buffer is only valid right after a render
      const source = game.renderer.domElement;
      const width = 640;
      const height = Math.round((width * source.height) / source.width);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, width, height);
      if (clientX !== undefined) {
        const rect = source.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * width;
        const y = ((clientY - rect.top) / rect.height) * height;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }
      return canvas.toDataURL('image/jpeg', 0.6);
    } catch {
      return null;
    }
  }

  async send() {
    const text = this.textEl.value.trim();
    if (!text) {
      this.statusEl.textContent = 'Type your idea first!';
      return;
    }
    if (this.sending) return;
    this.sending = true;
    const name = this.nameEl.value.trim();
    try {
      localStorage.setItem('voxel-meadow-name', name);
    } catch {
      // storage blocked: fine
    }
    this.statusEl.textContent = 'Sending...';
    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, name, context: this.context, screenshot: this.screenshot }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? `Error ${response.status}`);
      this.lastSentId = result.id;
      this.close();
      this.game.questLog?.toast('Thanks! Your idea was saved. 💡');
    } catch (error) {
      this.statusEl.textContent = `Couldn't send it: ${error.message}`;
    } finally {
      this.sending = false;
    }
  }

  update(_dt, game) {
    const { input } = game;
    if (this.requestOpen || (input.hit('suggest') && !game.isUiOpen())) {
      this.requestOpen = false;
      if (!this.isOpen) this.startPicking();
      return;
    }
    if (this.mode === 'picking') {
      if (input.wasPressed('Escape')) this.close();
      else if (input.wasPressed('Enter', 'NumpadEnter')) this.pick();
      else if (input.clicked) this.pick(input.clickX, input.clickY);
    }
  }
}

function isVisible(object) {
  for (let o = object; o; o = o.parent) if (!o.visible) return false;
  return !(object.material?.colorWrite === false);
}

function round(v) {
  return v === undefined ? undefined : Math.round(v * 100) / 100;
}

function roundVector(v) {
  return { x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10, z: Math.round(v.z * 10) / 10 };
}
