// Letterfall online leaderboard: a Vercel Function backed by Upstash Redis.
//
//   GET  /api/leaderboard?board=medium:en          → { entries }
//   POST /api/leaderboard { action: 'start', board } → { token }
//   POST /api/leaderboard { action: 'submit', board, token, name, score,
//                           chars, wrong, words, duration } → { rank, id, entries }
//
// Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the KV_REST_API_*
// names the Vercel ↔ Upstash integration creates).
//
// A browser game can't fully stop forged scores, so the server makes cheating
// tedious instead: runs need a token issued at game start, the claimed play
// time must fit the time since then, WPM/score must be physically plausible,
// and each IP is rate-limited.
import { createHash, randomUUID } from 'node:crypto';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const LANGS = ['en', 'id'];
const TOP = 10;
const KEEP = 100; // entries kept per board
const NAME = /^[A-Z0-9]{1,10}$/;
const MAX_WPM = 250;
// Best case per correct character: 10 points × 4 combo × 1.5 perfect.
const MAX_POINTS_PER_CHAR = 60;
const RUN_TTL = 6 * 60 * 60; // a run token lives 6 hours
const LIMITS = { start: 60, submit: 20 }; // per IP per window
const LIMIT_WINDOW = 10 * 60;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

// Runs Redis commands through Upstash's REST pipeline endpoint.
async function redis(...commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new HttpError(503, 'Leaderboard storage is not configured');
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new HttpError(502, 'Leaderboard storage error');
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new HttpError(502, 'Leaderboard storage error');
    return r.result;
  });
}

function parseBoard(board) {
  const [difficulty, lang] = String(board || '').split(':');
  if (!DIFFICULTIES.includes(difficulty) || !LANGS.includes(lang)) throw new HttpError(400, 'Unknown board');
  return `lf:board:${difficulty}:${lang}`;
}

function clientKey(request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

async function rateLimit(request, kind) {
  // Fixed window: the counter's expiry is set once, by the first request.
  const key = `lf:rl:${kind}:${clientKey(request)}`;
  const [count] = await redis(['INCR', key]);
  if (count === 1) await redis(['EXPIRE', key, LIMIT_WINDOW]);
  if (count > LIMITS[kind]) throw new HttpError(429, 'Too many requests, try again later');
}

async function top(key) {
  const [flat] = await redis(['ZRANGE', key, 0, TOP - 1, 'REV']);
  return flat.map((member) => JSON.parse(member));
}

const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

async function submit(request, body) {
  const key = parseBoard(body.board);
  const name = String(body.name || '').trim().toUpperCase();
  const { score, chars, wrong, words, duration, token } = body;

  if (!NAME.test(name)) throw new HttpError(422, 'Name must be 1–10 letters or digits');
  if (!int(score, 1, 10_000_000) || !int(chars, 1, 1_000_000) || !int(wrong, 0, 1_000_000) || !int(words, 0, 100_000)) {
    throw new HttpError(422, 'Invalid run');
  }
  if (!num(duration, 5, 24 * 60 * 60)) throw new HttpError(422, 'Run too short');
  if (typeof token !== 'string' || token.length > 64) throw new HttpError(422, 'Missing run token');

  await rateLimit(request, 'submit');

  // Single use: the token is consumed whether or not the run is accepted.
  const [started] = await redis(['GETDEL', `lf:run:${token}`]);
  if (!started) throw new HttpError(422, 'Unknown or expired run');
  const elapsed = (Date.now() - Number(started)) / 1000;
  if (duration > elapsed + 5) throw new HttpError(422, 'Run time does not add up');

  const wpm = chars / 5 / (duration / 60);
  if (wpm > MAX_WPM) throw new HttpError(422, 'Implausible typing speed');
  // Bombed words score a little without being typed, hence the slack.
  if (score > chars * MAX_POINTS_PER_CHAR * 1.1 + 2000) throw new HttpError(422, 'Implausible score');
  if (words * 3 > chars + 3) throw new HttpError(422, 'Implausible word count');

  const id = token;
  const entry = {
    id,
    name,
    score,
    wpm: Math.round(wpm),
    accuracy: Math.round((chars / (chars + wrong)) * 1000) / 1000,
    words,
    date: new Date().toISOString().slice(0, 10),
  };
  const member = JSON.stringify(entry);
  const [, , rank] = await redis(
    ['ZADD', key, score, member],
    ['ZREMRANGEBYRANK', key, 0, -(KEEP + 1)],
    ['ZREVRANK', key, member],
  );
  return { id, rank: rank === null ? null : rank + 1, entries: await top(key) };
}

async function handle(request) {
  if (request.method === 'GET') {
    const key = parseBoard(new URL(request.url).searchParams.get('board'));
    return json(200, { entries: await top(key) });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
  if (body?.action === 'start') {
    parseBoard(body.board);
    await rateLimit(request, 'start');
    const token = randomUUID();
    await redis(['SET', `lf:run:${token}`, Date.now(), 'EX', RUN_TTL]);
    return json(200, { token });
  }
  if (body?.action === 'submit') return json(200, await submit(request, body));
  throw new HttpError(400, 'Unknown action');
}

async function respond(request) {
  try {
    return await handle(request);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error(err);
    return json(500, { error: 'Server error' });
  }
}

export const GET = respond;
export const POST = respond;
