# Voxel Meadow

A colorful voxel-style single-player web game built with [Three.js](https://threejs.org) and [Vite](https://vite.dev).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

**Controls** (change any of them in-game by pressing **Command**): WASD / arrow keys move (and swim), Space jumps, Shift runs, **Return** (or left click) swings your sword in a wide sideways slash, hold **J** to block with a shield, **K** shoots the bow (hold it to charge the power bow), **F** eats food, **T** talks / opens / chops / mines / uses doors, Enter/Space/click advances dialog. Camera: drag with the left or right mouse button, **Q/E** turn, **R/G** tilt, **C** swings round behind you, scroll or **-/=** zoom. Press **Option** to show or hide the quest panel and the controls list.

**The game so far** (see `theme.md`):
- You start in a stone village on a big, not-quite-round island with a sword (no shield) and 5 hearts. Lose all your hearts and you wake up back in the village. Hearts slowly come back if you stay out of trouble.
- The merchant waits at the market stall with the main quest: slay the Gelationus Slime (10 hits) in the mountain cave and bring back the artifact. **Nobody gives you side quests until you've done this.**
- Every two minutes the world goes through a day and night. At night everyone in town (shopkeepers and the merchant too) goes home to bed, and monsters get stronger (1 more damage, 20% faster).
- Monsters that notice you keep following you until you get far away.
- Side quests, with new ones over time (about a minute after finishing one): Pip (6 gems, then 5 seashells on the beaches), Bram (5 blue slimes, then 10 wood for his fence), Elda (6 rainbow stones in order, then backwards), Tomas (8 stone for the well).
- **Wood and stone:** buy an axe and a pickaxe at the forge, then press T next to a tree to chop wood or next to a boulder to mine stone. Each gives 3, then rests for a minute.
- **The forge** sells a Shield (25), Bow (40, with 10 arrows), 10 Arrows (20, quiver holds 100), Axe (10) and Pickaxe (10), plus upgrades that cost coins + wood + stone: Knight's Sword, Power Bow (hold K: +1 damage per 2 seconds, up to 5), Iron Shield, Knight Armor (+2 hearts).
- **Hana's bakery** sells apples (2), bread (4) and berry pie (15). Upgrade her oven with wood and stone for special food that also gives golden extra hearts (they go away when you get hit). Carry up to 5; press F to eat.
- **The sea:** walk off the dock (at the end of the road from town) to swim. Lots of sharks, a few eels, little islands to rest on, and a huge tower guarded by gargoyles with the mystery crystal on top (Captain Finn's quest).
- The crystal opens the trapdoor by the road, down to Old Man Keegan: defeat the Kraken or the Sea Serpent for the key, then slay Charibdis in its big flooded sea cave (whirlpool: 5 hearts every 3 seconds; on for 10 seconds, off for 30, then it calls 3 sharks or an eel).
- Then Captain Finn takes you to **the jungle island**: giant Venus fly traps (they can't move and bite slowly, but a bite is 5 hearts; one hit defeats them), snakes, gorillas, and a temple with treasure. Talk to Finn on the jungle beach to go home.

## How it's organized

```
src/
  main.js              Builds the world: adds every entity and character to the game
  config.js            Tweakable settings (sizes, counts, health, prices, places, camera)
  story.js             Everything characters say
  shops.js             What each shop sells (forge, bakery)
  controls.js          Every control and its default keys (players can change them)
  core/
    Game.js            Renderer, scene, camera, main loop, entity list
    Entity.js          Base class for everything in the world
    Input.js           Keyboard + mouse state (game.input)
    VoxelBuilder.js    Turns lots of colored boxes into one fast mesh
    textures.js        Generated pixel textures (bark, leaves, stone, grass, sand, dirt, planks,
                       blocks) + textured voxel materials
    collision.js       Circle, box and grid colliders, pushOut() and colliderAt()
  world/               Scenery: Sky, Lighting, Ground, Water, Mountains, Clouds, Village,
                       Cave (mountain + tunnels), StoneCircle (puzzle), Forest, Flowers,
                       Dock (where you jump in to swim), Road (town to dock), TowerIsland (tower +
                       spiral stairs), SmallIsland, CharibdisCave (locked sea cave), Cellar
                       (Keegan's room under the trapdoor), DayNight (lighting cycle),
                       Gathering (trees and boulders for wood and stone), Jungle (the jungle island)
  entities/            Player, Npc (townsfolk), Monster (base) -> Slime, Spider, Shark, Eel (and
                       the sea serpent), Kraken, Gargoyle, Charibdis, JungleMonsters (FlyTrap,
                       Snake, Gorilla); Arrow, Trapdoor, Chest,
                       Collectible, Artifact, Particles, Butterflies, CameraRig
  quest/               Quest (base, with `requires` / `after` for quest chains), ArtifactQuest (main),
                       sideQuests (find things, hunt, puzzle, deliveries, crystal, Charibdis, jungle)
  models/              Voxel model recipes: trees, buildings, character, people (outfits), gear
  ui/                  Dialog (+ "Press T" prompts), QuestLog, StatusBar (hearts/coins/food), Shop,
                       ControlsMenu (Command to change keys, Option to show panels)
  utils/               Seeded random, noise, color helpers
```

## Adding something new

Everything in the world is an `Entity`. Make a class, put its visuals in `this.object3d`, and add it in `main.js`:

```js
// src/entities/Bunny.js
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';

export class Bunny extends Entity {
  constructor(x, z) {
    super();
    const b = new VoxelBuilder();
    b.box(0, 0.3, 0, 0.6, 0.5, 0.8, '#ffffff');   // body
    b.box(0, 0.7, 0.35, 0.4, 0.4, 0.4, '#ffffff'); // head
    b.box(-0.1, 1.1, 0.35, 0.1, 0.4, 0.1, '#ffc0cb'); // ears
    b.box(0.1, 1.1, 0.35, 0.1, 0.4, 0.1, '#ffc0cb');
    this.object3d.add(b.build());
    this.object3d.position.set(x, 0, z);
  }

  update(dt, game) {
    // Hop!
    this.object3d.position.y = Math.abs(Math.sin(game.elapsed * 4)) * 0.5;
  }
}

// src/main.js
game.add(new Bunny(3, 3));
```

Useful things on `game` inside `onAdd(game)` / `update(dt, game)`:

| Property | What it's for |
| --- | --- |
| `game.input` | `held('shield')`, `hit('swing')`, `axisOf('left', 'right')` for controls (see `controls.js`); `isDown('KeyF')` / `wasPressed('Escape')` for raw keys; `drag`, `wheel`, `clicked` |
| `game.elapsed` | Seconds since the game started (great for animation) |
| `game.player` | `health`, `coins`, `addCoins(n)`, `takeDamage(game, n, fromX, fromZ)`, `strike`, `swimming`, `food` |
| `game.terrain` | The island: `isGrass(x, z)`, `isInside(x, z)`, `radius` |
| `game.lands` | Other walkable places (dock, tower island): push `{ isInside(x, z, margin), heightAt(x, z) }` |
| `game.heightAt(x, z)` / `game.isWalkable(x, z)` | Ground height (stairs, dock...) and whether you can stand there |
| `game.monsters` | Every monster in the world |
| `game.dayNight` | `daylight` (1 noon, 0 night), `isNight`, `time` (0..1 through the day) |
| `game.teleport(x, z)` | Move the player somewhere instantly (with a fade) |
| `game.colliders` | Push `{ x, z, radius }`, `{ x, z, halfX, halfZ }` or `{ isSolid(ix, iz) }` to make something solid |
| `game.reservedAreas` | Push `{ x, z, radius }` to keep trees and flowers from spawning there |
| `game.dialog` | `show(name, pages, { focus, onClose })`, `offerInteraction(text, distance, action)` |
| `game.questLog` | `set(id, { title, objective, target })`, `complete(id)`, `toast(text)` |
| `game.cameraBlockers` | Push meshes the camera should zoom in front of instead of clipping through |
| `game.add(e)` / `game.remove(e)` | Spawn and despawn entities at any time |

Other easy changes:

- **New monster:** extend `Monster` (see `Spider.js`, `Shark.js` for a sea monster with `aquatic: true`, or `Gargoyle.js` for a flyer with `flying: true`): build a model in `this.body`, set `this.velocity` in `think()`. Health, sword and arrow hits, damage and coin drops are handled for you.
- **New villager:** add an entry to the `villagers` list in `main.js` (pick a look from `models/people.js`) with either `lines` to say or `quests: [...]` (given one after another; use `after` and `delay` on a quest to make it wait).
- **New control:** add it to `ACTIONS` in `controls.js` and read it with `game.input.hit('yourAction')`.
- **New side quest:** extend `Quest` (see `quest/sideQuests.js`) and put its lines in `story.js`.
- **Change the cave:** edit the ASCII `MAP` at the top of `world/Cave.js` (`C` chest, `S` spider, `t` torch...).
- **New shop item:** add an entry to a list in `shops.js` (food goes in `FOOD.menu` in `config.js`).
- **New building:** add a recipe to `src/models/buildings.js` and `place()` it in `Village.js`.
- **New tree kind:** add a function to `src/models/trees.js` and list it in `TREE_KINDS`.
- **Different look:** edit colors in `config.js`, `Ground.js` (`GRASS`, `SAND`), and `Mountains.js` (`BANDS`).
- **New world layout:** change `SEED` in `config.js`.
