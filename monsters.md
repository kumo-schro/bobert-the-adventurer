# Monsters

Every monster's stats in one place. To change a monster:

- **Change a number** in a Value column, or
- **Write a note** under a monster's **Notes** (for example "reduce knockback" or "make it jump").

Then ask Claude to "update the monsters from monsters.md". Claude changes the game to match, and marks each note as done.

Some things to know about the numbers:

- **Damage** is how much health one hit takes from you (you start with 5). At night every monster does 1 more.
- **Speed** is in blocks per second. You walk at 6, run at 11 and swim at 4.5. At night monsters move 20% faster.
- **Notices you at** is how close you can get before it comes after you. Once it's after you, it keeps following until you're 30 blocks away.
- **Times between attacks** are the real times in the game. They already include "enemies attack 25% faster" (`MONSTERS.attackSpeed` in `src/config.js`).

## All monsters

These apply to every monster unless a monster below says otherwise.

| Stat | Value | Code |
| --- | --- | --- |
| Knockback when you hit a monster | 7 | `Monster.js`, `hit()` |
| Knockback when a monster hits you | 9 | `Player.js`, `takeDamage()` |
| Time before touching you hurts again | 0.8 s | `Monster.js`, `CONTACT_COOLDOWN` |
| Gives up chasing at | 30 | `Monster.js`, `GIVE_UP_DISTANCE` |
| Speed at night | ×1.2 | `Monster.js`, `NIGHT_SPEED` |
| Extra damage at night | +1 | `Monster.js`, `NIGHT_DAMAGE` |
| Attack speed | ×1.25 | `config.js`, `MONSTERS.attackSpeed` |

Notes:

-

## The village and the cave

### Gelationus Slime (the merchant's quest boss)

`src/entities/Slime.js`, `Slime.boss()`

| Stat | Value | Code |
| --- | --- | --- |
| Health | 10 | `config.js`, `QUEST.slimeHealth` |
| Damage | 1 | Monster default |
| Coins | 0 (you get 100 from the quest) | `Slime.boss()`, `config.js` `QUEST.rewardCoins` |
| Hop speed | 3.2 | `HOP_SPEED` (times a size factor) |
| Notices you at | 11 | `chaseRange` in `Slime.boss()` |
| Size | 0.7 | `size` in `Slime.boss()` |

Notes:

-

### Spider (in the cave)

`src/entities/Spider.js`

| Stat | Value | Code |
| --- | --- | --- |
| Health | 2 | `health` in the constructor |
| Damage | 1 | Monster default |
| Coins | 4 | `coins` in the constructor |
| Speed | 2.3 | `SPEED` |
| Notices you at | 8 | `CHASE_RANGE` |

Notes:

-

### Blue slimes (the farmer's slime hunt)

`src/quest/sideQuests.js`, `SlimeHuntQuest`

| Stat | Value | Code |
| --- | --- | --- |
| Health | 3 | `health` in `onStart()` |
| Damage | 1 | Monster default |
| Coins | 3 | `coins` in `onStart()` |
| Hop speed | about 2.4 | `Slime.js` `HOP_SPEED`, and `size` 0.38 |
| Notices you at | 10 | `chaseRange` in `onStart()` |

Notes:

-

## The sea

### Shark

`src/entities/Shark.js`. There are 18 (`SEA.sharks` in `config.js`).

| Stat | Value | Code |
| --- | --- | --- |
| Health | 3 | `health` in the constructor |
| Damage | 1 | `damage` in the constructor |
| Coins | 5 | `coins` in the constructor |
| Swimming speed | 1.8 | `PATROL_SPEED` |
| Chasing speed | 2.9 | `CHASE_SPEED` |
| Notices you at | 13 | `CHASE_RANGE` |
| Swims away after biting for | 1.2 s | `attackTime(1.5)` |

Notes:

-

### Eel

`src/entities/Eel.js`, `KINDS.eel`. Two live by the tower island.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 5 | `health` |
| Damage | 3 | `damage` |
| Coins | 8 | `coins` |
| Swimming speed | 2 | `swim` |
| Lunge speed | 5 | `lunge` |
| Lunges when you're within | 3.5 | `3.5 * scale` in `think()` |
| Time between lunges | 1.6 s | `attackTime(2)` |
| Notices you at | 7 | `notice` |

Notes:

-

### Sea Serpent

`src/entities/Eel.js`, `KINDS.serpent`. A big, fast eel. Beat it or the Kraken for the key.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 10 | `health` |
| Damage | 3 | `damage` |
| Coins | 25 | `coins` |
| Swimming speed | 4 | `swim` |
| Lunge speed | 7 | `lunge` |
| Lunges when you're within | 7 | `3.5 * scale` |
| Time between lunges | 1.6 s | `attackTime(2)` |
| Notices you at | 16 | `notice` |
| Size | 2 | `scale` |

Notes:

-

### Kraken

`src/entities/Kraken.js`. It doesn't hurt by touching you: it slams a tentacle down where you are.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 10 | `health` in the constructor |
| Damage | 5 | `damage` in the constructor |
| Coins | 30 | `coins` in the constructor |
| Speed | 1.2 | `DRIFT_SPEED` |
| Notices you at | 20 | `NOTICE_RANGE` |
| Slams when you're within | 7 | `SLAM_RANGE` |
| Slam hits everything within | 2.4 | `SLAM_RADIUS` |
| Warning before the slam | 1.3 s | `WARNING_TIME` |
| Time between slams | 1.8 s | `SLAM_COOLDOWN` |

Notes:

-

### Gargoyle

`src/entities/Gargoyle.js`. Very weak, but there are several on the tower.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 1 | `health` in the constructor |
| Damage | 1 | `damage` in the constructor |
| Coins | 2 | `coins` in the constructor |
| Flying speed | 3.2 | `FLY_SPEED` |
| Wakes up when you're within | 9 | `WAKE_RANGE` |
| Flies back after hitting you for | 1 s | `attackTime(1.2)` |

Notes:

-

### Charibdis

`src/entities/Charibdis.js`. Most of its numbers are in `CHARIBDIS` in `src/config.js`.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 30 | `health` |
| Whirlpool damage | 5 every 3 s | `damage`, `tickSeconds` |
| Whirlpool size | 6 | `whirlpoolRadius` |
| Whirlpool on, then off | 5 s, then 9 s | `onSeconds`, `offSeconds` |
| Whirlpool pull | 2.2 | `pull` |
| Can only be hurt while the whirlpool is off | yes | `shieldedWhileSpinning` |
| Bite damage | 3 | `biteDamage` |
| Bites when you're within | 4.8 | `biteRange` |
| Warning before a bite | 0.9 s | `biteWindup` |
| Time between bites | 1.8 s | `biteCooldown` (sped up) |
| Water ball damage | 1 | `spitDamage` |
| Spits a water ball every | 1.6 s | `spitEvery` (sped up) |
| Spits at you from up to | 22 | `spitRange` |
| Calls sharks and eels for help | no | `summonsHelpers`, `maxHelpers` |
| Coins | 50 | `coins` in `Charibdis.js` |
| Wakes up when you're within | 16 | `WAKE_RANGE` in `Charibdis.js` |

Notes:

-

## The jungle

### Venus Flytrap

`src/entities/JungleMonsters.js`, `FlyTrap`. There are 6. It can't move.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 1 | `health` in the constructor |
| Damage | 5 | `damage` in the constructor |
| Coins | 6 | `coins` in the constructor |
| Opens its mouth when you're within | 5 | `TRAP_NOTICE` |
| Bite reaches | 2.8 | `TRAP_BITE_RANGE` |
| Mouth stays open before it snaps | 1.4 s | `TRAP_WINDUP` |
| Time between bites | 1.9 s | `TRAP_COOLDOWN` |

Notes:

-

### Snake

`src/entities/JungleMonsters.js`, `Snake`. There are 8.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 2 | `health` in the constructor |
| Damage | 1 | `damage` in the constructor |
| Coins | 3 | `coins` in the constructor |
| Speed | 2.6 | `speed` in `think()` |
| Notices you at | 9 | `chasing(toPlayer, 9, ...)` |

Notes:

-

### Gorilla

`src/entities/JungleMonsters.js`, `Gorilla`. There are 3.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 4 | `health` in the constructor |
| Damage | 2 | `damage` in the constructor |
| Coins | 8 | `coins` in the constructor |
| Speed | 2.4 | `speed` in `think()` |
| Notices you at | 10 | `chasing(toPlayer, 10, ...)` |

Notes:

-

### Poison Dart Frog

`src/entities/JungleMonsters.js`, `Frog`. There are 5.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 2 | `health` in the constructor |
| Damage | 1 | `damage` in the constructor |
| Coins | 2 | `coins` in the constructor |
| Hop speed | 3.2 | `velocity.set(dirX * 3.2, ...)` in `think()` |
| Time between hops while chasing | 0.9 s | `hopTimer` in `think()` |
| Notices you at | 8 | `chasing(toPlayer, 8, ...)` |

Notes:

-

### Panther

`src/entities/JungleMonsters.js`, `Panther`. There are 3.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 3 | `health` in the constructor |
| Damage | 2 | `damage` in the constructor |
| Coins | 6 | `coins` in the constructor |
| Speed | 3.4 | `speed` in `think()` |
| Notices you at | 11 | `chasing(toPlayer, 11, ...)` |

Notes:

-

### Master Oak (in the duel)

`src/entities/JungleMonsters.js`, `OakFighter`. He doesn't flinch or get knocked back.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 8 | `health` in the constructor |
| Spin damage | 10 | `damage` in the constructor |
| Spin reaches | 3.2 | `OAK_SPIN_REACH` |
| Spin lasts | 0.8 s | `OAK_SPIN_TIME` |
| Time to charge the next spin | 2.4 s | `OAK_CHARGE_TIME` |
| Walking speed | 1.5 | `speed` in `think()` |

Notes:

-

### The Vine (jungle boss)

`src/entities/JungleMonsters.js`, `Vine`. It's rooted in place and slams its arms down where you are.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 50 | `health` in the constructor |
| Damage | 5 | `damage` in the constructor |
| Coins | 80 | `coins` in the constructor |
| Wakes up when you're within | 20 | `chasing(toPlayer, 20, ...)` |
| Slam hits everything within | 2.4 | `CircleGeometry(2.4)` and `< 2.4` |
| Warning before a slam | 1.3 s | `timer: 1.3` |
| Time between slams | 1.3 s | `attackTime(1.6)` |
| Most slams at once | 2 | `this.slams.length < 2` |

Notes:

-

## The dream dimension

### Wisp

`src/entities/Wisp.js`. Wandering wisps give dream points (`DREAM` in `config.js`).

| Stat | Value | Code |
| --- | --- | --- |
| Health | 2 | `health` in the constructor |
| Damage | 1 | `damage` in the constructor |
| Floating speed | 2.6 | `FLOAT_SPEED` |
| Notices you at | 10 | `NOTICE` |
| Dream points | 1 | `DREAM.wispDreamPoints` |
| Floats back after | 25 s | `DREAM.wispRespawn` |

Notes:

-
