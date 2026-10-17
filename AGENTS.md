# Notes for coding agents

Bobert the Adventurer is a voxel adventure game for kids, built with Vite, Three.js and plain JavaScript. Run it with `npm run dev`.

## Files the owner writes

- **`theme.md`: do not modify this file.** It's the owner's list of requests. Read it, and build any new lines under "New requests". Never edit, reformat, reorder or "tidy" it, even to mark things done, unless the owner explicitly asks you to change `theme.md` itself.
- **`story.md`** is the story outline. "Update the game from story.md" means build whatever changed in it. You may update it when the story changes in the game.
- **`monsters.md`** lists every monster's stats, with where each one lives in the code. When asked to update the monsters from it:
  1. Compare each value with the code. Where they differ, `monsters.md` is right: change the code to match.
  2. Build each note under a monster's **Notes**. Then replace the note with "Done: " and a short description of what changed, with the old and new numbers (for example "Done: knockback 7 → 4").
  3. If a note needs a stat the table doesn't have yet (like per-monster knockback), add it to the code and to that monster's table.

  Whenever you change a monster's stats for any other reason, update `monsters.md` to match.

## Rules

- Never say "hearts" in game text (dialogue, toasts, menus). Say "health" or "hits" instead.
- Most tweakable numbers are in `src/config.js`. Monster attack timers go through `attackTime()` in `src/entities/Monster.js`.
- When you've built new lines from `theme.md` or `story.md` and checked them, commit, push and deploy them to the live site, so updates go to the website (the owner asked for this in `theme.md`). Otherwise, don't commit, push or deploy unless asked. Art explorations live in `art/` (in git), but Codex and Blender logs (`art/logs/`, `art/bobert/logs/`: they contain local file paths) and `.env*` files stay out of git.
- The `art/psychedelic-garden` branch must never be deployed to Vercel.
- Deploy to production with `npx vercel@latest deploy --prod --yes`. Pushing to GitHub doesn't deploy.
