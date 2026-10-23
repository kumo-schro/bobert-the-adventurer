import { Entity } from '../core/Entity.js';
import { FOOD, BUFFS, MAGIC, FAME, DREAM, BOW } from '../config.js';
import { keyName } from '../controls.js';
import { icon } from './icons.js';

const HEART = '<svg viewBox="0 0 16 14"><path d="M8 13.5 1.6 7.2A3.9 3.9 0 0 1 8 2.4a3.9 3.9 0 0 1 6.4 4.8Z"/></svg>';

/**
 * The HUD. Top left: health, magic (once you have a magic conduit), coins, fame and buffs.
 * Bottom right: the action bar, one slot per thing you can do, with its key (slots appear as
 * you get the gear, and dim while they can't be used). Plus the power bow's charge, a red edge
 * when you get hurt (and a heartbeat when you're nearly out), and the "knocked out" message.
 * Lives at game.statusBar. Reads from game.player.
 */
export class StatusBar extends Entity {
  constructor() {
    super();
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hearts"></div>
      <div class="magic hidden"><div class="magic-fill"></div><div class="magic-ticks"></div></div>
      <div class="hud-row">
        <div class="pill coins"><span class="coin"></span><span class="coin-count">0</span></div>
        <div class="pill fame" title="Fame: help people to win back your name"><span class="fame-star">★</span><span class="fame-count"></span></div>
      </div>
      <div class="buffs"></div>`;
    this.heartsEl = this.el.querySelector('.hearts');
    this.magicEl = this.el.querySelector('.magic');
    this.magicFill = this.el.querySelector('.magic-fill');
    this.magicTicks = this.el.querySelector('.magic-ticks');
    this.coinsEl = this.el.querySelector('.coins');
    this.coinCount = this.el.querySelector('.coin-count');
    this.fameEl = this.el.querySelector('.fame-count');
    this.buffsEl = this.el.querySelector('.buffs');

    this.actionsEl = document.createElement('div');
    this.actionsEl.className = 'actions';

    this.chargeEl = document.createElement('div');
    this.chargeEl.className = 'charge hidden';
    this.chargeEl.innerHTML = '<div class="charge-pips"></div>';

    this.vignetteEl = document.createElement('div');
    this.vignetteEl.className = 'vignette';

    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fade';

    this.defeatEl = document.createElement('div');
    this.defeatEl.className = 'defeated hidden';
    this.defeatEl.innerHTML = '<div class="defeated-title">Knocked out!</div><div class="defeated-sub">Getting back up...</div>';

    document.body.append(this.vignetteEl, this.el, this.actionsEl, this.fadeEl, this.defeatEl, this.chargeEl);
    this.shown = {};
  }

  onAdd(game) {
    game.statusBar = this;
  }

  restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
  }

  hurt() {
    this.restart(this.vignetteEl, 'flash');
    this.restart(this.heartsEl, 'shake');
  }

  healed() {
    this.restart(this.heartsEl, 'glow');
  }

  coinPop() {
    this.restart(this.coinsEl, 'pop');
  }

  needMagic() {
    this.restart(this.magicEl, 'shake');
  }

  /** Quick fade from black (used when going down the trapdoor and back up). */
  fade() {
    this.restart(this.fadeEl, 'go');
  }

  showDefeated(on) {
    this.defeatEl.classList.toggle('hidden', !on);
  }

  update(_dt, game) {
    const p = game.player;
    const hidden = document.body.classList.contains('in-cutscene') || document.body.classList.contains('title-open');
    this.el.classList.toggle('hidden', hidden);
    this.actionsEl.classList.toggle('hidden', hidden);

    // Health: one heart each.
    if (p.health !== this.shown.health || p.maxHealth !== this.shown.maxHealth) {
      if (this.shown.health !== undefined && p.health > this.shown.health) this.healed();
      this.heartsEl.innerHTML = Array.from({ length: p.maxHealth }, (_, i) => `<span class="heart${i < p.health ? '' : ' empty'}">${HEART}</span>`).join('');
    }
    const low = !p.dead && p.health <= 1 && p.maxHealth > 2;
    this.vignetteEl.classList.toggle('low', low);

    // Magic: a bar, with a mark for every Star Burst's worth.
    const magic = p.hasConduit ? Math.floor(p.magic) : null;
    if (magic !== this.shown.magic) {
      this.magicEl.classList.toggle('hidden', magic === null);
      if (magic !== null) {
        this.magicFill.style.width = `${(magic / MAGIC.max) * 100}%`;
        this.magicEl.classList.toggle('ready', magic >= MAGIC.burstCost);
        if (this.shown.magic === undefined || this.shown.magic === null) {
          this.magicTicks.innerHTML = Array.from({ length: MAGIC.max / MAGIC.burstCost - 1 }, () => '<span></span>').join('');
        }
      }
    }

    if (p.coins !== this.shown.coins) {
      this.coinCount.textContent = p.coins;
      if (this.shown.coins !== undefined && p.coins > this.shown.coins) this.coinPop();
    }
    if (p.fame !== this.shown.fame) this.fameEl.textContent = p.fame < FAME.needed ? `${p.fame} / ${FAME.needed}` : `${p.fame}`;

    // Buffs from Barrett, Grayson and Pip, with the time they have left.
    const left = (s) => (s >= 60 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s)}s`);
    const buffs = Object.entries(p.buffs).map(([id, s]) => `<span class="pill small" title="${BUFFS[id].name}">${BUFFS[id].icon} ${left(s)}</span>`).join('');
    if (buffs !== this.shown.buffs) this.buffsEl.innerHTML = buffs;

    this.updateActions(game);
    this.updateCharge(game);
    this.shown = { health: p.health, maxHealth: p.maxHealth, magic, coins: p.coins, fame: p.fame, buffs };
  }

  /** The action bar: what you can do, and with which key. */
  updateActions(game) {
    const p = game.player;
    const key = (action) => keyName(game.input.bindings[action]?.[0] ?? '?');
    const slots = [];
    const slot = (id, icon, label, action, { off = false, badge = '', hot = false, cooldown = 0 } = {}) =>
      slots.push(
        `<div class="slot${off ? ' off' : ''}${hot ? ' hot' : ''}" data-id="${id}"><div class="slot-icon">${icon}</div>${badge ? `<span class="badge">${badge}</span>` : ''}${
          cooldown > 0 ? `<div class="cooldown" style="--cd:${cooldown}"></div>` : ''
        }<kbd>${key(action)}</kbd><div class="slot-label">${label}</div></div>`,
      );
    slot('roll', icon('roll'), p.hasDreamDash ? 'Dash' : 'Roll', 'dodge', { off: p.swimming || p.dodgeCooldown > 0 || p.rolling });
    slot('sword', icon('sword'), p.knowsSpin ? 'Sword · hold' : 'Sword', 'swing', { hot: p.counterTimer > 0 });
    if (p.hasShield) slot('shield', icon('shield'), 'Block', 'shield', { off: p.swimming, hot: p.shielding });
    if (p.hasBow) slot('bow', icon('bow'), p.bowTier >= 1 ? 'Bow · hold' : 'Bow', 'bow', { hot: p.drawing });
    if (p.hasConduit) {
      slot('burst', icon('burst'), 'Star Burst', 'power', {
        off: p.magic < MAGIC.burstCost,
        cooldown: Math.round((p.burstCooldown / DREAM.burstCooldown) * 20) / 20,
        hot: p.shieldHits > 0,
      });
    }
    if (p.food.length) {
      const next = FOOD.menu.find((f) => f.id === p.food[0]);
      slot('food', icon(next?.id ?? 'apple'), 'Eat', 'eat', { badge: p.food.length, off: p.health >= p.maxHealth });
    }
    const html = slots.join('');
    if (html !== this.shownActions) {
      this.actionsEl.innerHTML = html;
      this.shownActions = html;
    }
  }

  /** The power bow's charge: one pip per point of damage. */
  updateCharge(game) {
    const p = game.player;
    const charging = p.drawing && p.bowTier >= 1;
    this.chargeEl.classList.toggle('hidden', !charging);
    if (!charging) return;
    const dmg = p.charge >= BOW.drawTime ? p.arrowDamage : 0;
    if (dmg === this.shownCharge) return;
    this.shownCharge = dmg;
    this.chargeEl.querySelector('.charge-pips').innerHTML = Array.from({ length: BOW.maxDamage }, (_, i) => `<span class="${i < dmg ? 'on' : ''}"></span>`).join('');
  }
}
