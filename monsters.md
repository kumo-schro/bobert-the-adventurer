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
| Knockback when you hit a monster | 3.5 for the first two sword swings, 10 for the finisher (and a counter-attack), 9 for a spin, 7 for anything else | `Player.js` `strike`, `Monster.js` `hit()` |
| Can't hurt you by touching you while it's reeling from a hit | 0.35 s (bosses only flinch: 0.1 s, and a quarter of the knockback) | `Monster.js`, `stunTimer` in `hit()` |
| Knockback when a monster hits you | 9 | `Player.js`, `takeDamage()` |
| Time before touching you hurts again | 0.8 s | `Monster.js`, `CONTACT_COOLDOWN` |
| Gives up chasing at | 30 | `Monster.js`, `GIVE_UP_DISTANCE` |
| Speed at night | ×1.2 | `Monster.js`, `NIGHT_SPEED` |
| Extra damage at night | +1 | `Monster.js`, `NIGHT_DAMAGE` |
| Attack speed | ×1.25 | `config.js`, `MONSTERS.attackSpeed` |
| Coins when defeated | health + damage, at least 1 (+2 with Pip's Lucky Crystal) | `Monster.js`, `coinsFor()` |
| Magic points when defeated (with a magic conduit) | (health + damage) / 4, at least 1 | `Monster.js`, `magicPoints()` |

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
| Speed | 3.4 | `speed` in `think()` |
| Notices you at | 11 | `chasing(toPlayer, 11, ...)` |

Notes:

-

### Master Oak (in the duel)

`src/entities/JungleMonsters.js`, `OakFighter`. He doesn't flinch or get knocked back, but every second hit he leaps back out of reach.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 8 | `health` in the constructor |
| Spin damage | 10 | `damage` in the constructor |
| Spin reaches | 3.2 | `OAK_SPIN_REACH` |
| Spin lasts | 0.8 s | `OAK_SPIN_TIME` |
| Start of the spin before the staff can hit (time to roll) | 0.18 s | `OAK_SPIN_WINDUP` |
| Time to charge each spin (even the first) | 2.4 s | `OAK_CHARGE_TIME` |
| Walking speed | 1.5 | `speed` in `think()` |
| Leaps back after every second hit (and his staff gets 40% of a charge) | 9 | `OAK_LEAP` |

Notes:

-

### The Viniac (jungle boss)

`src/entities/JungleMonsters.js`, `Vine`. It's rooted in place and slams its arms down where you are.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 70 | `health` in the constructor |
| Damage | 5 | `damage` in the constructor |
| Wakes up when you're within | 20 | `chasing(toPlayer, 20, ...)` |
| Slam hits everything within | 2.6 | `VINE_SLAM_RADIUS` |
| Warning before a slam | 1.1 s | `VINE_WARNING` |
| Time between slams | 0.6 s | `VINE_SLAM_EVERY` |
| Most slams at once | 3 | `VINE_SLAMS` |

Notes:

-

### Master Jackson (in the duel)

`src/entities/JacksonFighter.js`. He dodges every sword swing, arrow and Sky Strike; only a spin attack hits him. He doesn't flinch, and he keeps out of reach while your spin is charged, so you have to let it go as he darts in to jab.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 6 | `config.js`, `JACKSON.health` |
| Jab damage | 2 | `config.js`, `JACKSON.damage` |
| Coins | 60 (from the quest) | `config.js`, `JACKSON.reward` |
| Circles you at | 2.8 | `CIRCLE_DISTANCE` |
| Circles you at, when your spin is charged (out of its reach) | 5.6 | `WARY_DISTANCE` |
| Circling speed | 2.4 | `CIRCLE_SPEED` |
| Warning before a jab | 0.45 s | `WINDUP` |
| Jab reach | 1.5 | `JAB_REACH` |
| Rests after a jab for | 0.5 s | `RECOVER` |
| Dodge leap speed | 9 | `DODGE_SPEED` |

Notes:

-

## The fire island

### Lava Monster

`src/entities/LavaMonster.js`. Rare: it climbs out of a lava flow when you're near one (`FIRE.lavaMonsters` in `config.js`).

| Stat | Value | Code |
| --- | --- | --- |
| Health | 4 | `health` in the constructor |
| Damage | 2 | `damage` in the constructor |
| Speed | 2.6 | `SPEED` |
| Notices you at | 16 | `CHASE_RANGE` |
| Time to climb out of the lava | 1.4 s | `RISE_TIME` |
| Most at once | 2 | `config.js`, `FIRE.lavaMonsters.most` |
| Climbs out every | 12-28 s | `config.js`, `FIRE.lavaMonsters.every` |

Notes:

-

### Ember Bat

`src/entities/FireMonsters.js`, `EmberBat`. There are 7. It flies, swoops at you, nips, then flies off.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 2 | `health` in the constructor |
| Damage | 1 | `damage` in the constructor |
| Flying speed | 4.5 | `Math.min(4.5, ...)` in `think()` |
| Notices you at | 12 | `chasing(..., 12)` |
| Flies off after biting for | 1.3 s | `attackTime(1.6)` in `bitPlayer()` |

Notes:

-

### Magma Slime

`src/entities/FireMonsters.js`, `MagmaSlime`. There are 8. It hops after you.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 3 | `health` in the constructor |
| Damage | 2 | `damage` in the constructor |
| Hop speed | 3.4 | `velocity.set(dirX * 3.4, ...)` |
| Time between hops while chasing | 0.8 s | `hopTimer` in `think()` |
| Notices you at | 10 | `chasing(toPlayer, 10, ...)` |

Notes:

-

### Obsidian Golem

`src/entities/FireMonsters.js`, `ObsidianGolem`. There are 3. Slow and tough; it pounds the ground around it.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 8 | `health` in the constructor |
| Pound damage | 3 | `damage` in the constructor |
| Pound hits everything within | 2.8 | `POUND_RADIUS` |
| Warning before a pound (red circle) | 0.8 s | `POUND_WINDUP` |
| Time between pounds | 1.8 s | `attackTime(2.2)` |
| Walking speed | 1.4 | `speed` in `think()` |
| Notices you at | 12 | `chasing(toPlayer, 12, ...)` |

Notes:

-

### Velizar (dragon boss)

`src/entities/Velizar.js`. Most numbers are in `VELIZAR` in `src/config.js`. He doesn't leave his lair.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 30 | `health` |
| Flame damage | 4 | `flameDamage` |
| Bite damage (close in front of him) | 2 | `biteDamage` |
| Bite reaches | 3.8 | `biteRange` |
| Warning before a bite (jaws open) | 0.35 s | `BITE_WINDUP` in `Velizar.js` |
| Time between bites | 1.3 s | `BITE_COOLDOWN` |
| Bumping into him | 2 | `damage` |
| Flames reach | 9 | `flameRange` |
| Flame width (half the angle) | 0.55 (about 30°) | `flameWidth` |
| Coins | 200 (from Ani's quest) | `reward` |
| Wakes up when you're within | 20 | `WAKE_RANGE` in `Velizar.js` |
| Walking speed | 1.8 | `WALK_SPEED` |
| Warning before the flames | 1 s | `WINDUP` |
| Flames last | 1.3 s | `BREATH` |
| Catches his breath for | 1.3 s | `attackTime(1.6)` |
| Time between flames | 2.6 s | `BREATH_COOLDOWN` |

Notes:

-

## Tulane Kingdom

### King Stuart (the last boss)

`src/entities/KingStuart.js`. Most numbers are in `KING` in `src/config.js`. His shield blocks hits from the front (spin attacks and Sky Strikes get round it).

| Stat | Value | Code |
| --- | --- | --- |
| Health | 40 | `health` |
| Sword sweep damage | 3 | `damage` |
| Sweep reaches | 3.4 | `sweepRange` |
| Warning before a sweep (red ground) | 0.7 s | `WINDUP` in `KingStuart.js` |
| Rests after a sweep | 1 s | `REST` |
| Time between sweeps | 1.3 s | `attackTime(1.6)` |
| Walking speed | 2.1 | `WALK_SPEED` |
| Shield covers (either side of straight ahead) | 1.2 (about 70°) | `SHIELD_ANGLE` |
| Guards he calls at half health | 2 | `guards` |

Notes:

-

### Tulane Guard

`src/entities/KingStuart.js`, `TulaneGuard`. King Stuart calls them.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 4 | `health` in the constructor |
| Damage | 2 | `damage` in the constructor |
| Speed | 2.5 | `speed` in `think()` |
| Notices you at | 18 | `chasing(toPlayer, 18, ...)` |

Notes:

-

## The dream dimension

### Wisp

`src/entities/Wisp.js`. Like every monster, wisps give magic points when you have a magic conduit.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 2 | `health` in the constructor |
| Damage | 1 | `damage` in the constructor |
| Floating speed | 2.6 | `FLOAT_SPEED` |
| Notices you at | 10 | `NOTICE` |
| Magic points | 1 | `magicPoints()` in `Monster.js` |
| Floats back after | 25 s | `DREAM.wispRespawn` |

Notes:

-

### Thomage, the Nightmare Mage (dream boss)

`src/entities/Thomage.js`. Most numbers are in `THOMAGE` in `src/config.js`. The Dream Keeper's last quest. He floats over the dream hub (too high for a sword) and casts spells; after three spells he sinks to the ground, tired, and you can hit him.

| Stat | Value | Code |
| --- | --- | --- |
| Health | 40 | `health` |
| Star bolt damage | 2 | `damage` |
| Star bolts | 3 in a fan (5 at half health) | `castBolts()` |
| Star bolt speed | 9 | `boltSpeed` |
| Rune circle damage | 2 | `damage` |
| Rune circles | 1 under you + 3 around (5 at half health) | `castRunes()` |
| Warning before a spell (staff glows) | 0.9 s (faster at half health) | `CAST_WINDUP` in `Thomage.js` |
| Warning before a rune erupts | 1.3 s | `RUNE_WARNING` |
| Time between spells | 1.7 s (1.1 s at half health) | `attackTime(2.1)` / `attackTime(1.4)` |
| Spells before he rests | 3 | `SPELLS_BEFORE_REST` |
| Rests on the ground for | 3.6 s | `TIRED_TIME` |
| Floats this high | 4.2 | `HOVER` |
| Wakes up when you're within | 18 | `WAKE_RANGE` |
| Coins | 42 when defeated, plus 200 from the quest | `reward` |

Notes:

-
