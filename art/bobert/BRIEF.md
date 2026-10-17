# Bobert art style explorations

Six very different takes on Bobert, to help pick the game's next art direction. Each one is a new
character design in its own art style, not the current Bobert redrawn. They're explorations only:
nothing here is used by the game yet.

| Id | Who Bobert is | Art style |
| --- | --- | --- |
| `plush` | a knitted doll | handmade knitted toy, felt, button eyes |
| `voxel` | the current kid, much finer | micro-voxel (tiny cubes) |
| `robot` | a steampunk robot | polished brass, copper and steam |
| `fox` | a young fox in a dark hooded cloak | moody dark-fantasy picture book |
| `anime` | a manga hero with a red scarf | black-and-white manga ink with one accent color |
| `spirit` | a little forest spirit with a mushroom cap | soft painted fantasy, glowing |

Each style has:

- `concepts/<id>.png`: a Codex concept painting (`tools/gen-concept.sh`). This is the design to follow.
- `styles/<n>_<id>.py`: a Blender script that builds that Bobert and renders him.
  Run it with `/Applications/Blender.app/Contents/MacOS/Blender -b -P art/bobert/styles/<file>.py`.
- `textures/<id>/`: painted textures for that style, made with Codex (`tools/gen-texture.sh`).
- `renders/<id>_hero.png` (3/4 view) and `renders/<id>_turnaround.png` (front, 3/4, side, back).
- `models/<id>.glb`: the model, in case the style is picked.

`archive/` holds earlier takes (toon, clay, wooden toy, storybook ink) that were too similar to each other.

## What every version needs

- Bobert is the hero of a cheerful kids' adventure game, and he carries a sword (or that
  character's version of one). Everything else (species, body, clothes, colors, proportions)
  comes from that style's concept painting.
- Rigged for later animation: legs, arms, head (and tail, if any) as separate parts hanging off
  pivots, standing in a relaxed, confident pose with the arms a little away from the body.
- About 1.6 to 2.2 game units tall (feet at z = 0), facing `-Y`.
- Clearly more detailed than the current in-game model, which is a dozen plain boxes.

## Rules for the scripts

- Use `bobert_lib.py` (`import bobert_lib as b`): `b.reset()`, the shape helpers, `b.mat()`,
  `b.studio()`, `b.render_all()` and `b.export()`. Blender axes: Z up, Bobert faces `-Y`.
- Keep each model under about 60,000 triangles.
- Textures go on with `b.mat(..., image=path)` (box-projected, so no UV unwrapping is needed).
- The script must run headless from start to finish and write the renders and the `.glb`.
- Codex image jobs run one at a time (the tools wait for each other), so start them early.
