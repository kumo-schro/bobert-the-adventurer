import { Entity } from '../core/Entity.js';
import { PLACES, SEA } from '../config.js';
import { keyName } from '../controls.js';

const SIZE = 560; // the map's size in pixels
const GRID = 140; // how many land samples across

// The places that have a map, and how much of the world each one shows (half its width).
const REGIONS = [
  { id: 'home', name: 'The home sea', x: 0, z: 0, half: 340 },
  { id: 'jungle', name: 'The jungle island', ...PLACES.jungle, half: 110 },
  { id: 'fire', name: 'The fire island', ...PLACES.fireIsland, half: 100 },
  { id: 'tulane', name: 'Tulane Kingdom', ...PLACES.tulane, half: 75 },
  { id: 'dream', name: 'The dream', x: PLACES.dream.x, z: PLACES.dream.z, half: 60 },
];

/**
 * The map (M, or from the pause menu): a top-down view of wherever you are (the home sea and
 * its islands, or the far-off island you've sailed to), with you, your quest and the landmarks.
 * North is up. The land is worked out by asking the game where you can walk, so it always matches
 * the world. Lives at game.map.
 */
export class MapScreen extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.el = document.createElement('div');
    this.el.className = 'map-screen hidden';
    this.el.innerHTML = `
      <div class="map-card">
        <div class="map-header"><div class="map-title"></div><div class="map-hint"></div></div>
        <canvas width="${SIZE}" height="${SIZE}"></canvas>
        <div class="map-legend"><span><i class="you"></i>You</span><span><i class="goal"></i>Quest</span><span><i class="save"></i>Save crystal</span></div>
      </div>`;
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.el.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('canvas')) this.pendingClose = true;
    });
    document.body.append(this.el);
    this.land = new Map(); // region id -> a canvas with the land drawn on it
  }

  onAdd(game) {
    this.game = game;
    game.map = this;
    game.ui.push(this);
  }

  open() {
    this.isOpen = true;
    this.openedFrame = true;
    this.el.classList.remove('hidden');
    this.game.sound?.play('open');
    this.draw();
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.game.sound?.play('close');
  }

  /** The region the player is in (or null somewhere with no map, like Ward's cellar). */
  region() {
    const p = this.game.player.object3d.position;
    return REGIONS.find((r) => Math.hypot(p.x - r.x, p.z - r.z) < r.half * 1.4) ?? null;
  }

  /** World (x, z) to map pixels. North (+z) is up. */
  toMap(r, x, z) {
    return [((x - r.x) / (r.half * 2) + 0.5) * SIZE, (0.5 - (z - r.z) / (r.half * 2)) * SIZE];
  }

  /** The land of a region, sampled once from where you can walk. */
  landFor(r) {
    if (this.land.has(r.id)) return this.land.get(r.id);
    const game = this.game;
    const c = document.createElement('canvas');
    c.width = c.height = GRID;
    const ctx = c.getContext('2d');
    const cell = (r.half * 2) / GRID;
    for (let iy = 0; iy < GRID; iy++) {
      for (let ix = 0; ix < GRID; ix++) {
        const x = r.x - r.half + (ix + 0.5) * cell;
        const z = r.z + r.half - (iy + 0.5) * cell;
        if (!game.isWalkable(x, z, -1)) continue;
        const beach = r.id === 'home' && game.terrain && !game.terrain.isGrass(x, z) && game.terrain.isInside(x, z, -2);
        ctx.fillStyle = beach ? '#f3dca0' : r.id === 'fire' ? '#5b4a46' : r.id === 'dream' ? '#d9c7ff' : '#86cf63';
        ctx.fillRect(ix, iy, 1, 1);
      }
    }
    this.land.set(r.id, c);
    return c;
  }

  draw() {
    const game = this.game;
    const ctx = this.ctx;
    const r = this.region();
    this.el.querySelector('.map-title').textContent = r ? r.name : 'No map down here!';
    this.el.querySelector('.map-hint').innerHTML = `<kbd>${keyName(game.input.bindings.map?.[0] ?? 'KeyM')}</kbd> or <kbd>Esc</kbd> close`;
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!r) return;
    // Sea, then land (drawn small and scaled up, with soft edges).
    const sea = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.1, SIZE / 2, SIZE / 2, SIZE * 0.75);
    sea.addColorStop(0, r.id === 'dream' ? '#5b3fa8' : '#4aa3e8');
    sea.addColorStop(1, r.id === 'dream' ? '#2a1b5c' : '#2d6fb8');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingEnabled = true;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 6;
    ctx.drawImage(this.landFor(r), 0, 0, SIZE, SIZE);
    ctx.restore();

    if (r.id === 'home') this.drawHomeLandmarks(r);
    for (const s of game.savePoints ?? []) {
      const [x, y] = this.toMap(r, s.object3d.position.x, s.object3d.position.z);
      if (x < 0 || y < 0 || x > SIZE || y > SIZE) continue;
      this.diamond(x, y, 6, '#7af0ff');
    }
    this.drawQuest(r);
    this.drawPlayer(r);
    // Compass
    ctx.fillStyle = 'rgba(16, 20, 38, 0.6)';
    ctx.beginPath();
    ctx.arc(SIZE - 34, 34, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', SIZE - 34, 35);
  }

  drawHomeLandmarks(r) {
    const game = this.game;
    const p = game.player;
    const marks = [
      { x: 0, z: 0, label: 'Crestview' },
      game.dock && { x: game.dock.end, z: game.dock.z, label: 'Dock' },
      { ...PLACES.cave, label: 'Cave' },
      { ...PLACES.stoneCircle, label: 'Stones' },
      { ...PLACES.towerIsland, label: 'Tower' },
      { ...PLACES.charibdisCave, label: 'Sea cave' },
    ].filter(Boolean);
    for (const m of marks) this.label(r, m.x, m.z, m.label);
    // Far-off lands you've been to, as arrows at the edge of the map.
    const far = [
      p.visitedJungle && { ...PLACES.jungle, label: 'Jungle' },
      p.visitedFire && { ...PLACES.fireIsland, label: 'Fire island' },
      p.visitedTulane && { ...PLACES.tulane, label: 'Tulane' },
    ].filter(Boolean);
    for (const f of far) this.edgeArrow(r, f.x, f.z, f.label, '#ffffff');
    // How far out you can swim
    const ctx = this.ctx;
    const [cx, cy] = this.toMap(r, 0, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, (SEA.radius / (r.half * 2)) * SIZE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** The tracked quest's goal: a star on the map, or an arrow at the edge if it's somewhere else. */
  drawQuest(r) {
    const log = this.game.questLog;
    const entry = log?.entries.get(log.tracked);
    const target = typeof entry?.target === 'function' ? entry.target() : entry?.target;
    const to = target?.questPosition ?? target?.object3d?.position;
    if (!to) return;
    const [x, y] = this.toMap(r, to.x, to.z);
    if (x >= 8 && y >= 8 && x <= SIZE - 8 && y <= SIZE - 8) this.star(x, y, 11, '#ffc93c');
    else this.edgeArrow(r, to.x, to.z, entry.title, '#ffc93c');
  }

  drawPlayer(r) {
    const ctx = this.ctx;
    const p = this.game.player;
    const pos = p.object3d.position;
    const [x, y] = this.toMap(r, pos.x, pos.z);
    const facing = p.boat ? p.boat.heading : p.model.root.rotation.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing + Math.PI); // facing 0 is +z (north, up the map)
    ctx.fillStyle = '#ff4d6d';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(9, -9);
    ctx.lineTo(0, -4);
    ctx.lineTo(-9, -9);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  label(r, wx, wz, text) {
    const ctx = this.ctx;
    const [x, y] = this.toMap(r, wx, wz);
    ctx.fillStyle = 'rgba(16, 20, 38, 0.75)';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 13px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16, 20, 38, 0.75)';
    ctx.strokeText(text, x, y - 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y - 6);
  }

  /** An arrow at the edge of the map pointing toward something off it. */
  edgeArrow(r, wx, wz, text, color) {
    const ctx = this.ctx;
    const a = Math.atan2(-(wz - r.z), wx - r.x); // screen angle (y down)
    const reach = SIZE / 2 - 26;
    const s = Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const x = SIZE / 2 + (Math.cos(a) / s) * reach;
    const y = SIZE / 2 + (Math.sin(a) / s) * reach;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -9);
    ctx.lineTo(-6, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = '700 13px Nunito, sans-serif';
    ctx.textAlign = x < SIZE / 3 ? 'left' : x > (SIZE * 2) / 3 ? 'right' : 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16, 20, 38, 0.8)';
    const tx = x - Math.cos(a) * 22;
    const ty = y - Math.sin(a) * 18;
    ctx.strokeText(text, tx, ty);
    ctx.fillStyle = color;
    ctx.fillText(text, tx, ty);
  }

  diamond(x, y, r, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(16, 20, 38, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  star(x, y, r, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(16, 20, 38, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const d = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  update(_dt, game) {
    const { input } = game;
    if (this.isOpen) {
      if (this.pendingClose || input.wasPressed('Escape') || (!this.openedFrame && input.hit('map'))) this.close();
      this.pendingClose = false;
      this.openedFrame = false;
      return;
    }
    if (input.hit('map') && !game.isUiOpen() && !game.player.dead) this.open();
  }
}
