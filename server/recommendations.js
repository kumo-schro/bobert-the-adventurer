// Shared by the Vercel function (api/recommendations.js) and the local dev server (vite.config.js).
// A recommendation is what a player typed about something they clicked in the game, plus where
// they were and what they could see. Nothing here calls an AI: they're just saved for review.

import { randomBytes } from 'node:crypto';

const MAX_TEXT = 1000;
const MAX_NAME = 40;
const MAX_CONTEXT = 8000; // characters of JSON
const MAX_SCREENSHOT = 400_000; // characters of base64 (about 300 KB)

/**
 * Check and tidy up a recommendation sent by the game. Throws an Error with a friendly
 * message if something's wrong. Returns { record, screenshot } where screenshot is a Buffer (or null).
 */
export function cleanRecommendation(body) {
  if (!body || typeof body !== 'object') throw new Error('Expected a JSON object.');
  const text = String(body.text ?? '').trim();
  if (!text) throw new Error('Please type what you would like changed.');
  if (text.length > MAX_TEXT) throw new Error(`Please keep it under ${MAX_TEXT} characters.`);
  const name = String(body.name ?? '').trim().slice(0, MAX_NAME);

  const context = body.context && typeof body.context === 'object' ? body.context : {};
  if (JSON.stringify(context).length > MAX_CONTEXT) throw new Error('Too much game info was sent.');

  let screenshot = null;
  if (typeof body.screenshot === 'string' && body.screenshot.startsWith('data:image/jpeg;base64,')) {
    const data = body.screenshot.slice('data:image/jpeg;base64,'.length);
    if (data.length <= MAX_SCREENSHOT) screenshot = Buffer.from(data, 'base64');
  }

  const createdAt = new Date().toISOString();
  const id = `${createdAt.replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`;
  return {
    record: { id, createdAt, name: name || null, text, context, screenshot: screenshot ? `${id}.jpg` : null },
    screenshot,
  };
}
