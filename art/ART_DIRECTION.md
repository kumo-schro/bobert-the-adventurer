# Art direction: Psychedelic Garden

Branch: `art/psychedelic-garden`. The game, story and gameplay stay the same; only the look changes.

## The feel
A cheerful, surreal garden dream. Everything is a little too colorful and a little too round,
like a toy box left out in the sun. Blocky silhouettes, but never voxel cubes: every block has
soft beveled edges, gentle tapers, and smooth curves where it matters. Bold, high-contrast color
with a painterly finish.

- **Shapes:** chunky blocks with rounded (beveled) edges, stacked and slightly tilted, tapered
  trunks, puffy domes, spirals and scallops. Big simple forms first, tiny detail last.
- **Not voxel:** no 1x1 cube grids. Ground is one smooth surface, trees are sculpted models,
  props are beveled blocks of any size.
- **Color:** saturated and high contrast. Lime and emerald grass with magenta and turquoise
  swirls; candy pinks, tangerine, sunflower yellow, electric violet, aqua. Darks are plum and
  deep teal, never grey-black.
- **Light:** warm sun, cool violet shadows, a soft rim light on everything, a gentle glow on
  flowers, lanterns and magic things. A little color grading (saturation, contrast, vignette).
- **Sky:** a gradient from deep violet overhead to peach and pink at the horizon, with soft,
  puffy beveled clouds.

## Palette
| Role | Colors |
| --- | --- |
| Grass | `#7dff3a` lime, `#21c46b` emerald, `#18a9a0` teal |
| Accent swirls | `#ff4fd8` magenta, `#36e6ff` turquoise, `#ffe14d` sunflower |
| Warm | `#ff8a3d` tangerine, `#ff5e7e` coral, `#ffd0a8` peach |
| Cool | `#8a5cff` violet, `#4b7bff` cobalt, `#7af0d8` mint |
| Darks (never black) | `#3a1450` plum, `#0f4a5a` deep teal |
| Sky | `#5b2bb8` top, `#ff7ac8` middle, `#ffd29a` horizon |

## Assets
- **Textures** (Codex, `art/textures/`): grass, sand, path, stone, bark, foliage, roof tiles,
  planks. Tileable, painterly, 1024px masters, shipped as 512px JPEG/WebP in `public/textures/`.
  Light/neutral ones (stone, foliage, roof tiles) get tinted per object.
- **Models** (Blender, `art/blender/`): trees, flowers, mushrooms, boulders, bushes, built by
  Python scripts so they can be rebuilt and tweaked. Exported as `.glb` to `public/models/`.
  Low poly with smooth bevels, vertex colors plus the shared textures.

## Performance budget (it must stay fast)
- Under ~300 draw calls and ~1M triangles in the busiest view.
- Repeated things (trees, flowers, rocks, grass tufts) are instanced: one draw call per kind.
- One shadow-casting sun with a modest shadow map; small props don't cast shadows.
- No per-frame allocations; post effects in one cheap full-screen pass.

## How it's built
- `src/style/garden.js`: the shared toon material (`gardenMaterial`): 4-band toon light, world-space
  triplanar texture, soft rim light, constant-size bevels on instanced blocks, and `glow` for things
  that shine in their own (per-instance) color.
- `src/style/models.js`: loads the Blender `.glb` models once at startup (`await loadModels()` in
  main.js) and draws them with instancing: `instances(name, list)` for scattered copies (trees,
  flowers, rocks), `single(name)` for one-offs that come and go (mineable boulders).
- `src/style/IslandSurface.js`: one smooth mesh per island (grass, beach, underwater slope) with a
  painted path map for cobbled paths. `src/style/heightfield.js`: faceted grid meshes for the cave
  mountains (blocky in plan, smooth on top) so the cave collision grids stay the same.
- `src/style/Grade.js`: the scene renders offscreen with 4x MSAA, then one pass grades it
  (saturation, contrast, violet shadows, peach highlights, vignette).
- Characters are still built from parts (`part()`), but `bakeParts()` merges each body part's
  pieces into one mesh, so a person is ~6 draw calls instead of ~27.

## Rebuilding assets
- Models: `Blender -b -P art/blender/trees.py` (also `plants.py`, `sky.py`). Each writes
  `public/models/<name>.glb` and a preview PNG in `art/previews/`.
- Textures: `art/tools/gen-texture.sh <name> "<description>"` asks Codex for a tileable painted
  texture (master in `art/textures/`), then convert to 512px WebP in `public/textures/`.

## Status
Converted: sky, light, water, clouds, color grading, main island ground and paths, forest,
meadow plants, horizon hills, village houses/forge/well, small islands, tower island, jungle
(ground, trees, temple), slime cave mountain, Charibdis sea cave, dream dimension, characters
(chunkier parts, cartoon eyes), mineable boulders.

Still on the old block look (restyled colors only): the cellar, the seabed plants, the dock,
market stalls, monsters (they use the chunky part style like the characters).

Measured on an M1 (headless Chrome, Metal), busiest views:
| | Voxel original | Psychedelic Garden |
| --- | --- | --- |
| Draw calls | about 1030 | 390 to 620 |
| Triangles (incl. shadows) | about 1.6M | 1.1M to 1.3M |
| Frame time (update + render) | 3.0 to 4.6 ms | 3.3 to 4.9 ms (now with MSAA + grading) |
