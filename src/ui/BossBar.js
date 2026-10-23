import { Entity } from '../core/Entity.js';

const SHOW_DISTANCE = 30;

/**
 * A big health bar at the top of the screen while you fight a boss (any monster with a `boss`
 * name): it shows once the boss is after you, or you've hit it, and the lost health drains away
 * a moment after each hit.
 */
export class BossBar extends Entity {
  constructor() {
    super();
    this.el = document.createElement('div');
    this.el.className = 'boss-bar hidden';
    this.el.innerHTML = '<div class="boss-name"></div><div class="boss-track"><div class="boss-trail"></div><div class="boss-fill"></div></div>';
    this.nameEl = this.el.querySelector('.boss-name');
    this.fillEl = this.el.querySelector('.boss-fill');
    this.trailEl = this.el.querySelector('.boss-trail');
    document.body.append(this.el);
    this.boss = null;
    this.trail = 1;
  }

  /** The boss you're fighting right now, if any. */
  findBoss(game) {
    const p = game.player.object3d.position;
    let best = null;
    let bestDist = SHOW_DISTANCE;
    for (const m of game.monsters) {
      if (!m.boss || m.health <= 0 || !m.object3d.visible) continue;
      const d = m.object3d.position.distanceTo(p);
      const engaged = m.aggro || m.awake || (m.lastHitAt !== undefined && game.elapsed - m.lastHitAt < 15) || d < 16;
      if (engaged && d < bestDist) {
        best = m;
        bestDist = d;
      }
    }
    return best;
  }

  onAdd(game) {
    game.bossBar = this;
  }

  update(dt, game) {
    const boss = game.player.dead ? null : this.findBoss(game);
    if (boss !== this.boss) {
      this.boss = boss;
      this.trail = boss ? Math.max(0, boss.health / boss.maxHealth) : 1;
      if (boss) {
        this.nameEl.textContent = boss.boss;
        this.el.classList.remove('hidden', 'enter');
        void this.el.offsetWidth;
        this.el.classList.add('enter');
      } else this.el.classList.add('hidden');
    }
    if (document.body.classList.contains('in-cutscene')) this.el.classList.add('hidden');
    document.body.classList.toggle('boss-fight', !!boss);
    if (!boss) return;
    const fraction = Math.max(0, boss.health / boss.maxHealth);
    // The trail waits a moment, then drains down to the real health.
    if (fraction < this.trail) {
      this.drainDelay = this.lastFraction !== fraction ? 0.5 : (this.drainDelay ?? 0) - dt;
      if (this.drainDelay <= 0) this.trail = Math.max(fraction, this.trail - dt * 0.6);
    } else this.trail = fraction;
    this.lastFraction = fraction;
    this.fillEl.style.width = `${fraction * 100}%`;
    this.trailEl.style.width = `${this.trail * 100}%`;
  }
}
