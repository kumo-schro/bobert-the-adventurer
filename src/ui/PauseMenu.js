import { Entity } from '../core/Entity.js';
import { keyName } from '../controls.js';

/**
 * Esc: the pause menu (it also opens by itself when you switch to another window). The world
 * stops while it's open. From here you can save or load, change how Bobert looks, change the
 * keys, turn the sound and music on or off and suggest a change; closing one of those brings you back
 * here. It also shows how to play. Lives at game.pauseMenu.
 */
export class PauseMenu extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.child = null; // the menu we opened from here (we come back when it closes)
    this.el = document.createElement('div');
    this.el.className = 'pause hidden';
    this.el.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (button?.dataset.choice) this.pending = button.dataset.choice;
    });
    document.body.append(this.el);
    // Switching to another window or tab pauses the game.
    window.addEventListener('blur', () => (this.autoPause = true));
    document.addEventListener('visibilitychange', () => document.hidden && (this.autoPause = true));
  }

  onAdd(game) {
    this.game = game;
    game.pauseMenu = this;
    game.ui.push(this);
  }

  open() {
    this.isOpen = true;
    this.render();
    this.el.classList.remove('hidden');
    document.body.classList.add('paused');
    this.game.sound?.play('open');
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('paused');
  }

  /** Open another menu on top; when it closes, the pause menu comes back. */
  openChild(menu) {
    this.close();
    this.child = menu;
    menu.open();
  }

  render() {
    const game = this.game;
    const key = (action) => `<kbd>${keyName(game.input.bindings[action]?.[0] ?? '?')}</kbd>`;
    const p = game.player;
    const moveKeys = ['forward', 'left', 'back', 'right'].map((a) => keyName(game.input.bindings[a]?.[0] ?? '?')).join(' ');
    const help = [
      [`<kbd>${moveKeys}</kbd>`, 'Move'],
      [key('jump'), p.hasDoubleJump ? 'Jump (again in the air!)' : 'Jump'],
      [key('dodge'), p.hasDreamDash ? 'Dream Dash · hold to run' : 'Roll · hold to run'],
      p.knowsPerfectDodge && [key('dodge'), 'Roll through a hit: Perfect Dodge!'],
      [`${key('swing')} <kbd>Click</kbd>`, 'Sword · tap again for a combo'],
      p.knowsSpin && [key('swing'), 'Hold, then let go: spin attack'],
      p.knowsSkyStrike && [key('swing'), 'In the air: Sky Strike'],
      p.hasShield && [key('shield'), 'Hold to block'],
      p.hasBow && [key('bow'), p.bowTier >= 1 ? 'Bow · hold to power up' : 'Bow'],
      p.hasConduit && [key('power'), 'Star Burst'],
      [key('eat'), 'Eat food'],
      [key('interact'), 'Talk · open · use'],
      ['<kbd>Drag</kbd>', 'Look around · scroll to zoom'],
      [key('quests'), 'All your quests'],
    ].filter(Boolean);
    const sound = game.sound?.muted ? 'Off' : 'On';
    this.el.innerHTML = `
      <div class="pause-card">
        <div class="pause-title">Paused</div>
        <div class="pause-buttons">
          <button class="primary" data-choice="resume">Resume</button>
          <button data-choice="save">Save &amp; load</button>
          <button data-choice="look">Customize Bobert</button>
          <button data-choice="controls">Controls</button>
          <button data-choice="sound">Sound: ${sound}</button>
          <button data-choice="music">Music: ${game.music?.enabled ? 'On' : 'Off'}</button>
          <button data-choice="suggest">Suggest a change</button>
        </div>
      </div>
      <div class="pause-card pause-help">
        <div class="pause-subtitle">How to play</div>
        <ul>${help.map(([k, what]) => `<li><span class="keys">${k}</span><span>${what}</span></li>`).join('')}</ul>
      </div>`;
  }

  choose(choice) {
    const game = this.game;
    game.sound?.play('click');
    if (choice === 'resume') this.close();
    else if (choice === 'save') this.openChild(game.saveMenu);
    else if (choice === 'look') this.openChild(game.customizer);
    else if (choice === 'controls') this.openChild(game.controlsMenu);
    else if (choice === 'sound') {
      game.sound?.toggle(game);
      this.render();
    } else if (choice === 'music') {
      game.music?.toggle();
      this.render();
    } else if (choice === 'suggest') {
      this.close();
      game.suggestions?.startPicking();
    }
  }

  update(_dt, game) {
    const { input } = game;
    if (this.child && !this.child.isOpen) {
      this.child = null;
      this.open();
      return;
    }
    if (this.isOpen) {
      if (this.pending) this.choose(this.pending);
      else if (input.wasPressed('Escape')) this.close();
      this.pending = null;
      return;
    }
    // Only an Esc that didn't just close something else opens the menu.
    if (input.wasPressed('Escape') && !game.uiWasOpen && !game.isUiOpen()) this.open();
    if (this.autoPause) {
      this.autoPause = false;
      if (!game.isUiOpen() && !game.player.dead) this.open();
    }
  }
}
