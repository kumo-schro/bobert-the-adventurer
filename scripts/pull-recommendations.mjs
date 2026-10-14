// Downloads everyone's suggestions from the live game into recommendations.json (and their
// screenshots into recommendations/), merged with any saved while playing locally.
//   npm run recommendations
// Then rebuilds recommendations/index.html (see recommendations-page.mjs).
// Needs RECOMMENDATIONS_KEY in .env.local (it's there after `vercel env pull`).

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';

const SITE = process.env.SITE ?? 'https://bobert-the-adventurer.vercel.app';
const env = await readFile('.env.local', 'utf8').catch(() => '');
const key = process.env.RECOMMENDATIONS_KEY ?? env.match(/^RECOMMENDATIONS_KEY="?([^"\n]+)"?/m)?.[1];
if (!key) {
  console.error('No RECOMMENDATIONS_KEY found. Run `npx vercel env pull` first.');
  process.exit(1);
}

const url = `${SITE}/api/recommendations?key=${encodeURIComponent(key)}`;
const response = await fetch(url);
if (!response.ok) {
  console.error(`Couldn't download recommendations: ${response.status} ${await response.text()}`);
  process.exit(1);
}
const remote = await response.json();
const local = JSON.parse(await readFile('recommendations.json', 'utf8').catch(() => '[]'));
const byId = new Map(local.map((r) => [r.id, r]));
let added = 0;
await mkdir('recommendations', { recursive: true });
for (const record of remote) {
  if (!byId.has(record.id)) added++;
  byId.set(record.id, { ...record, source: 'live' });
  if (record.screenshot) {
    const path = `recommendations/${record.screenshot}`;
    const have = await access(path).then(() => true).catch(() => false);
    if (!have) {
      const image = await fetch(`${url}&file=${encodeURIComponent(record.screenshot)}`);
      if (image.ok) await writeFile(path, Buffer.from(await image.arrayBuffer()));
    }
  }
}
const all = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
await writeFile('recommendations.json', `${JSON.stringify(all, null, 2)}\n`);
console.log(`${added} new from the live game, ${all.length} recommendations in recommendations.json`);

// Rebuild the page that lists them all.
await import('./recommendations-page.mjs');
