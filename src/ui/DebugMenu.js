import { Entity } from '../core/Entity.js';
import { CHECKPOINTS, applyCheckpoint } from '../checkpoints.js';

/**
 * The debug menu, for testing: press ` (the key above Tab) to open it.
 *  - Jump to any point in the story (reloads the page at that checkpoint, see checkpoints.js).
 *  - Cheats: coins, magic, healing, can't-get-hurt mode, day/night, and teleports.
 * Opening the page with ?checkpoint=<id> also jumps there. Lives at game.debugMenu.
 */
export class DebugMenu extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.el = document.createElement('div');
    this.el.className = 'modal debug-menu hidden';
    document.body.append(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      const button = e.target.closest('button');
      if (button) this.pending = button.dataset;
    });
  }

  onAdd(game) {
    this.game = game;
    game.debugMenu = this;
    game.ui.push(this);
  }

  /** Called once everything is set up: jump to ?checkpoint=... if the URL asks for one. */
  start() {
    const id = new URLSearchParams(location.search).get('checkpoint');
    if (id) applyCheckpoint(this.game, id);
  }

  get cheats() {
    const game = this.game;
    const p = game.player;
    const place = (x, z, y) => () => game.teleport(x, z, { y });
    const tower = game.quests.crystal.island.crystalSpot;
    const gate = game.charibdisCave.gateSpot;
    return [
      { id: 'coins', label: '+100 coins', run: () => p.addCoins(100) },
      { id: 'magic', label: 'Magic conduit, full of magic', run: () => ((p.hasConduit = true), (p.magic = 100)) },
      { id: 'heal', label: 'Heal fully', run: () => (p.health = p.maxHealth) },
      { id: 'god', label: `Can't get hurt: ${p.godMode ? 'ON' : 'off'}`, run: () => (p.godMode = !p.godMode) },
      { id: 'day', label: 'Make it day', run: () => (game.dayNight.time = 0.1) },
      { id: 'night', label: 'Make it night', run: () => (game.dayNight.time = 0.72) },
      { id: 'tp-village', label: 'Go: village', run: place(0, 0) },
      { id: 'tp-dock', label: 'Go: dock', run: place(game.dock.start + 4, game.dock.z) },
      { id: 'tp-tower', label: 'Go: tower top', run: place(tower.x + 2, tower.z, tower.y - 0.5) },
      { id: 'tp-cellar', label: "Go: Ward's cellar", run: place(game.cellar.arrive.x, game.cellar.arrive.z) },
      { id: 'tp-charibdis', label: "Go: Charibdis's cave", run: place(gate.x, gate.z - 3) },
      { id: 'tp-jungle', label: 'Go: jungle', run: () => game.jungle.travel(game) },
    ];
  }

  open() {
    this.isOpen = true;
    this.render();
    this.el.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
  }

  render() {
    const current = new URLSearchParams(location.search).get('checkpoint') ?? 'start';
    this.el.innerHTML = `
      <div class="modal-header"><div class="modal-title">Debug menu</div></div>
      <p class="modal-message">Jump to a part of the story (the game restarts there), or use a cheat.</p>
      <div class="shop-section">Story checkpoints</div>
      <div class="debug-list">
        ${CHECKPOINTS.map((c) => `<button class="debug-row${c.id === current ? ' current' : ''}" data-checkpoint="${c.id}">${c.label}</button>`).join('')}
      </div>
      <div class="shop-section">Cheats</div>
      <div class="debug-cheats">
        ${this.cheats.map((c) => `<button class="debug-cheat" data-cheat="${c.id}">${c.label}</button>`).join('')}
      </div>
      <button class="ghost" data-close="1">Close (Esc or \`)</button>`;
  }

  update(_dt, game) {
    const { input } = game;
    if (!this.isOpen) {
      if (input.wasPressed('Backquote') && !game.isUiOpen()) this.open();
      return;
    }
    const pending = this.pending;
    this.pending = null;
    if (pending?.checkpoint) {
      const url = new URL(location.href);
      url.searchParams.set('checkpoint', pending.checkpoint);
      location.href = url.toString(); // restart the game at that point
      return;
    }
    if (pending?.cheat) {
      const cheat = this.cheats.find((c) => c.id === pending.cheat);
      cheat?.run();
      game.questLog?.toast(`Debug: ${cheat?.label}`);
      if (pending.cheat.startsWith('tp-')) this.close();
      else this.render();
      return;
    }
    if (pending?.close || input.wasPressed('Escape', 'Backquote')) this.close();
  }
}
