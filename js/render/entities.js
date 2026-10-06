import { C, PALETTE, FONTS, WORD } from '../config.js';
import { SHAKE_TIME } from '../targeting.js';
import { sprite } from './sprites.js';
import { POWERS } from '../powerups.js';

// Word containers. Bodies are generated per width (rounded shape, outline,
// bottom shade, small shine) and cached; colors are PICO-8 hex digits.
// o = outline, b = body, s = bottom shade, h = shine (optional).
const STYLES = {
  drop: {
    radius: 'capsule',
    normal: { o: '1', b: '7', s: 'c', h: null, text: C.navy, typed: C.navy },
    target: { o: 'a', b: '1', s: 'c', h: null, text: C.white, typed: C.yellow },
  },
  meteor: {
    radius: 5,
    craters: true,
    normal: { o: '0', b: '2', s: '1', h: '8', text: C.white, typed: C.white },
    target: { o: 'a', b: '1', s: '0', h: '2', text: C.white, typed: C.yellow },
  },
  balloon: {
    radius: 'capsule',
    normal: { o: '4', b: 'a', s: '9', h: '7', text: C.navy, typed: C.navy },
    target: { o: '8', b: '9', s: '4', h: 'a', text: C.navy, typed: C.white },
  },
};

const WRONG_OUTLINE = '8';
const bodyCache = new Map();

function bakeBody(styleName, colors, outline, w, h) {
  const style = STYLES[styleName];
  const R = style.radius === 'capsule' ? h / 2 : style.radius;
  const inside = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const px = x + 0.5;
    const py = y + 0.5;
    const cx = Math.min(Math.max(px, R), w - R);
    const cy = Math.min(Math.max(py, R), h - R);
    return Math.hypot(px - cx, py - cy) <= R;
  };

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const shineX = Math.round(R) - 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let c = colors.b;
      if (edge) c = outline;
      else if (y >= h - 4) c = colors.s;
      else if (colors.h && y >= 2 && y <= 3 && x >= shineX && x < shineX + 3) c = colors.h;
      ctx.fillStyle = PALETTE[parseInt(c, 16)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (style.craters) {
    ctx.fillStyle = PALETTE[parseInt(colors.s, 16)];
    ctx.fillRect(3, h - 7, 2, 1);
    ctx.fillRect(w - 6, 4, 2, 1);
    ctx.fillRect(w - 5, 5, 1, 1);
  }
  return canvas;
}

function body(styleName, variant, wrong, w, h) {
  const key = `${styleName}|${variant}|${wrong}|${w}|${h}`;
  let img = bodyCache.get(key);
  if (!img) {
    const colors = STYLES[styleName][variant];
    img = bakeBody(styleName, colors, wrong ? WRONG_OUTLINE : colors.o, w, h);
    bodyCache.set(key, img);
  }
  return img;
}

// Flickering flame trail above a falling meteor, in 2px columns.
function drawFlames(r, x, y, w, t) {
  const cx = x + w / 2;
  const half = w / 2 - 3;
  for (let i = -half; i <= half; i += 2) {
    const k = 1 - (i / half) ** 2;
    const hgt = Math.max(1, Math.round((5 + 3 * Math.sin(t * 18 + i * 1.3)) * k + 1));
    const fx = Math.round(cx + i);
    r.rect(fx, y - hgt + 2, 2, hgt, C.red);
    const mid = Math.round(hgt * 0.6);
    if (mid > 0) r.rect(fx, y - mid + 2, 2, mid, C.orange);
    const core = Math.round(hgt * 0.3);
    if (core > 0) r.rect(fx, y - core + 2, 2, core, C.yellow);
  }
}

function drawBalloonString(r, cx, y, t, knot) {
  r.rect(cx - 1, y - 1, 3, 2, knot);
  for (let i = 0; i < 8; i++) {
    r.rect(cx + Math.round(Math.sin(t * 4 - i * 0.8)), y + 1 + i, 1, 1, C.silver);
  }
}

export function drawWord(r, w, isTarget, time) {
  const style = STYLES[w.style];
  const variant = isTarget ? 'target' : 'normal';
  const colors = style[variant];
  const wrong = w.shake > 0;
  const t = time + w.seed;

  let x = Math.round(w.x);
  const y = Math.round(w.y);
  if (wrong) x += Math.round(Math.sin(w.shake * 70) * 2 * (w.shake / SHAKE_TIME));
  if (w.style === 'balloon') x += Math.round(Math.sin(t * 2) * 2);
  const cx = x + Math.round(w.w / 2);

  if (w.style === 'meteor') drawFlames(r, x, y, w.w, t);
  if (w.style === 'balloon') {
    drawBalloonString(r, cx, y + w.h, t, PALETTE[parseInt(colors.o, 16)]);
    if (w.power) r.sprite(sprite(POWERS[w.power].icon), cx - 3 + Math.round(Math.sin(t * 4 - 6.4)), y + w.h + 9);
  }
  r.sprite(body(w.style, variant, wrong, w.w, w.h), x, y);
  if (w.style === 'drop') {
    r.sprite(sprite('dropTip', { o: wrong ? WRONG_OUTLINE : colors.o, b: colors.b }), cx - 3, y - 4);
  }

  const textY = y + w.h / 2 + 1;
  const opts = { size: WORD.fontSize, family: FONTS.word, baseline: 'middle' };
  if (w.typed === 0) {
    r.text(w.text, x + w.w / 2, textY, { ...opts, align: 'center', color: colors.text });
    return;
  }

  // Draw typed and remaining parts separately, both anchored to the centered start.
  const total = r.measure(w.text, WORD.fontSize, FONTS.word);
  const startX = x + (w.w - total) / 2;
  const typed = w.text.slice(0, w.typed);
  r.text(typed, startX, textY, { ...opts, color: colors.typed });
  r.text(w.text.slice(w.typed), startX + r.measure(typed, WORD.fontSize, FONTS.word), textY, {
    ...opts,
    color: colors.text,
  });
}
