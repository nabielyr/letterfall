import { C, FONTS, RULES, FX, GROUND_H } from '../config.js';
import { t } from '../i18n/index.js';
import { sprite } from './sprites.js';

const UI = { family: FONTS.ui, size: 8, baseline: 'top', shadow: C.navy };
const PAD = 4;
const LINE = 10;
const RAINBOW = [C.yellow, C.orange, C.pink, C.green, C.blue];

// h: { score, combo, mult, lives, wpm (number|null), accuracy (0–1), level, slow (0–1), time }
export function drawHud(r, h) {
  // Left: score and combo. High combos flash through the palette.
  r.text(`${t('hudScore')} ${h.score}`, PAD, PAD, { ...UI, color: C.white });
  if (h.combo >= 2) {
    const hype = h.combo >= FX.hypeCombo[0];
    const label = t('hudCombo', { combo: h.combo });
    const color = hype ? RAINBOW[Math.floor(h.time * (h.combo >= FX.hypeCombo[1] ? 16 : 10)) % RAINBOW.length] : C.yellow;
    r.text(label, PAD, PAD + LINE, { ...UI, color });
    if (h.mult > 1) {
      const x = PAD + r.measure(label, UI.size, UI.family) + 4;
      r.text(`x${h.mult}`, x, PAD + LINE, { ...UI, color: C.orange });
    }
  }

  // Center: hearts. Extra lives beyond the base three add slots.
  const slots = Math.max(RULES.lives, h.lives);
  const full = sprite('heart');
  const empty = sprite('heartEmpty');
  const gap = 2;
  const total = slots * full.width + (slots - 1) * gap;
  const x0 = Math.round((r.W - total) / 2);
  for (let i = 0; i < slots; i++) {
    r.sprite(i < h.lives ? full : empty, x0 + i * (full.width + gap), PAD);
  }

  // Slow-motion timer bar under the hearts.
  if (h.slow > 0) {
    const w = 40;
    const bx = Math.round((r.W - w) / 2);
    r.rect(bx - 1, PAD + 10, w + 2, 4, C.navy);
    r.rect(bx, PAD + 11, Math.max(1, Math.round(w * h.slow)), 2, C.blue);
  }

  // Right: WPM, accuracy, level.
  const right = { ...UI, align: 'right' };
  const wpm = h.wpm === null ? '--' : Math.round(h.wpm);
  r.text(`${t('hudWpm')} ${wpm}`, r.W - PAD, PAD, { ...right, color: C.white });
  r.text(`${t('hudAcc')} ${Math.floor(h.accuracy * 100)}%`, r.W - PAD, PAD + LINE, { ...right, color: C.white });
  r.text(t('hudLevel', { level: h.level }), r.W - PAD, PAD + LINE * 2, { ...right, color: C.peach });
}

// Bottom-right, on the ground strip. Returns its button for hit-testing.
export function drawMuteButton(r, muted, hovered) {
  const w = 14;
  const h = 12;
  const x = r.W - w - 4;
  const y = r.H - GROUND_H + 6;
  r.rect(x, y, w, h, hovered ? C.blue : C.navy);
  r.sprite(sprite(muted ? 'speakerOff' : 'speakerOn'), x + 2, y + 2);
  return { id: 'mute', x, y, w, h };
}
