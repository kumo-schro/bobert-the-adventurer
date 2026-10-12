// Vercel Function: POST /api/recommendations saves a player's suggestion (and a small screenshot)
// to the project's private Blob store. GET /api/recommendations?key=... lists them all (only
// with the secret RECOMMENDATIONS_KEY, so only the game's owner can read them);
// add &file=<name>.jpg to download one screenshot. See scripts/pull-recommendations.mjs.

import { put, list, get } from '@vercel/blob';
import { cleanRecommendation } from '../server/recommendations.js';

const PREFIX = 'recommendations/';

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      let cleaned;
      try {
        cleaned = cleanRecommendation(body);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      const { record, screenshot } = cleaned;
      if (screenshot) {
        await put(`${PREFIX}${record.screenshot}`, screenshot, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false });
      }
      await put(`${PREFIX}${record.id}.json`, JSON.stringify(record, null, 2), {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
      });
      return res.status(200).json({ ok: true, id: record.id });
    }

    if (req.method === 'GET') {
      if (!process.env.RECOMMENDATIONS_KEY || req.query.key !== process.env.RECOMMENDATIONS_KEY) {
        return res.status(401).json({ error: 'Wrong or missing key.' });
      }
      if (req.query.file) {
        const file = String(req.query.file);
        if (!/^[\w.-]+\.jpg$/.test(file)) return res.status(400).json({ error: 'Bad file name.' });
        const blob = await get(`${PREFIX}${file}`, { access: 'private' });
        if (!blob || blob.statusCode !== 200) return res.status(404).json({ error: 'Not found.' });
        res.setHeader('Content-Type', 'image/jpeg');
        return res.status(200).send(await readStream(blob.stream));
      }
      const records = [];
      let cursor;
      do {
        const page = await list({ prefix: PREFIX, cursor });
        for (const item of page.blobs) {
          if (!item.pathname.endsWith('.json')) continue;
          const blob = await get(item.pathname, { access: 'private' });
          if (blob?.statusCode === 200) records.push(JSON.parse((await readStream(blob.stream)).toString('utf8')));
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return res.status(200).json(records);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Use GET or POST.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Something went wrong saving that. Please try again.' });
  }
}
