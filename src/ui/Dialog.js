import { Entity } from '../core/Entity.js';
import { keyName } from '../controls.js';

const CHARS_PER_SECOND = 45;

/**
 * Speech box at the bottom of the screen with a typewriter effect, plus the
 * "Press T to …" prompt for whatever you can interact with. Lives at game.dialog.
 *
 *   game.dialog.show('Merchant', ['Hello!', 'Second page...'], { focus: merchant, onClose: () => {} });
 *
 * `focus` (optional) is the entity speaking; the camera frames it together with the player.
 * Enter, Space or a click skips the typing, then advances to the next page / closes.
 *
 * Interactions: anything nearby calls `offerInteraction(text, distance, action)` every frame.
 * The closest offer is shown as a prompt, and pressing T runs its action.
 *
 * Add this entity AFTER the player and NPCs so the key that closes a dialog doesn't also
 * swing the sword, and so it sees every offer made this frame.
 */
export class Dialog extends Entity {
  constructor() {
    super();
    this.box = document.createElement('div');
    this.box.className = 'dialog hidden';
    this.box.innerHTML = `
      <div class="dialog-name"></div>
      <p class="dialog-text"></p>
      <div class="dialog-next"><kbd>Enter</kbd></div>`;
    this.nameEl = this.box.querySelector('.dialog-name');
    this.textEl = this.box.querySelector('.dialog-text');
    this.box.addEventListener('pointerdown', () => (this.advanceRequested = true));

    this.promptEl = document.createElement('div');
    this.promptEl.className = 'prompt hidden';

    document.body.append(this.box, this.promptEl);

    this.pages = [];
    this.page = 0;
    this.shown = 0;
    this.onClose = null;
    this.focus = null;
    this.advanceRequested = false;
    this.offer = null;
  }

  get isOpen() {
    return this.pages.length > 0;
  }

  onAdd(game) {
    game.dialog = this;
    game.ui.push(this);
  }

  show(speaker, pages, { focus = null, onClose = null } = {}) {
    this.focus = focus;
    this.nameEl.textContent = speaker;
    this.pages = pages;
    this.page = 0;
    this.shown = 0;
    this.onClose = onClose;
    this.textEl.textContent = '';
    this.box.classList.remove('hidden');
    this.box.classList.add('typing');
    document.body.classList.add('talking');
  }

  close() {
    this.pages = [];
    this.focus = null;
    this.box.classList.add('hidden');
    document.body.classList.remove('talking');
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }

  /** Offer something to do with T this frame (talk, open, shop...). The closest offer wins. */
  offerInteraction(text, distance, action) {
    if (!this.offer || distance < this.offer.distance) this.offer = { text, distance, action };
  }

  update(dt, game) {
    const offer = this.offer;
    this.offer = null;
    const advance =
      this.advanceRequested ||
      game.input.wasPressed('Enter', 'Space', 'NumpadEnter') ||
      game.input.hit('swing') ||
      game.input.hit('jump') ||
      game.input.clicked;
    this.advanceRequested = false;

    // Interaction prompt (only when nothing else is open).
    const canInteract = offer && !game.isUiOpen() && !game.player?.dead;
    this.promptEl.classList.toggle('hidden', !canInteract);
    if (canInteract) {
      // Prompts say "Press T to ..."; show the key the player has picked for talking, then what it does.
      const key = keyName(game.input.bindings.interact[0]);
      if (offer.text + key !== this.promptText) {
        this.promptText = offer.text + key;
        const what = offer.text.replace(/^Press T( to)?\s*/, '');
        this.promptEl.innerHTML = `<kbd>${key}</kbd><span></span>`;
        this.promptEl.querySelector('span').textContent = what[0].toUpperCase() + what.slice(1);
      }
      if (game.input.hit('interact')) {
        this.promptEl.classList.add('hidden');
        offer.action();
      }
    }

    if (!this.isOpen) return;
    this.box.querySelector('.dialog-next').classList.toggle('last', this.page === this.pages.length - 1);

    const text = this.pages[this.page];
    const typing = this.shown < text.length;
    this.box.classList.toggle('typing', typing);

    if (advance) {
      if (typing) this.shown = text.length;
      else if (this.page < this.pages.length - 1) {
        this.page++;
        this.shown = 0;
      } else {
        this.close();
        return;
      }
    } else if (typing) {
      this.shown = Math.min(text.length, this.shown + CHARS_PER_SECOND * dt);
    }

    this.textEl.textContent = this.pages[this.page].slice(0, Math.floor(this.shown));
  }
}
