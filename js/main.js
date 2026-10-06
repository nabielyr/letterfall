import { DIFFICULTY, FONTS, MAX_DT } from './config.js';
import { createRenderer } from './render/renderer.js';
import { createGame } from './game.js';
import { createDebug } from './debug.js';
import { createInput } from './input.js';
import { loadLang, loadMuted } from './storage.js';
import { createAudio } from './audio.js';
import { LANGS, setLang } from './i18n/index.js';
import wordsEn from './data/words.en.js';
import wordsId from './data/words.id.js';

const params = new URLSearchParams(location.search);
const debugEnabled = params.has('debug') && params.get('debug') !== '0';
const startLevel = Math.max(1, parseInt(params.get('level'), 10) || 1);

// Canvas text silently falls back to another font if drawn before the web font
// is ready, so wait for it (with a timeout in case the font CDN is unreachable).
async function loadFonts() {
  if (!document.fonts) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`16px ${FONTS.word}`), document.fonts.load(`16px ${FONTS.ui}`)]),
      timeout,
    ]);
  } catch {
    // Fall back to monospace.
  }
}

async function boot() {
  await loadFonts();

  // Saved choice, else the browser language.
  const browserLang = (navigator.language || '').toLowerCase().startsWith('id') ? 'id' : 'en';
  const saved = loadLang(browserLang);
  const lang = LANGS.includes(saved) ? saved : 'en';
  setLang(lang);

  // Browsers only allow audio after a user gesture; unlock on the first one.
  const audio = createAudio({ muted: loadMuted() });
  const unlockAudio = () => audio.unlock();
  window.addEventListener('keydown', unlockAudio, { capture: true });
  window.addEventListener('pointerdown', unlockAudio, { capture: true });

  const stage = document.getElementById('stage');
  const renderer = createRenderer(stage);
  const game = createGame({
    renderer,
    audio,
    wordLists: { en: wordsEn, id: wordsId },
    lang,
    startTime: (startLevel - 1) * DIFFICULTY.levelSeconds,
    touch: window.matchMedia('(pointer: coarse)').matches,
  });
  const debug = createDebug(debugEnabled);

  const input = createInput(document.getElementById('kb'), {
    onChar: game.onChar,
    onBackspace: game.onBackspace,
    onEscape: game.onEscape,
    onEnter: game.onEnter,
    onArrow: game.onArrow,
  });

  stage.addEventListener('pointermove', (e) => {
    const p = renderer.toWorld(e.clientX, e.clientY);
    renderer.frame.style.cursor = game.onPointerMove(p.x, p.y) ? 'pointer' : '';
  });
  // Any tap also focuses the hidden input so mobile opens its keyboard
  // (iOS only allows that from a click, not pointerdown).
  stage.addEventListener('click', (e) => {
    input.focus();
    const p = renderer.toWorld(e.clientX, e.clientY);
    game.onClick(p.x, p.y);
  });

  // Never let the game run unattended.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
  });
  window.addEventListener('blur', game.pause);

  if (debug) window.letterfall = { game, renderer, audio, debug };

  let last = performance.now();
  function frame(now) {
    const rawDt = Math.max(0, (now - last) / 1000);
    last = now;
    const dt = Math.min(rawDt, MAX_DT);

    game.update(dt);
    renderer.begin();
    game.draw();
    if (debug) {
      debug.update(rawDt);
      debug.draw(renderer, game.debugInfo());
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
