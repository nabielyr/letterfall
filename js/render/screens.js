import { C, FONTS, GROUND_H } from '../config.js';
import { t, tIn } from '../i18n/index.js';

// Canvas-drawn menus. Each draw function returns its buttons
// ({ id, x, y, w, h }) so the game can hit-test pointer clicks.

const TITLE_COLORS = [C.yellow, C.orange, C.pink, C.green, C.white];
const BTN_H = 18;
const DIM = 'rgba(29, 43, 83, 0.72)'; // navy veil over the frozen playfield

function wrap(r, str, maxW, size, family) {
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && r.measure(next, size, family) > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function paragraph(r, str, y, o) {
  const lines = wrap(r, str, r.W - 24, o.size, o.family);
  lines.forEach((line, i) => {
    r.text(line, r.W / 2, y + i * (o.size + 2), { ...o, align: 'center', baseline: 'top' });
  });
  return y + lines.length * (o.size + 2);
}

function button(r, id, label, cx, y, w, hoverId, primary) {
  const hovered = hoverId === id;
  const x = Math.round(cx - w / 2);
  const lift = hovered ? -1 : 0;
  r.rect(x, y + 2, w, BTN_H, C.navy); // drop shadow
  r.rect(x, y + lift, w, BTN_H, C.navy);
  const fill = primary ? (hovered ? C.yellow : C.orange) : hovered ? C.white : C.silver;
  r.rect(x + 1, y + 1 + lift, w - 2, BTN_H - 2, fill);
  r.text(label, x + w / 2, y + lift + BTN_H / 2 + 1, {
    family: FONTS.ui,
    size: 8,
    color: C.navy,
    align: 'center',
    baseline: 'middle',
  });
  return { id, x, y, w, h: BTN_H };
}

function buttonWidth(r, label) {
  return Math.max(56, Math.ceil(r.measure(label, 8, FONTS.ui)) + 20);
}

// Two buttons side by side, centered.
function buttonRow(r, y, hoverId, [idA, labelA], [idB, labelB]) {
  const wa = buttonWidth(r, labelA);
  const wb = buttonWidth(r, labelB);
  const gap = 8;
  const left = (r.W - wa - wb - gap) / 2;
  return [
    button(r, idA, labelA, left + wa / 2, y, wa, hoverId, true),
    button(r, idB, labelB, left + wa + gap + wb / 2, y, wb, hoverId, false),
  ];
}

function easeOutBounce(p) {
  const n = 7.5625;
  const d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
}

const INTRO_STAGGER = 0.07;
const INTRO_DROP = 0.7;

// time: null = static; otherwise letters drop in one by one, then bob.
function title(r, str, y, size, time, colors) {
  const o = { family: FONTS.ui, size, weight: 700, baseline: 'top', shadow: C.navy };
  const total = r.measure(str, size, o.family, o.weight);
  let x = (r.W - total) / 2;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    let dy = 0;
    if (time !== null) {
      const p = Math.min(1, Math.max(0, (time - i * INTRO_STAGGER) / INTRO_DROP));
      dy = p < 1 ? -(1 - easeOutBounce(p)) * (y + size + 8) : Math.round(Math.sin(time * 4 - i * 0.6) * 2);
    }
    r.text(ch, x, y + dy, { ...o, color: colors[i % colors.length] });
    x += r.measure(ch, size, o.family, o.weight);
  }
}

// Segmented language picker; each option is labelled in its own language.
function languageRow(r, y, lang, langs, hoverId) {
  const gap = 6;
  const widths = langs.map((l) => buttonWidth(r, tIn(l, 'langName')));
  let x = (r.W - widths.reduce((a, b) => a + b, 0) - gap * (langs.length - 1)) / 2;
  return langs.map((l, i) => {
    const b = button(r, `lang:${l}`, tIn(l, 'langName'), x + widths[i] / 2, y, widths[i], hoverId, l === lang);
    x += widths[i] + gap;
    return b;
  });
}

export function drawStart(r, { best, hoverId, time, touch, lang, langs }) {
  const big = r.W >= 300;
  const titleSize = big ? 24 : 16;
  let y = Math.round(r.H * (big ? 0.16 : 0.22));
  title(r, t('title'), y, titleSize, time, TITLE_COLORS);
  y += titleSize + 10;

  y = paragraph(r, t('tagline'), y, { family: FONTS.word, size: 8, color: C.white, shadow: C.navy });
  y += 12;

  const label = t('play');
  const play = button(r, 'play', label, r.W / 2, y, buttonWidth(r, label) + 16, hoverId, true);
  y += BTN_H + 6;
  if (!touch) {
    r.text(t('pressEnter'), r.W / 2, y, { family: FONTS.word, size: 7, color: C.white, shadow: C.navy, align: 'center', baseline: 'top' });
    y += 12;
  }
  y += 4;

  const langButtons = languageRow(r, y, lang, langs, hoverId);
  y += BTN_H + 8;

  if (best.score > 0) {
    // On a plate so it stays readable over the town.
    const label = t('best', { score: best.score, wpm: best.wpm });
    const w = Math.ceil(r.measure(label, 8, FONTS.ui)) + 10;
    r.rect(Math.round((r.W - w) / 2), y - 3, w, 13, C.navy);
    r.text(label, r.W / 2, y, { family: FONTS.ui, size: 8, color: C.yellow, align: 'center', baseline: 'top' });
  }

  r.text(t(touch ? 'controlsTouch' : 'controls'), r.W / 2, r.H - GROUND_H / 2 + 2, {
    family: FONTS.word,
    size: 7,
    color: C.white,
    shadow: C.navy,
    align: 'center',
    baseline: 'middle',
  });

  return [play, ...langButtons];
}

export function drawPause(r, { hoverId }) {
  r.rect(0, 0, r.W, r.H, DIM);
  const y = Math.round(r.H / 2 - 24);
  title(r, t('paused'), y, 16, null, [C.white]);
  return buttonRow(r, y + 30, hoverId, ['resume', t('resume')], ['menu', t('menu')]);
}

// The panel waits `reveal` seconds so the final hit (and the sad mascot) registers first.
export function drawGameOver(r, { result, best, hoverId, time, reveal }) {
  if (time < reveal) return [];
  r.rect(0, 0, r.W, r.H, DIM);

  const rows = [
    [t('statScore'), String(result.score), result.newBestScore],
    [t('statAvgWpm'), result.avgWpm === null ? '--' : String(Math.round(result.avgWpm)), result.newBestWpm],
    [t('statPeakWpm'), result.peakWpm === null ? '--' : String(Math.round(result.peakWpm)), false],
    [t('statAccuracy'), `${Math.floor(result.accuracy * 100)}%`, false],
    [t('statWords'), String(result.words), false],
  ];
  const rowH = 12;
  const blockH = 16 + 10 + 12 + rows.length * rowH + 8 + 12 + 8 + BTN_H;
  let y = Math.max(8, Math.round((r.H - blockH) / 2));

  title(r, t('gameOver'), y, 16, null, [C.red, C.pink]);
  y += 16 + 10;

  const newBest = result.newBestScore || result.newBestWpm;
  if (newBest && Math.floor(time * 3) % 2 === 0) {
    r.text(t('newBest'), r.W / 2, y, { family: FONTS.ui, size: 8, color: C.yellow, shadow: C.navy, align: 'center', baseline: 'top' });
  }
  y += 12;

  const panelW = Math.min(r.W - 24, 180);
  const px = Math.round((r.W - panelW) / 2);
  r.rect(px - 1, y - 5, panelW + 2, rows.length * rowH + 8, C.navy);
  r.rect(px, y - 4, panelW, rows.length * rowH + 6, C.white);
  for (const [label, value, highlight] of rows) {
    const o = { family: FONTS.ui, size: 8, baseline: 'top' };
    r.text(label, px + 6, y, { ...o, color: C.navy });
    r.text(value, px + panelW - 6, y, { ...o, color: highlight ? C.red : C.navy, align: 'right' });
    y += rowH;
  }
  y += 8;

  r.text(t('best', { score: best.score, wpm: best.wpm }), r.W / 2, y, {
    family: FONTS.ui,
    size: 8,
    color: C.yellow,
    shadow: C.navy,
    align: 'center',
    baseline: 'top',
  });
  y += 12 + 8;

  return buttonRow(r, y, hoverId, ['again', t('playAgain')], ['menu', t('menu')]);
}
