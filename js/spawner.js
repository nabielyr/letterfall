import { DIFFICULTY, WORD } from './config.js';

const TIERS = ['short', 'medium', 'long'];

const lerp = (a, b, k) => a + (b - a) * k;
export const rand = (min, max) => min + Math.random() * (max - min);

// Fills `out` in place so the per-frame call allocates nothing.
export function difficultyAt(t, preset = 'medium', out = { tierWeights: [0, 0, 0] }) {
  const d = DIFFICULTY.presets[preset];
  const k = Math.min(1, Math.max(0, t / d.rampSeconds));
  out.level = Math.floor(t / DIFFICULTY.levelSeconds) + 1;
  out.fallTime = lerp(d.fallTime[0], d.fallTime[1], k);
  out.spawnInterval = lerp(d.spawnInterval[0], d.spawnInterval[1], k);
  out.maxWords = Math.round(lerp(d.maxWords[0], d.maxWords[1], k));
  for (let i = 0; i < 3; i++) {
    out.tierWeights[i] = lerp(d.tierWeights[0][i], d.tierWeights[1][i], k);
  }
  return out;
}

function pickTier(weights) {
  const total = weights[0] + weights[1] + weights[2];
  let roll = Math.random() * total;
  for (let i = 0; i < 3; i++) {
    roll -= weights[i];
    if (roll < 0) return TIERS[i];
  }
  return TIERS[0];
}

// Prefers words whose first letter isn't already on screen so auto-targeting
// stays unambiguous; falls back to any word not currently falling.
export function pickWord(list, weights, active) {
  const pool = list[pickTier(weights)];
  const firstLetters = new Set(active.map((w) => w.text[0]));
  const onScreen = new Set(active.map((w) => w.text));
  let fallback = null;
  for (let i = 0; i < 16; i++) {
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (onScreen.has(candidate)) continue;
    fallback ??= candidate;
    if (!firstLetters.has(candidate[0])) return candidate;
  }
  return fallback ?? pool[Math.floor(Math.random() * pool.length)];
}

// Random x that keeps the word on screen and avoids words still near the top.
export function pickX(width, W, active) {
  const min = WORD.edgeMargin;
  const max = W - WORD.edgeMargin - width;
  if (max <= min) return Math.max(0, (W - width) / 2);

  let best = min;
  let bestOverlap = Infinity;
  for (let i = 0; i < 8; i++) {
    const x = rand(min, max);
    let overlap = 0;
    for (const a of active) {
      if (a.p > 0.3) continue;
      overlap += Math.max(0, Math.min(x + width, a.x + a.w) - Math.max(x, a.x));
    }
    if (overlap === 0) return x;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      best = x;
    }
  }
  return best;
}
