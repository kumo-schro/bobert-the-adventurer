// Builds recommendations/index.html: every player suggestion from recommendations.json (with its
// screenshot and whether it's been done), followed by Claude's own suggestions.
//   node scripts/recommendations-page.mjs   (npm run recommendations also runs it)
// The page sits next to the screenshots in recommendations/, which stays out of git.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

// What happened to each player suggestion, by id. Add a line when one gets built.
const STATUS = {
  '2026-10-12T21-30-00-991Z-bf6740': { done: true, note: 'The well has a blue roof now.' },
  '2026-10-12T21-37-08-935Z-01f465': { done: true, note: 'Ctrl opens the controls menu too.' },
  '2026-10-12T21-40-54-516Z-809af5': { done: true, note: 'A whole day and night now takes 5 minutes instead of 2.' },
  '2026-10-12T21-48-33-460Z-806fbf': { done: true, note: 'Gargoyles stay outside the tower walls now.' },
  '2026-10-12T22-11-35-458Z-d22a99': { done: true, note: 'Added bounce mushrooms in the dream dimension and the Sky Strike from Master Jackson.' },
  '2026-10-13T23-02-50-821Z-5dce4d': { done: false, note: 'Not built yet. Thomage the dream boss is started in theme.md.' },
};

const CLAUDE = {
  author: 'Claude (Opus 5.5)',
  date: '2026-10-14T12:00',
  game: [
    ['Save the adventure (done)', 'Added on Oct 14: press Esc to name and save your adventure in the browser, and load it again later.'],
    ['Show the way to the next goal', 'The world is huge now: the jungle and the dream dimension are hundreds of blocks away. A small arrow at the top of the screen that points to the current quest would stop players getting lost.'],
    ['Add sounds and music', 'The game is completely silent. Sword swooshes, coin jingles, splashes and a gentle tune for each place would make every hit and reward feel much bigger.'],
    ['A gentler setting', 'Master Oak does 10 damage and you start with 5 health, so one spin knocks you out. An "easy" switch that halves monster damage would help younger players, without changing the normal game.'],
    ['A monster book', 'A book that fills in a page for each monster the first time you beat it: its picture, its health and a tip for beating it. It could use the numbers in monsters.md.'],
    ['Touch controls', 'The game only works with a keyboard. An on-screen joystick and buttons would let it be played on a tablet.'],
  ],
  building: [
    ['Keep the test checks in the project', 'The automatic checks I used to test each change lived in a temporary folder, and they were deleted today. Moving them into the project (run with npm test) would keep them safe and let anyone run them.'],
    ['Bring the new art style up to date', 'The art/psychedelic-garden branch was made before the last few rounds of changes. Merging main into it soon will keep the two from drifting further apart.'],
  ],
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const records = JSON.parse(await readFile('recommendations.json', 'utf8').catch(() => '[]'));
const doneCount = records.filter((r) => STATUS[r.id]?.done).length;

const player = records
  .slice()
  .reverse()
  .map((r) => {
    const status = STATUS[r.id];
    const label = r.context?.target?.label;
    const where = [r.context?.area, label?.startsWith('the ') ? label : null].filter(Boolean).join(', near ');
    const badge = status ? (status.done ? '<span class="badge done">Done</span>' : '<span class="badge todo">To do</span>') : '<span class="badge new">New</span>';
    return `
    <article class="card">
      ${r.screenshot ? `<a class="shot" href="${esc(r.screenshot)}"><img src="${esc(r.screenshot)}" alt="What the player was looking at" loading="lazy"></a>` : ''}
      <div class="body">
        <p class="quote">“${esc(r.text)}”</p>
        <p class="meta">${esc(r.name || 'A player')} · ${day(r.createdAt)}${where ? ` · ${esc(where)}` : ''}</p>
        <p class="status">${badge}${status?.note ? ` ${esc(status.note)}` : ''}</p>
      </div>
    </article>`;
  })
  .join('');

// Art direction: Bobert in several art styles (see art/bobert/BRIEF.md). styles.json lists them.
const ART = '../art/bobert';
const styles = JSON.parse(await readFile('art/bobert/styles.json', 'utf8').catch(() => '[]'));
const img = (path, alt) => `<a href="${ART}/${path}"><img src="${ART}/${path}" alt="${esc(alt)}" loading="lazy"></a>`;
const art = styles
  .map(
    (s, i) => `
    <article class="style">
      <h3>${i + 1}. ${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      <div class="pair">
        <figure>${img(`concepts/${s.id}.png`, `Concept painting: ${s.name}`)}<figcaption>Concept painting (Codex)</figcaption></figure>
        <figure>${img(`renders/${s.id}_hero.png`, `3D model: ${s.name}`)}<figcaption>3D model (Blender)</figcaption></figure>
      </div>
      <figure class="turn">${img(`renders/${s.id}_turnaround.png`, `Front, side and back: ${s.name}`)}<figcaption>Front, three-quarter, side and back</figcaption></figure>
      <p class="world"><strong>For the whole game:</strong> ${esc(s.world)}</p>
    </article>`,
  )
  .join('');

const list = (items) => items.map(([title, text]) => `\n      <li><strong>${esc(title)}.</strong> ${esc(text)}</li>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bobert Recommendations</title>
<style>
  :root { --bg: #f7f5ef; --card: #ffffff; --text: #1f2430; --muted: #6b7280; --line: #e5e1d6; --done: #1f7a4d; --done-bg: #e3f4ea; --todo: #9a5b00; --todo-bg: #fdf0d9; --new: #2f5fb8; --new-bg: #e2ebfb; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #16181d; --card: #20232a; --text: #ecedf0; --muted: #9aa0ab; --line: #30343c; --done: #7fd6a4; --done-bg: #1d3a2b; --todo: #f2c26b; --todo-bg: #3d2f14; --new: #9dbdf5; --new-bg: #1e2c47; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 20px; margin: 40px 0 12px; }
  .lead { color: var(--muted); margin: 0; }
  .card { display: flex; gap: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin-bottom: 12px; }
  .shot { flex: 0 0 180px; }
  .shot img { display: block; width: 100%; border-radius: 6px; }
  .body { min-width: 0; }
  .quote { font-size: 18px; margin: 0 0 4px; }
  .meta, .status { color: var(--muted); font-size: 14px; margin: 0 0 6px; }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; padding: 1px 8px; border-radius: 999px; margin-right: 4px; }
  .done { color: var(--done); background: var(--done-bg); }
  .todo { color: var(--todo); background: var(--todo-bg); }
  .new { color: var(--new); background: var(--new-bg); }
  .mine { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 4px 20px 16px; }
  .mine h3 { font-size: 16px; margin: 16px 0 4px; }
  .mine ol { margin: 0; padding-left: 20px; }
  .mine li { margin-bottom: 8px; }
  .sign { color: var(--muted); font-style: italic; margin: 16px 0 0; }
  .style { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 4px 16px 12px; margin-bottom: 16px; }
  .style h3 { font-size: 18px; margin: 14px 0 4px; }
  .style p { margin: 0 0 10px; }
  figure { margin: 0 0 10px; }
  figure img { display: block; width: 100%; border-radius: 6px; background: var(--line); }
  figcaption { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .today { max-width: 320px; margin-top: 12px; margin-bottom: 16px; }
  .world { color: var(--muted); font-size: 14px; }
  @media (max-width: 560px) { .pair { grid-template-columns: 1fr; } }
  @media (max-width: 560px) { .card { flex-direction: column; } .shot { flex-basis: auto; } }
</style>
</head>
<body>
<main>
  <h1>Bobert the Adventurer: Recommendations</h1>
  <p class="lead">${records.length} suggestions from players, ${doneCount} done. Newest first.</p>

  <h2>From players</h2>
  ${player || '<p class="lead">No suggestions yet.</p>'}

  ${art ? `<h2>Art direction</h2>
  <p class="lead">${styles.length} very different takes on Bobert, each a new character in its own art style, to help choose a new look for the game. Each one has a concept painting made with Codex and a 3D model built in Blender from it (click any picture to see it bigger). First, Bobert as he is in the game today:</p>
  <figure class="today">${img('renders/current.png', 'Bobert in the game today')}<figcaption>Bobert in the game today</figcaption></figure>
  ${art}` : ''}

  <h2>From Claude</h2>
  <section class="mine">
    <h3>For the game</h3>
    <ol>${list(CLAUDE.game)}
    </ol>
    <h3>For building it</h3>
    <ol>${list(CLAUDE.building)}
    </ol>
    <p class="sign">— ${esc(CLAUDE.author)}, ${day(CLAUDE.date)}</p>
  </section>
</main>
</body>
</html>
`;

await mkdir('recommendations', { recursive: true });
await writeFile('recommendations/index.html', html);
console.log('Wrote recommendations/index.html');
