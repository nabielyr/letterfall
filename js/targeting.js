// Auto-targeting: the first letter locks the matching word closest to the
// ground; later letters apply to that word, unless they spell the start of a
// different word, in which case the lock moves there.
export const SHAKE_TIME = 0.25;

// Returns one of: { kind: 'lock' | 'advance' | 'switch' | 'complete' | 'wrong' | 'miss', word }
export function typeChar(game, ch) {
  const target = game.target;

  if (!target) {
    let best = null;
    for (const w of game.words) {
      if (w.text[0] === ch && (!best || w.y > best.y)) best = w;
    }
    if (!best) return { kind: 'miss', word: null };
    game.target = best;
    best.typed = 1;
    return finishOrAdvance(game, best, 'lock');
  }

  if (target.text[target.typed] === ch) {
    target.typed++;
    return finishOrAdvance(game, target, 'advance');
  }

  // Everything typed so far may also spell the start of another word
  // ("r" locked "rock", then "a" → the player meant "rain"). Switch instead of
  // counting a mistake.
  const prefix = target.text.slice(0, target.typed) + ch;
  let alt = null;
  for (const w of game.words) {
    if (w !== target && w.text.startsWith(prefix) && (!alt || w.y > alt.y)) alt = w;
  }
  if (alt) {
    target.typed = 0;
    game.target = alt;
    alt.typed = prefix.length;
    return finishOrAdvance(game, alt, 'switch');
  }

  target.errors++;
  target.shake = SHAKE_TIME;
  return { kind: 'wrong', word: target };
}

function finishOrAdvance(game, word, kind) {
  if (word.typed < word.text.length) return { kind, word };
  game.target = null;
  return { kind: 'complete', word };
}

export function releaseTarget(game) {
  if (!game.target) return false;
  game.target.typed = 0;
  game.target = null;
  return true;
}
