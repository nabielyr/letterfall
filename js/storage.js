// localStorage can be missing or throw (private mode, blocked storage), so
// every access is guarded and the game works without it.
const PREFIX = 'letterfall:';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not persisted; fine.
  }
}

// Personal best per language and difficulty. Medium falls back to the
// pre-difficulty key so earlier records aren't lost.
export function loadBest(lang, difficulty) {
  let best = read(`best:${lang}:${difficulty}`, null);
  if (!best && difficulty === 'medium') best = read(`best:${lang}`, null);
  return {
    score: Number(best?.score) || 0,
    wpm: Number(best?.wpm) || 0,
  };
}

export function saveBest(lang, difficulty, best) {
  write(`best:${lang}:${difficulty}`, { score: best.score, wpm: best.wpm });
}

export const loadLang = (fallback) => read('lang', fallback);
export const saveLang = (lang) => write('lang', lang);
export const loadDifficulty = (fallback) => read('difficulty', fallback);
export const saveDifficulty = (difficulty) => write('difficulty', difficulty);
export const loadMuted = () => read('muted', false) === true;
export const saveMuted = (muted) => write('muted', muted);
export const loadMusic = () => read('music', true) !== false;
export const saveMusic = (on) => write('music', on);
export const loadName = () => String(read('name', '') || '');
export const saveName = (name) => write('name', name);

// On-device leaderboard, used when the online one isn't reachable.
export function loadLocalBoard(board) {
  const list = read(`board:${board}`, []);
  return Array.isArray(list) ? list : [];
}

export function saveLocalBoard(board, entries) {
  write(`board:${board}`, entries);
}
