import { Quest } from './Quest.js';
import { Slime } from '../entities/Slime.js';
import { Artifact } from '../entities/Artifact.js';
import { QUEST } from '../config.js';
import { MAIN_QUEST, OBJECTIVES, TOASTS } from '../story.js';

/**
 * The merchant's quest: the Gelationus Slime has the village's precious artifact.
 * It lives in the cave inside the mountain. Slay it, grab the artifact, bring it back.
 *
 * The merchant waits at the market stall: walk over and talk to them to get the quest,
 * and come back to them with the artifact.
 */
export class ArtifactQuest extends Quest {
  constructor(game, { cave }) {
    super(game, { id: 'main', title: MAIN_QUEST.title, text: MAIN_QUEST.text, reward: QUEST.rewardCoins });
    this.cave = cave;
  }

  /** Point the quest arrow at the merchant when the game starts. */
  announce() {
    this.setObjective(OBJECTIVES.meet, this.giver);
  }

  onStart() {
    const { game } = this;
    const slime = game.add(Slime.boss(this.cave.bossSpot));
    slime.onDefeated = (where) => this.slimeDefeated(where);
    this.setObjective(OBJECTIVES.slay, slime);
    game.questLog.toast(TOASTS.slimeAppeared);
  }

  slimeDefeated(where) {
    const { game } = this;
    const artifact = game.add(new Artifact(where));
    artifact.onPickup = () => this.readyToTurnIn(TOASTS.artifact);
    this.setObjective(OBJECTIVES.pickup, artifact);
    game.questLog.toast(TOASTS.slimeDefeated);
  }
}
