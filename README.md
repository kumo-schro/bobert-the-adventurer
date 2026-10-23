# Bobert the Adventurer

A colorful voxel adventure game for the web built with [Three.js](https://threejs.org) and [Vite](https://vite.dev).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

**Controls** (every key can be changed in the pause menu): WASD / arrow keys move (and swim), **Space** jumps, **Shift** rolls (you can't be hurt mid-roll; keep holding it to run), **Return** or left click swings the sword (tap again for a three-hit combo; once Master Oak teaches you, hold it for a spin attack, or swing in mid-air for a Sky Strike), hold **J** to block with a shield, **K** shoots the bow (hold it to charge the power bow), **L** is the Star Burst (once you have a magic conduit), **F** eats food, **T** talks / opens / uses. **Tab** shows all your quests, **Esc** is the pause menu (save and load, customize Bobert, controls, sound, suggest a change, and how to play). Shortcuts: **P** customize, **M** sound, **/** suggest a change, **`** debug menu. Camera: drag with the left or right mouse button, **Q/E** turn, **R/G** tilt, **C** swings round behind you, scroll or **-/=** zoom. Where you go never moves the camera by itself: walls, houses and cave rock in the way turn see-through instead.

**Feel:** swings turn you toward the nearest monster in front of you and step you in; hits pause the action for a split second, shake the camera and pop up damage numbers; monsters show a "!" when they spot you; coins (and sometimes health) pop out of defeated monsters and fly to you; bosses get a big health bar at the top of the screen. Most of the numbers are in `PLAYER`, `DODGE`, `DROPS` and `DREAM` in `src/config.js`.

**The story** is in [`story.md`](story.md): a short outline, chapter by chapter. Edit it (add details, change what happens, add chapters) and ask Claude to "update the game from story.md". Feature requests can also go in `theme.md`, one line each.

**Debug menu:** press **`** (the key above Tab) to jump to any chapter of the story (each chapter in `story.md` lists its checkpoint), or use cheats: coins, magic, healing, can't-get-hurt mode, day/night, and teleports. You can also open the game at a checkpoint directly, like `http://localhost:5173/?checkpoint=charibdis`.

**👕 Customize Bobert:** when you start a new adventure for the first time, and any time you press **P** (or pick it in the pause menu), pick Bobert's skin, hair color and style, shirt, trousers and shoes. The look is remembered in the browser and in saved games. The color choices are in `CUSTOMIZE` in `src/config.js`.

**🔊 Sound:** swinging the sword swishes, and hits sound different for monsters (squishy slimes, stony gargoyles), trees, chests and posts (a wooden knock) and rocks and walls (a clink). The sounds are made in code (`src/core/Sound.js`), no sound files. **M** turns them off.

**🎵 Music:** made in code too (`src/core/Music.js`): a bass line, an arpeggio and a little melody whose mood follows where you are (sunny by day, slower at night, floaty in the dream, rolling at sea, quick and tense in a boss fight). Turn it on or off in the pause menu.

**🏰 The story:** the game opens on a title screen (Continue, New adventure, Load). A new adventure starts with an intro in Tulane Kingdom: Bobert is banished after a sword juggling accident and marched to Crestview Village (Esc skips it). Finishing quests wins **fame** (⭐ in the status bar). At 120 fame, Tulane's herald comes for Bobert, and the last boss, King Stuart, waits on his throne. See `story.md`.

**💎 Save points:** there's a glowing save crystal on every island. Walk up to one and it saves straight away, under the name of the adventure you're playing (the first time, it asks for a name).

**💾 Saved games:** press **Esc** and pick **Save & load**, type a name and press Save. Saves are kept in this browser; load or delete them from the same menu. After a big update to the game (`SAVES.version` in `src/config.js`), older saves can't be loaded any more.

**💡 Suggest a change:** press **/** (or pick it in the pause menu), click on anything in the game, and type how you'd like it changed. It's saved with where you were, what you clicked, your quest and a small screenshot. Nothing happens automatically; the ideas are just collected for later:
- Playing locally (`npm run dev`), ideas go straight into `recommendations.json` (screenshots in `recommendations/`).
- On the live site, they're saved to a private Vercel Blob store. Run `npm run recommendations` to download everyone's ideas into `recommendations.json` (it needs `RECOMMENDATIONS_KEY` from `.env.local`; get it with `npx vercel env pull`). Then ask Claude to review them.

## How it's organized

```
src/
  main.js              Builds the world: adds every entity and character to the game
  checkpoints.js       Story checkpoints for the debug menu (match the chapters in story.md)
  config.js            Tweakable settings (sizes, counts, health, prices, places, camera)
  story.js             Everything characters say
  shops.js             What each shop sells (forge, bakery)
  controls.js          Every control and its default keys (players can change them)
  core/
    Game.js            Renderer, scene, camera, main loop, entity list
    Entity.js          Base class for everything in the world
    Input.js           Keyboard + mouse state (game.input)
    Sound.js           Sound effects made in code with Web Audio (game.sound)
    VoxelBuilder.js    Turns lots of colored boxes into one fast mesh
    textures.js        Generated pixel textures (bark, leaves, stone, grass, sand, dirt, planks,
                       blocks) + textured voxel materials
    collision.js       Circle, box and grid colliders, pushOut() and colliderAt()
  world/               Scenery: Sky, Lighting, Ground, Water, Mountains, Clouds, Village,
                       Cave (mountain + tunnels), StoneCircle (puzzle), Forest, Flowers,
                       Dock (where you jump in to swim), Road (town to dock), TowerIsland (tower +
                       spiral stairs), SmallIsland, CharibdisCave (locked sea cave), Cellar
                       (Ward's room under the trapdoor), DayNight (lighting cycle),
                       Gathering (boulders), Jungle (the jungle island), FireIsland (volcano, lava, Velizar's lair), Tulane (the castle: intro and last boss),
                       Underwater (seabed + underwater/dream look), Dream (dream dimension + portal)
  entities/            Player, Npc (townsfolk), Monster (base) -> Slime, Spider, Shark, Eel (and
                       the sea serpent), Kraken, Gargoyle, Charibdis, JungleMonsters (FlyTrap,
                       Snake, Gorilla, Frog, Panther, Vine (the Viniac), OakFighter), JacksonFighter,
                       LavaMonster, Velizar (the dragon), FireMonsters, KingStuart (+ TulaneGuard), SavePoint, Wisp; Boat, Arrow, Trapdoor, Chest,
                       Collectible, Pickup (coins and health that fly to you), Artifact, Particles, Butterflies, CameraRig
  quest/               Quest (base, with `requires` / `after` for quest chains), ArtifactQuest (main),
                       sideQuests (find things, hunt, puzzle, deliveries, crystal, Charibdis, jungle,
                       the masters' duels, the Viniac, dream quests, Velizar)
  saves.js             Saved games in the browser (what's saved, and setting a fresh game up from a save)
  models/              Voxel model recipes: trees, buildings, character, people (outfits), gear
  ui/                  TitleScreen, PauseMenu (Esc), Dialog (+ "Press T" prompts), QuestLog (quest tracker
                       + toasts), StatusBar (health, magic, coins, fame, and the action bar), BossBar,
                       FloatingText (damage numbers), Shop, ControlsMenu, DebugMenu (`), Suggestions
                       (click on something and suggest a change), SaveMenu (saved games), Customizer
                       (P: Bobert's look), Cutscene (the intro and the ending), icons (action bar icons)
api/recommendations.js Vercel Function that saves suggestions (and lets the owner download them)
server/                Code shared by that function and the local dev server (vite.config.js)
scripts/               npm run recommendations: download everyone's suggestions (and build recommendations/index.html)
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
| `game.cameraBlockers` | Push meshes that should turn see-through when they're between the camera and the player |
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
