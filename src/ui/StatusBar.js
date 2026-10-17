import { Entity } from '../core/Entity.js';
import { FOOD, BUFFS, MAGIC, FAME } from '../config.js';
import { keyName } from '../controls.js';

/**
 * Hearts (health, plus golden extra hearts), HP number, coins, wood and stone, arrows and
 * carried food in the top-left corner; a charge meter while drawing the power bow; a red flash
 * when you get hurt, and the "knocked out" message. Lives at game.statusBar. Reads from game.player.
 */
export class StatusBar extends Entity {
  constructor() {
    super();
    this.el = document.createElement('div');
    this.el.className = 'status';
    this.el.innerHTML = `
      <div class="hearts"></div>
      <div class="hp"></div>
      <div class="status-coins"><span class="coin"></span><span class="coin-count">0</span></div>
      <div class="status-fame" title="Fame: help people to win back your name"></div>
      <div class="status-materials hidden"></div>
      <div class="status-arrows hidden"></div>
      <div class="status-dream hidden"></div>
      <div class="status-buffs hidden"></div>
      <div class="status-food hidden"></div>`;
    this.heartsEl = this.el.querySelector('.hearts');
    this.hpEl = this.el.querySelector('.hp');
    this.coinsEl = this.el.querySelector('.coin-count');
    this.fameEl = this.el.querySelector('.status-fame');
    this.foodEl = this.el.querySelector('.status-food');
    this.arrowsEl = this.el.querySelector('.status-arrows');
    this.materialsEl = this.el.querySelector('.status-materials');
    this.dreamEl = this.el.querySelector('.status-dream');
    this.buffsEl = this.el.querySelector('.status-buffs');

    this.chargeEl = document.createElement('div');
    this.chargeEl.className = 'charge hidden';
    this.chargeEl.innerHTML = '<div class="charge-label"></div><div class="charge-pips"></div>';

    this.flashEl = document.createElement('div');
    this.flashEl.className = 'hurt-flash';

    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fade';

    this.defeatEl = document.createElement('div');
    this.defeatEl.className = 'defeated hidden';
    this.defeatEl.innerHTML = '<div>Oof! You were knocked out!</div><small>Heading back to the village...</small>';

    document.body.append(this.el, this.flashEl, this.fadeEl, this.defeatEl, this.chargeEl);
    this.shown = {};
  }

  onAdd(game) {
    game.statusBar = this;
  }

  hurt() {
    this.flashEl.classList.remove('flash');
    void this.flashEl.offsetWidth; // restart the animation
    this.flashEl.classList.add('flash');
    this.heartsEl.classList.remove('shake');
    void this.heartsEl.offsetWidth;
    this.heartsEl.classList.add('shake');
  }

  /** Quick fade from black (used when going down the trapdoor and back up). */
  fade() {
    this.fadeEl.classList.remove('go');
    void this.fadeEl.offsetWidth;
    this.fadeEl.classList.add('go');
  }

  showDefeated(on) {
    this.defeatEl.classList.toggle('hidden', !on);
  }

  update(_dt, game) {
    const { health, maxHealth, coins, tempHealth, wood, stone } = game.player;
    if (health !== this.shown.health || maxHealth !== this.shown.maxHealth || tempHealth !== this.shown.tempHealth) {
      this.heartsEl.innerHTML =
        Array.from({ length: maxHealth }, (_, i) => `<span class="heart${i < health ? '' : ' empty'}"></span>`).join('') +
        Array.from({ length: tempHealth }, () => '<span class="heart golden"></span>').join('');
      this.hpEl.textContent = `HP ${health}/${maxHealth}${tempHealth ? ` +${tempHealth}` : ''}`;
    }
    const materials = `${wood},${stone}`;
    if (materials !== this.shown.materials) {
      this.materialsEl.textContent = `🪵 ${wood}  🪨 ${stone}`;
      this.materialsEl.classList.toggle('hidden', !wood && !stone && !game.player.hasAxe && !game.player.hasPickaxe);
    }

    // Power bow charge meter: one pip per point of damage.
    const charging = game.player.drawing && game.player.bowTier >= 1;
    this.chargeEl.classList.toggle('hidden', !charging);
    if (charging) {
      const dmg = game.player.arrowDamage;
      if (dmg !== this.shown.charge) {
        this.chargeEl.querySelector('.charge-label').textContent = `Power ${dmg}`;
        this.chargeEl.querySelector('.charge-pips').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < dmg ? 'on' : ''}"></span>`).join('');
      }
    }
    // Fame (out of what's needed to be summoned back to Tulane, until you have it).
    const fame = game.player.fame;
    if (fame !== this.shown.fame) {
      this.fameEl.textContent = fame < FAME.needed ? `⭐ ${fame}/${FAME.needed}` : `⭐ ${fame}`;
      this.shown.fame = fame;
    }
    if (coins !== this.shown.coins) {
      this.coinsEl.textContent = coins;
      if (this.shown.coins !== undefined) {
        this.coinsEl.parentElement.classList.remove('pop');
        void this.coinsEl.offsetWidth;
        this.coinsEl.parentElement.classList.add('pop');
      }
    }
    const food = game.player.food.join(',');
    if (food !== this.shown.food) {
      const icons = game.player.food.map((id) => FOOD.menu.find((f) => f.id === id).icon).join('');
      this.foodEl.innerHTML = `<kbd>F</kbd>${icons}`;
      this.foodEl.classList.toggle('hidden', !icons);
    }
    const arrows = game.player.hasBow ? game.player.arrows : -1;
    if (arrows !== this.shown.arrows) {
      this.arrowsEl.innerHTML = `<kbd>K</kbd>🏹 ${arrows}`;
      this.arrowsEl.classList.toggle('hidden', arrows < 0);
      this.arrowsEl.classList.toggle('empty', arrows === 0);
    }
    // Magic points and dream powers (dimmed while they recharge or there isn't enough magic).
    const p = game.player;
    const magic = p.hasConduit ? Math.floor(p.magic) : null;
    const powers = [
      [p.hasDash, p.dashCooldown === 0 && magic >= MAGIC.cost.dash, 'dash', '💨'],
      [p.hasInvisibility, p.invisibleCooldown === 0 && magic >= MAGIC.cost.invisible, 'invisible', '👻'],
      [p.hasDreamHeal, p.healCooldown === 0 && magic >= MAGIC.cost.dreamHeal, 'dreamHeal', '🌈'],
      [p.hasStarShield, p.starShieldCooldown === 0 && p.starShieldHits === 0 && magic >= MAGIC.cost.starShield, 'starShield', '🛡️'],
    ];
    const passive = (has, icon) => (has ? `<span class="${magic > 0 ? '' : 'cooling'}">${icon}</span>` : '');
    const passives = `${passive(p.hasDoubleJump, '🦘')}${passive(p.hasSpeedBoots, '👟')}`;
    const dream = `${magic},${powers.map(([has, ready]) => `${has}${ready}`).join()},${passives}`;
    if (dream !== this.shown.dream) {
      const key = (action) => keyName(game.input.bindings[action][0] ?? '?');
      const power = (has, ready, action, icon) => (has ? `<span class="${ready ? '' : 'cooling'}"><kbd>${key(action)}</kbd>${icon}</span>` : '');
      const meter = magic === null ? '' : `🔮 ${magic}/${MAGIC.max}`;
      this.dreamEl.innerHTML = `${meter} ${powers.map(([has, ready, action, icon]) => power(has, ready, action, icon)).join(' ')} ${passives}`;
      const anyPower = powers.some(([has]) => has) || passives;
      this.dreamEl.classList.toggle('hidden', magic === null && !anyPower);
    }
    // Buffs from Barrett and Grayson, with the minutes (or seconds) they have left.
    const left = (s) => (s >= 60 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s)}s`);
    const buffs = Object.entries(p.buffs).map(([id, s]) => `${BUFFS[id].icon} ${left(s)}`).join('  ');
    if (buffs !== this.shown.buffs) {
      this.buffsEl.textContent = buffs;
      this.buffsEl.classList.toggle('hidden', !buffs);
    }
    this.shown = { fame, health, maxHealth, coins, food, arrows, tempHealth, materials, dream, buffs, charge: charging ? game.player.arrowDamage : null };
  }
}
