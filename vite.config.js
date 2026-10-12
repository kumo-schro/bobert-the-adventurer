import { defineConfig } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { cleanRecommendation } from './server/recommendations.js';

const FILE = 'recommendations.json';
const SCREENSHOTS = 'recommendations';

/**
 * While playing locally (npm run dev), suggestions from the in-game "Suggest a change" tool are
 * saved straight into recommendations.json (screenshots go in recommendations/). On the live
 * site they go to the Vercel function in api/ instead.
 */
function localRecommendations() {
  const readAll = async () => JSON.parse(await readFile(FILE, 'utf8').catch(() => '[]'));
  return {
    name: 'local-recommendations',
    configureServer(server) {
      server.middlewares.use('/api/recommendations', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET') return res.end(JSON.stringify(await readAll(), null, 2));
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Use GET or POST.' }));
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        try {
          const { record, screenshot } = cleanRecommendation(JSON.parse(raw));
          if (screenshot) {
            await mkdir(SCREENSHOTS, { recursive: true });
            await writeFile(`${SCREENSHOTS}/${record.screenshot}`, screenshot);
          }
          const all = await readAll();
          all.push({ ...record, source: 'local' });
          await writeFile(FILE, `${JSON.stringify(all, null, 2)}\n`);
          res.end(JSON.stringify({ ok: true, id: record.id }));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [localRecommendations()],
  // three.js alone is ~500 kB, so raise the warning threshold.
  build: { chunkSizeWarningLimit: 1000 },
  // Saving a recommendation writes these files: don't reload the page when that happens.
  server: { watch: { ignored: ['**/recommendations.json', '**/recommendations/**'] } },
});
