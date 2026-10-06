import { LEADERBOARD } from './config.js';
import { loadLocalBoard, saveLocalBoard } from './storage.js';

// Top-10 boards, one per "difficulty:lang" (e.g. "hard:id").
// Online through /api/leaderboard (Vercel Function + Upstash Redis); when that
// isn't reachable (plain static hosting, `npx serve`, offline) the same UI
// runs on an on-device board instead.

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Network failures, timeouts, non-JSON replies (no API deployed) and 5xx
// mean "no online board"; a 4xx means the server rejected this request.
const isUnavailable = (err) => !(err instanceof ApiError) || err.status >= 500 || err.message === 'unavailable';

async function request(method, query, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LEADERBOARD.timeout);
  try {
    const res = await fetch(LEADERBOARD.api + (query ? `?${query}` : ''), {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (!(res.headers.get('content-type') || '').includes('application/json')) {
      throw new ApiError('unavailable', res.status);
    }
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error || 'error', res.status);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export function createLeaderboard() {
  const boards = new Map(); // board → { entries, source, loading, loaded }
  let online = null; // unknown until the first request answers

  function view(board) {
    if (!boards.has(board)) {
      boards.set(board, { entries: loadLocalBoard(board), source: 'local', loading: false, loaded: false });
    }
    return boards.get(board);
  }

  async function refresh(board) {
    const b = view(board);
    if (online === false) {
      b.entries = loadLocalBoard(board);
      b.loaded = true;
      return b;
    }
    b.loading = true;
    try {
      const data = await request('GET', `board=${encodeURIComponent(board)}`);
      online = true;
      b.entries = data.entries;
      b.source = 'online';
    } catch (err) {
      if (isUnavailable(err)) online = false;
      b.entries = loadLocalBoard(board);
      b.source = 'local';
    } finally {
      b.loading = false;
      b.loaded = true;
    }
    return b;
  }

  // The server records when a run starts; the submit must come back with
  // this token, which lets it check the claimed play time is plausible.
  async function startRun(board) {
    if (online === false) return null;
    try {
      const data = await request('POST', '', { action: 'start', board });
      online = true;
      return data.token;
    } catch (err) {
      if (isUnavailable(err)) online = false;
      return null;
    }
  }

  function qualifies(board, score) {
    if (score <= 0) return false;
    const list = view(board).entries;
    return list.length < LEADERBOARD.size || score > list[list.length - 1].score;
  }

  function submitLocal(board, run) {
    const id = `local-${Date.now()}`;
    const list = loadLocalBoard(board);
    list.push({ id, name: run.name, score: run.score, wpm: run.wpm, accuracy: run.accuracy, words: run.words, date: today() });
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, LEADERBOARD.size);
    saveLocalBoard(board, top);
    const i = top.findIndex((e) => e.id === id);
    return { entries: top, rank: i >= 0 ? i + 1 : null, id, source: 'local' };
  }

  // run: { name, score, chars, wrong, words, duration, wpm, accuracy, token }
  // Resolves to { entries, rank, id, source, notice } where notice is
  // null | 'offline' (online board unreachable, saved on device) | 'rejected'.
  async function submit(board, run) {
    let result = null;
    let notice = null;
    if (online === true && run.token) {
      try {
        const data = await request('POST', '', {
          action: 'submit',
          board,
          token: run.token,
          name: run.name,
          score: run.score,
          chars: run.chars,
          wrong: run.wrong,
          words: run.words,
          duration: run.duration,
        });
        result = { entries: data.entries, rank: data.rank, id: data.id, source: 'online' };
      } catch (err) {
        notice = isUnavailable(err) ? 'offline' : 'rejected';
      }
    } else if (online === true) {
      notice = 'offline'; // the run never got a server token
    }
    if (!result) result = submitLocal(board, run);
    const b = view(board);
    b.entries = result.entries;
    b.source = result.source;
    return { ...result, notice };
  }

  return {
    view,
    refresh,
    startRun,
    qualifies,
    submit,
    get online() {
      return online;
    },
  };
}
