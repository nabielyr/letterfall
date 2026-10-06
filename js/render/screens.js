import { C, FONTS, GROUND_H, LEADERBOARD } from '../config.js';
import { t, tIn } from '../i18n/index.js';

// Canvas-drawn menus. Each draw function returns its buttons
// ({ id, x, y, w, h }) so the game can hit-test pointer clicks.

const TITLE_COLORS = [C.yellow, C.orange, C.pink, C.green, C.white];
const BTN_H = 18;
const SMALL_H = 14;
const CORNER = 4;
const DIM = 'rgba(29, 43, 83, 0.72)'; // navy veil over the frozen playfield
const UI = { family: FONTS.ui, size: 8, baseline: 'top' };

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

function centered(r, str, y, color, o = {}) {
  r.text(str, r.W / 2, y, { ...UI, color, shadow: C.navy, align: 'center', ...o });
}

function button(r, id, label, cx, y, w, hoverId, primary, h = BTN_H) {
  const hovered = hoverId === id;
  const x = Math.round(cx - w / 2);
  const lift = hovered ? -1 : 0;
  r.rect(x, y + 2, w, h, C.navy); // drop shadow
  r.rect(x, y + lift, w, h, C.navy);
  const fill = primary ? (hovered ? C.yellow : C.orange) : hovered ? C.white : C.silver;
  r.rect(x + 1, y + 1 + lift, w - 2, h - 2, fill);
  r.text(label, x + w / 2, y + lift + h / 2 + 1, { ...UI, color: C.navy, align: 'center', baseline: 'middle' });
  return { id, x, y, w, h };
}

function buttonWidth(r, label, min = 56, pad = 20) {
  return Math.max(min, Math.ceil(r.measure(label, 8, FONTS.ui)) + pad);
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

// A row of options where the selected one is highlighted.
// items: [{ id, label, selected }]; x: left edge, or null to center.
function segmented(r, items, x, y, hoverId, h, minW) {
  const gap = 4;
  const widths = items.map((it) => buttonWidth(r, it.label, minW, 12));
  let left = x ?? (r.W - widths.reduce((a, b) => a + b, 0) - gap * (items.length - 1)) / 2;
  return items.map((it, i) => {
    const b = button(r, it.id, it.label, left + widths[i] / 2, y, widths[i], hoverId, it.selected, h);
    left += widths[i] + gap;
    return b;
  });
}

function topRightButton(r, hoverId) {
  const label = t('top10');
  const w = buttonWidth(r, label, 0, 12);
  return button(r, 'leaderboard', label, r.W - CORNER - w / 2, CORNER, w, hoverId, false, SMALL_H);
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

// Top-10 table. view: { entries, loading, loaded }. Returns the y below it.
const ROW_H = 10;
const BOARD_H = ROW_H * (LEADERBOARD.size + 1) + 8;

function boardPanel(r, y, view, highlightId, time) {
  const panelW = Math.min(r.W - 16, 230);
  const px = Math.round((r.W - panelW) / 2);
  r.rect(px - 1, y - 1, panelW + 2, BOARD_H + 2, C.navy);
  r.rect(px, y, panelW, BOARD_H, C.white);

  const cols = [
    { x: px + 16, align: 'right' }, // rank
    { x: px + 22, align: 'left' }, // name
    { x: px + panelW - 40, align: 'right' }, // score
    { x: px + panelW - 6, align: 'right' }, // wpm
  ];
  let rowY = y + 5;
  t('boardHeader')
    .split(',')
    .forEach((label, i) => r.text(label, cols[i].x, rowY, { ...UI, color: C.grey, align: cols[i].align }));
  rowY += ROW_H;

  if (!view.entries.length) {
    const msg = view.loading && !view.loaded ? t('loading') : t('boardEmpty');
    r.text(msg, px + panelW / 2, y + BOARD_H / 2, { ...UI, color: C.grey, align: 'center', baseline: 'middle' });
  }
  view.entries.forEach((e, i) => {
    const mine = highlightId && e.id === highlightId;
    if (mine) r.rect(px + 2, rowY - 2, panelW - 4, ROW_H, Math.floor(time * 4) % 2 ? C.yellow : C.peach);
    const color = i === 0 ? C.red : C.navy;
    const cells = [String(i + 1), e.name, String(e.score), String(e.wpm)];
    cells.forEach((cell, c) => r.text(cell, cols[c].x, rowY, { ...UI, color, align: cols[c].align }));
    rowY += ROW_H;
  });
  return y + BOARD_H;
}

const boardSource = (view, lang) => `${t(view.source === 'online' ? 'boardOnline' : 'boardLocal')} · ${tIn(lang, 'langShort')}`;

export function drawStart(r, { best, hoverId, time, touch, lang, langs, difficulty, difficulties }) {
  // Corners: language (top-left), leaderboard (top-right).
  const langButtons = segmented(
    r,
    langs.map((l) => ({ id: `lang:${l}`, label: tIn(l, 'langShort'), selected: l === lang })),
    CORNER,
    CORNER,
    hoverId,
    SMALL_H,
    24,
  );
  const board = topRightButton(r, hoverId);

  const big = r.W >= 300;
  const titleSize = big ? 24 : 16;
  let y = Math.max(CORNER + SMALL_H + 10, Math.round(r.H * (big ? 0.15 : 0.2)));
  title(r, t('title'), y, titleSize, time, TITLE_COLORS);
  y += titleSize + 8;

  y = paragraph(r, t('tagline'), y, { family: FONTS.word, size: 8, color: C.white, shadow: C.navy });
  y += 8;

  const diffButtons = segmented(
    r,
    difficulties.map((d) => ({ id: `diff:${d}`, label: t(`diff_${d}`), selected: d === difficulty })),
    null,
    y,
    hoverId,
    16,
    48,
  );
  y += 16 + 8;

  const label = t('play');
  const play = button(r, 'play', label, r.W / 2, y, buttonWidth(r, label) + 16, hoverId, true);
  y += BTN_H + 5;
  if (!touch) {
    r.text(t('pressEnter'), r.W / 2, y, { family: FONTS.word, size: 7, color: C.white, shadow: C.navy, align: 'center', baseline: 'top' });
    y += 11;
  }
  y += 3;

  if (best.score > 0) {
    // On a plate so it stays readable over the town.
    const text = t('best', { score: best.score, wpm: best.wpm });
    const w = Math.ceil(r.measure(text, 8, FONTS.ui)) + 10;
    r.rect(Math.round((r.W - w) / 2), y - 3, w, 13, C.navy);
    r.text(text, r.W / 2, y, { ...UI, color: C.yellow, align: 'center' });
  }

  r.text(t(touch ? 'controlsTouch' : 'controls'), r.W / 2, r.H - GROUND_H / 2 + 2, {
    family: FONTS.word,
    size: 7,
    color: C.white,
    shadow: C.navy,
    align: 'center',
    baseline: 'middle',
  });

  return [play, board, ...langButtons, ...diffButtons];
}

// Browsing the boards from the start screen; tabs switch difficulty.
export function drawLeaderboard(r, { view, difficulty, difficulties, lang, hoverId, time }) {
  r.rect(0, 0, r.W, r.H, DIM);
  const blockH = 20 + 12 + 20 + BOARD_H + 8 + BTN_H;
  let y = Math.max(CORNER, Math.round((r.H - blockH) / 2) - 8);

  title(r, t('leaderboard'), y, 16, null, [C.yellow, C.orange]);
  y += 20;
  centered(r, boardSource(view, lang), y, C.silver);
  y += 12;
  const tabs = segmented(
    r,
    difficulties.map((d) => ({ id: `tab:${d}`, label: t(`diff_${d}`), selected: d === difficulty })),
    null,
    y,
    hoverId,
    SMALL_H,
    44,
  );
  y += SMALL_H + 6;
  y = boardPanel(r, y, view, null, time) + 8;
  const label = t('back');
  return [...tabs, button(r, 'back', label, r.W / 2, y, buttonWidth(r, label), hoverId, true)];
}

export function drawPause(r, { hoverId }) {
  r.rect(0, 0, r.W, r.H, DIM);
  const y = Math.round(r.H / 2 - 24);
  title(r, t('paused'), y, 16, null, [C.white]);
  return buttonRow(r, y + 30, hoverId, ['resume', t('resume')], ['menu', t('menu')]);
}

// Game over runs through phases (result.phase):
//   'entry'  → made the top 10: type a name   'saving' → waiting for the server
//   'board'  → the top 10 with your row lit   'stats'  → didn't qualify (or skipped)
// The panel waits `reveal` seconds so the final hit (and the sad mascot) registers first.
export function drawGameOver(r, ui) {
  const { result, time, reveal } = ui;
  if (time < reveal) return [];
  r.rect(0, 0, r.W, r.H, DIM);
  if (result.phase === 'board') return drawResultBoard(r, ui);

  const { best, hoverId, name, lang } = ui;
  const entering = result.phase === 'entry' || result.phase === 'saving';
  const rows = [
    [t('statScore'), String(result.score), result.newBestScore],
    [t('statAvgWpm'), result.avgWpm === null ? '--' : String(Math.round(result.avgWpm)), result.newBestWpm],
    [t('statPeakWpm'), result.peakWpm === null ? '--' : String(Math.round(result.peakWpm)), false],
    [t('statAccuracy'), `${Math.floor(result.accuracy * 100)}%`, false],
    [t('statWords'), String(result.words), false],
  ];
  const rowH = 12;
  const tail = entering ? 12 + 16 + 8 + BTN_H : 12 + 8 + BTN_H;
  const blockH = 16 + 8 + 12 + rows.length * rowH + 8 + tail;
  let y = Math.max(CORNER + SMALL_H + 4, Math.round((r.H - blockH) / 2));

  title(r, t('gameOver'), y, 16, null, [C.red, C.pink]);
  y += 16 + 8;

  if ((result.newBestScore || result.newBestWpm) && Math.floor(time * 3) % 2 === 0) centered(r, t('newBest'), y, C.yellow);
  y += 12;

  const panelW = Math.min(r.W - 24, 180);
  const px = Math.round((r.W - panelW) / 2);
  r.rect(px - 1, y - 5, panelW + 2, rows.length * rowH + 8, C.navy);
  r.rect(px, y - 4, panelW, rows.length * rowH + 6, C.white);
  for (const [label, value, highlight] of rows) {
    r.text(label, px + 6, y, { ...UI, color: C.navy });
    r.text(value, px + panelW - 6, y, { ...UI, color: highlight ? C.red : C.navy, align: 'right' });
    y += rowH;
  }
  y += 8;

  if (!entering) {
    centered(r, t('best', { score: best.score, wpm: best.wpm }), y, C.yellow);
    y += 12 + 8;
    return [topRightButton(r, hoverId), ...buttonRow(r, y, hoverId, ['again', t('playAgain')], ['menu', t('menu')])];
  }

  // Name entry.
  centered(r, `${t('enterName')} · ${tIn(lang, 'langShort')}`, y, C.yellow);
  y += 12;
  const boxW = 110;
  const bx = Math.round((r.W - boxW) / 2);
  r.rect(bx - 1, y - 1, boxW + 2, 18, C.navy);
  r.rect(bx, y, boxW, 16, C.white);
  if (result.phase === 'saving') {
    r.text(t('saving'), r.W / 2, y + 9, { ...UI, color: C.grey, align: 'center', baseline: 'middle' });
    return [];
  }
  const cursor = name.length < LEADERBOARD.nameMax && Math.floor(time * 2.5) % 2 === 0 ? '_' : ' ';
  r.text(name + cursor, r.W / 2, y + 9, { ...UI, color: C.navy, align: 'center', baseline: 'middle' });
  y += 16 + 8;
  return buttonRow(r, y, hoverId, ['save', t('save')], ['skip', t('skip')]);
}

function drawResultBoard(r, { result, hoverId, time, lang, view }) {
  const notice = result.notice ? t(result.notice === 'offline' ? 'noticeOffline' : 'noticeRejected') : null;
  const blockH = 16 + 6 + 12 + BOARD_H + 4 + 12 + 2 + BTN_H;
  let y = Math.max(CORNER, Math.round((r.H - blockH) / 2) - 6);

  title(r, t('gameOver'), y, 16, null, [C.red, C.pink]);
  y += 16 + 6;
  if (result.rank) centered(r, t('yourRank', { rank: result.rank }), y, Math.floor(time * 4) % 2 ? C.yellow : C.orange);
  else centered(r, t('notRanked'), y, C.white);
  y += 12;

  y = boardPanel(r, y, view, result.entryId, time) + 4;
  if (notice) centered(r, notice, y, C.pink, { family: FONTS.word, size: 7 });
  else centered(r, boardSource(view, lang), y, C.silver, { family: FONTS.word, size: 7 });
  y += 12 + 2;
  return buttonRow(r, y, hoverId, ['again', t('playAgain')], ['menu', t('menu')]);
}
