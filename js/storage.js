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

export function loadBest(lang) {
  const best = read(`best:${lang}`, null);
  return {
    score: Number(best?.score) || 0,
    wpm: Number(best?.wpm) || 0,
  };
}

export function saveBest(lang, best) {
  write(`best:${lang}`, { score: best.score, wpm: best.wpm });
}

export const loadLang = (fallback) => read('lang', fallback);
export const saveLang = (lang) => write('lang', lang);
export const loadMuted = () => read('muted', false) === true;
export const saveMuted = (muted) => write('muted', muted);
