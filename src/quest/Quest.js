import { QUEST_LOCKED, COME_BACK_LATER } from '../story.js';

/**
 * Base class for quests. A quest belongs to an Npc (its `giver`) and moves through stages:
 *
 *   offer    -> giver shows "!" — talk to them to accept (calls onStart)
 *   active   -> you're doing it; subclasses call readyToTurnIn() when it's done
 *   turnIn   -> giver shows "?" — talk to them for the reward (or call finish() directly)
 *   complete -> giver says thanks
 *
 * `text` holds the lines for each stage: { offer, active, turnIn, complete } (arrays of pages).
 *
 * A quest can wait before it's offered:
 *   requires: () => true when it may be offered (side quests wait for the merchant's quest)
 *   after: another quest that has to be finished first, `delay` seconds earlier
 *          (villagers give you more quests over time this way)
 */
export class Quest {
  constructor(game, { id, title, text, reward = 0, dreamPoints = 0, seekDistance = 0, requires = null, after = null, delay = 0 }) {
    this.game = game;
    this.dreamPoints = dreamPoints; // a reward in dream points (dream dimension quests)
    this.requires = requires;
    this.after = after;
    this.delay = delay;
    this.completedAt = null;
    this.id = id;
    this.title = title;
    this.text = text;
    this.reward = reward;
    this.seekRange = seekDistance;
    this.stage = 'offer';
    this.giver = null; // set by the Npc
  }

  /** > 0: the giver walks over to you on their own when you're this close. */
  get seekDistance() {
    return this.seekRange;
  }

  /** Can this quest be offered right now? */
  get available() {
    if (this.requires && !this.requires()) return false;
    if (!this.after) return true;
    return this.after.stage === 'complete' && this.game.elapsed - this.after.completedAt >= this.delay;
  }

  /** "!" when there's a quest to give, "?" when it's ready to hand in. */
  get marker() {
    if (this.stage === 'offer') return this.available ? '!' : null;
    if (this.stage === 'turnIn') return '?';
    return null;
  }

  /** What the giver says right now, and what happens when the dialog closes. */
  dialogFor() {
    switch (this.stage) {
      case 'offer':
        if (!this.available) return { pages: this.waitingLines() };
        return { pages: this.text.offer, onClose: () => this.start() };
      case 'turnIn':
        return { pages: this.text.turnIn, onClose: () => this.finish() };
      case 'complete':
        return { pages: this.text.complete };
      default:
        return { pages: this.text.active };
    }
  }

  /** What the giver says before this quest can be offered. */
  waitingLines() {
    if (this.requires && !this.requires()) return this.text.locked ?? QUEST_LOCKED;
    if (this.after && this.after.stage !== 'complete') return this.after.dialogFor().pages;
    return [...(this.after?.text.complete ?? []), ...(this.text.later ?? COME_BACK_LATER)];
  }

  start() {
    this.stage = 'active';
    this.onStart();
  }

  onStart() {}

  /** Update the quest panel line for this quest. */
  setObjective(text, target = null) {
    this.game.questLog.set(this.id, { title: this.title, objective: text, target });
  }

  readyToTurnIn(toast) {
    this.stage = 'turnIn';
    this.setObjective(`Go back to ${this.giver.name}`, this.giver);
    if (toast) this.game.questLog.toast(toast);
  }

  finish() {
    const { game } = this;
    this.stage = 'complete';
    this.completedAt = game.elapsed;
    if (this.reward) {
      game.player.addCoins(this.reward);
      game.questLog.toast(`Quest complete! +${this.reward} gold coins`);
      game.particles?.burst(game.player.object3d.position.clone().setY(2), {
        count: 50,
        colors: ['#ffc93c', '#ffe08a', '#f0a500'],
        speed: 7,
        size: 0.2,
        life: 1.4,
      });
    }
    if (this.dreamPoints) {
      game.player.dreamPoints += this.dreamPoints;
      game.questLog.toast(`Quest complete! +${this.dreamPoints} dream points ✨`);
    }
    game.questLog.complete(this.id);
    this.onFinish();
  }

  onFinish() {}
}
