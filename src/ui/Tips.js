import { Entity } from '../core/Entity.js';
import { keyName } from '../controls.js';

const STORAGE_KEY = 'bobert-tips-seen';

/**
 * Gentle how-to-play tips, each shown once (remembered in the browser) at the moment it's useful:
 * how to move when you first get control, how to fight when a monster first spots you, how to
 * eat and so on. Each tip is { id, when(game) -> true when it's time, text(key, touch) }
 * (touch: true on a touch screen, which has buttons instead of keys).
 */
const TIPS = [
  {
    id: 'move',
    when: (g) => g.elapsed > 1.5,
    text: (k, touch) => (touch ? 'Move with the stick, and drag anywhere to look around.' : `Move with ${k('forward')}${k('left')}${k('back')}${k('right')}, and drag the mouse to look around.`),
  },
  { id: 'quest', when: (g) => g.elapsed > 9 && g.questLog.entries.size > 0, text: () => 'Your quest is in the top right. Follow its arrow!' },
  {
    id: 'fight',
    when: (g) => g.monsters.some((m) => m.aggro),
    text: (k, touch) => (touch ? 'A monster! Tap the sword to swing, and the swirl to roll out of the way.' : `A monster! ${k('swing')} (or click) swings your sword. ${k('dodge')} rolls out of the way.`),
  },
  { id: 'hurt', when: (g) => g.player.health < g.player.maxHealth && g.player.food.length > 0, text: (k, touch) => (touch ? 'Hurt? Tap the apple to eat.' : `Hurt? Press ${k('eat')} to eat some food.`) },
  { id: 'shield', when: (g) => g.player.hasShield, text: (k, touch) => `${touch ? 'Hold the shield button' : `Hold ${k('shield')}`} to block attacks with your shield.` },
  { id: 'bow', when: (g) => g.player.hasBow, text: (k, touch) => `${touch ? 'Tap the bow' : `Press ${k('bow')}`} to shoot at the nearest monster in front of you.` },
  { id: 'burst', when: (g) => g.player.hasConduit, text: (k, touch) => `${touch ? 'Tap the star' : `Press ${k('power')}`} for a Star Burst! Defeat monsters to fill your magic.` },
  { id: 'pause', when: (g) => g.elapsed > 150, text: (k, touch) => `${touch ? 'Tap pause' : 'Press Esc'} any time to pause, save your game or change things.` },
];

export class Tips extends Entity {
  constructor() {
    super();
    try {
      this.seen = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
    } catch {
      this.seen = new Set();
    }
    this.cooldown = 0;
  }

  update(dt, game) {
    this.cooldown -= dt;
    if (this.cooldown > 0 || game.isUiOpen() || game.player.dead || document.body.classList.contains('title-open')) return;
    const tip = TIPS.find((t) => !this.seen.has(t.id) && t.when(game));
    if (!tip) return;
    const key = (action) => `${keyName(game.input.bindings[action]?.[0] ?? '?')}`;
    game.questLog.toast(tip.text(key, document.body.classList.contains('touch')), { seconds: 6, icon: '💡' });
    this.seen.add(tip.id);
    this.cooldown = 7; // one at a time
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen]));
    } catch {
      // storage blocked: tips may show again next time
    }
  }
}
