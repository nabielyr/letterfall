import { C, DIFFICULTY, GROUND_H, WORD, FONTS, RULES, SCORE, THEMES, MASCOT, FX, POWERUP } from './config.js';
import { difficultyAt, pickWord, pickX, rand } from './spawner.js';
import { typeChar, releaseTarget } from './targeting.js';
import { createStats } from './stats.js';
import { rollPower, POWERS } from './powerups.js';
import { loadBest, saveBest, saveLang, saveMuted } from './storage.js';
import { setLang, LANGS, t } from './i18n/index.js';
import { createBackground, themeForLevel } from './render/background.js';
import { createMascot } from './render/mascot.js';
import { createTransition } from './render/transition.js';
import { drawWord } from './render/entities.js';
import { drawHud, drawMuteButton } from './render/hud.js';
import { drawStart, drawPause, drawGameOver } from './render/screens.js';
import { createParticles } from './fx/particles.js';
import { createPopups } from './fx/popups.js';

const BURST = { drop: 'splash', meteor: 'fire', balloon: 'confetti' };
const RAINBOW = [C.yellow, C.orange, C.pink, C.green, C.blue];

// Modes: 'start' → 'playing' ⇄ 'paused' → 'gameover' → 'playing' | 'start'
export function createGame({ renderer, wordLists, lang, audio, startTime = 0, touch = false }) {
  const r = renderer;
  const stats = createStats();
  const bg = createBackground();
  const mascot = createMascot();
  const transition = createTransition();
  const particles = createParticles();
  const popups = createPopups();
  bg.resize(r.W, r.H);

  const game = {
    mode: 'start',
    modeTime: 0,
    clock: 0, // always running; drives ambient animation
    lang,
    time: 0,
    words: [],
    target: null,
    spawnTimer: 0,
    diff: difficultyAt(0),
    score: 0,
    combo: 0,
    maxCombo: 0,
    lives: RULES.lives,
    slowTime: 0,
    shakeTime: 0,
    shakeMag: 0,
    flashTime: 0,
    flashColor: C.red,
    best: loadBest(lang),
    result: null,
    buttons: [],
    hover: null,
    lastEvent: '',
  };

  const multiplier = (combo) =>
    Math.min(SCORE.maxMultiplier, 1 + Math.floor(combo / SCORE.comboStep) * SCORE.comboBonus);
  const groundY = () => r.H - GROUND_H;
  // More particles as the combo climbs.
  const hype = () => (game.combo >= FX.hypeCombo[1] ? 3 : game.combo >= FX.hypeCombo[0] ? 2 : 1);

  // A weaker shake never cuts a stronger one short.
  function shake(mag) {
    game.shakeMag = Math.max(mag, game.shakeTime > 0 ? game.shakeMag : 0);
    game.shakeTime = FX.shakeTime;
  }

  function flash(color) {
    game.flashTime = FX.flashTime;
    game.flashColor = color;
  }

  function setMode(mode) {
    game.mode = mode;
    game.modeTime = 0;
    game.hover = null;
  }

  function setLanguage(next) {
    if (next === game.lang || !wordLists[next]) return;
    game.lang = next;
    setLang(next);
    saveLang(next);
    game.best = loadBest(next);
    audio.click();
  }

  function toggleMute() {
    audio.setMuted(!audio.muted);
    saveMuted(audio.muted);
    audio.click();
  }

  function clearEffects() {
    particles.clear();
    popups.clear();
    game.slowTime = 0;
    game.shakeTime = 0;
    game.flashTime = 0;
  }

  function startRun() {
    stats.reset();
    clearEffects();
    game.time = startTime;
    game.words.length = 0;
    game.target = null;
    game.spawnTimer = 0.6;
    game.score = 0;
    game.combo = 0;
    game.maxCombo = 0;
    game.lives = RULES.lives;
    game.result = null;
    difficultyAt(game.time, game.diff);
    bg.setTheme(themeForLevel(game.diff.level), true);
    mascot.reset();
    setMode('playing');
    audio.start();
  }

  function endRun() {
    const avg = stats.avgWpm();
    const avgRounded = avg === null ? null : Math.round(avg);
    const result = {
      score: game.score,
      avgWpm: avg,
      peakWpm: stats.peakWpm,
      accuracy: stats.accuracy(),
      words: stats.words,
      maxCombo: game.maxCombo,
      newBestScore: game.score > game.best.score,
      newBestWpm: avgRounded !== null && avgRounded > game.best.wpm,
    };
    if (result.newBestScore) game.best.score = game.score;
    if (result.newBestWpm) game.best.wpm = avgRounded;
    if (result.newBestScore || result.newBestWpm) saveBest(game.lang, game.best);
    game.result = result;
    game.target = null;
    game.slowTime = 0;
    mascot.defeat();
    setMode('gameover');
    audio.gameOver();
  }

  function toMenu() {
    game.words.length = 0;
    game.target = null;
    clearEffects();
    bg.setTheme('day', true);
    mascot.reset();
    setMode('start');
  }

  function pause() {
    if (game.mode === 'playing') setMode('paused');
  }

  function resume() {
    if (game.mode === 'paused') setMode('playing');
  }

  function spawn() {
    const text = pickWord(wordLists[game.lang], game.diff.tierWeights, game.words);
    const w = Math.ceil(r.measure(text, WORD.fontSize, FONTS.word)) + WORD.padX * 2;
    const power = rollPower(game.diff.level, game.lives);
    const jitter = 1 + rand(-DIFFICULTY.fallJitter, DIFFICULTY.fallJitter);
    game.words.push({
      text,
      style: power ? 'balloon' : game.diff.level >= THEMES.duskLevel ? 'meteor' : 'drop',
      power,
      seed: Math.random() * 10,
      x: pickX(w, r.W, game.words),
      y: -WORD.height - WORD.headroom,
      w,
      h: WORD.height,
      p: 0, // fall progress: 0 = just above the screen, 1 = touching the ground
      fallTime: game.diff.fallTime * jitter * (power ? POWERUP.fallTimeFactor : 1),
      typed: 0,
      errors: 0,
      shake: 0,
    });
  }

  function removeWord(word) {
    const i = game.words.indexOf(word);
    if (i > -1) game.words.splice(i, 1);
    if (game.target === word) game.target = null;
  }

  const centerOf = (w) => ({ x: w.x + w.w / 2, y: w.y + w.h / 2 });

  function applyPower(power, at) {
    audio.power();
    popups.add(t(POWERS[power].popup), at.x, at.y - 14, { color: RAINBOW, size: 8, life: 1.2, rise: 24 });
    if (power === 'slow') {
      game.slowTime = POWERUP.slowTime;
    } else if (power === 'life') {
      game.lives = Math.min(RULES.maxLives, game.lives + 1);
      particles.burst('heart', r.W / 2, 8, 0, 1);
    } else if (power === 'bomb') {
      audio.bomb();
      shake(FX.bombShake);
      flash(C.white);
      for (const w of [...game.words]) {
        const c = centerOf(w);
        particles.burst(BURST[w.style], c.x, c.y, w.w, 1);
        if (w.style !== 'balloon') {
          const points = Math.round(w.text.length * SCORE.perLetter * POWERUP.bombScoreFactor);
          game.score += points;
          popups.add(`+${points}`, c.x, c.y, { color: C.white, life: 0.7 });
        }
        removeWord(w);
      }
    }
  }

  function completeWord(word) {
    game.combo++;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    const perfect = word.errors === 0;
    const points = Math.round(
      word.text.length * SCORE.perLetter * multiplier(game.combo) * (perfect ? 1 + SCORE.perfectBonus : 1),
    );
    game.score += points;
    stats.addWord();
    removeWord(word);
    mascot.cheer(game.combo);

    const c = centerOf(word);
    particles.burst(BURST[word.style], c.x, c.y, word.w, hype());
    audio.destroy(word.style);
    if (word.style === 'meteor') shake(FX.meteorShake);
    popups.add(`+${points}`, c.x, c.y, { color: perfect ? C.yellow : C.white });
    if (perfect && word.text.length >= FX.perfectMinLength) {
      popups.add(t('popPerfect'), c.x, c.y + 10, { color: C.green, life: 1, rise: 14 });
    }
    if (game.combo % FX.comboMilestone === 0) {
      popups.add(t('popCombo', { n: game.combo }), r.W / 2, r.H * 0.38, {
        color: RAINBOW,
        size: game.combo >= FX.hypeCombo[0] ? 16 : 8,
        life: 1.1,
        rise: 12,
      });
      audio.combo();
    }
    if (word.power) applyPower(word.power, c);
    game.lastEvent = `+${points}${perfect ? ' perfect' : ''} (${word.text})`;
  }

  function wordLanded(word) {
    const c = centerOf(word);
    removeWord(word);
    // Balloons just float away; only real words cost a life.
    if (word.style === 'balloon') {
      particles.burst('confetti', c.x, groundY() - 4, word.w, 0.4);
      return;
    }
    particles.burst('dust', c.x, groundY() - 2, word.w, 1);
    game.lives--;
    game.combo = 0;
    mascot.hurt();
    shake(FX.hurtShake);
    flash(C.red);
    audio.hurt();
    game.lastEvent = `lost a life (${word.text})`;
    if (game.lives <= 0) endRun();
  }

  // ---- input ----

  const canAct = () => !transition.covering;
  const gameOverReady = () => game.modeTime > RULES.gameOverInputDelay;

  function onChar(ch) {
    if (game.mode !== 'playing' || !canAct()) return;
    const res = typeChar(game, ch);
    if (res.kind === 'wrong' || res.kind === 'miss') {
      stats.addWrong();
      game.combo = 0;
      audio.wrong();
      if (res.word) {
        const c = centerOf(res.word);
        particles.burst('spark', c.x, c.y, res.word.w * 0.6, 1);
      }
      game.lastEvent = `${ch} → ${res.kind}`;
      return;
    }
    stats.addCorrect();
    if (res.kind === 'complete') {
      completeWord(res.word);
      return;
    }
    const w = res.word;
    audio.type(w.typed / w.text.length);
    const letterX = w.x + WORD.padX + (w.typed / w.text.length) * (w.w - WORD.padX * 2);
    particles.burst('chip', letterX, w.y + 4, 0, 1);
  }

  function onBackspace() {
    if (game.mode === 'playing') releaseTarget(game);
  }

  function onEscape() {
    if (!canAct()) return;
    if (game.mode === 'playing') pause();
    else if (game.mode === 'paused') resume();
  }

  function onEnter() {
    if (!canAct()) return;
    if (game.mode === 'start') transition.start(startRun);
    else if (game.mode === 'paused') resume();
    else if (game.mode === 'gameover' && gameOverReady()) transition.start(startRun);
  }

  function onArrow(dir) {
    if (game.mode !== 'start' || !canAct()) return;
    const i = LANGS.indexOf(game.lang);
    setLanguage(LANGS[(i + dir + LANGS.length) % LANGS.length]);
  }

  function buttonAt(x, y) {
    const b = game.buttons.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    return b ? b.id : null;
  }

  // Returns true when hovering a button (for the pointer cursor).
  function onPointerMove(x, y) {
    game.hover = buttonAt(x, y);
    return game.hover !== null;
  }

  function onClick(x, y) {
    const id = buttonAt(x, y);
    if (id === 'mute') {
      toggleMute();
      return;
    }
    if (!id || !canAct()) return;
    if (id.startsWith('lang:')) {
      setLanguage(id.slice(5));
      return;
    }
    switch (id) {
      case 'play':
        transition.start(startRun);
        break;
      case 'resume':
        resume();
        break;
      case 'menu':
        audio.click();
        transition.start(toMenu);
        break;
      case 'again':
        if (gameOverReady()) transition.start(startRun);
        break;
      default:
        break;
    }
  }

  // ---- loop ----

  function update(dt) {
    game.clock += dt;
    game.modeTime += dt;
    transition.update(dt);
    bg.update(dt);

    const gy = groundY();
    const danger =
      game.mode === 'playing' && game.words.some((w) => w.style !== 'balloon' && w.y + w.h > gy * MASCOT.dangerLine);
    mascot.update(dt, danger);

    if (game.mode !== 'paused') {
      particles.update(dt);
      popups.update(dt);
      game.flashTime = Math.max(0, game.flashTime - dt);
      game.shakeTime = Math.max(0, game.shakeTime - dt);
    }
    const s = game.shakeTime > 0 ? game.shakeMag * (game.shakeTime / FX.shakeTime) : 0;
    r.shakeX = s ? rand(-s, s) : 0;
    r.shakeY = s ? rand(-s, s) : 0;

    if (game.mode !== 'playing') return;

    stats.update(dt);
    game.time += dt;
    difficultyAt(game.time, game.diff);
    const theme = themeForLevel(game.diff.level);
    if (theme !== bg.theme) bg.setTheme(theme);

    // Slow-mo stretches the world, not the clock: WPM still uses real time.
    game.slowTime = Math.max(0, game.slowTime - dt);
    const worldDt = game.slowTime > 0 ? dt * POWERUP.slowFactor : dt;

    game.spawnTimer -= worldDt;
    if (game.spawnTimer <= 0 && game.words.length < game.diff.maxWords) {
      spawn();
      game.spawnTimer = game.diff.spawnInterval * (1 + rand(-DIFFICULTY.spawnJitter, DIFFICULTY.spawnJitter));
    }

    const top = -WORD.height - WORD.headroom;
    for (let i = game.words.length - 1; i >= 0; i--) {
      const w = game.words[i];
      w.p += worldDt / w.fallTime;
      w.y = top + w.p * (gy - w.h - top);
      if (w.shake > 0) w.shake = Math.max(0, w.shake - dt);
      if (w.p >= 1) {
        wordLanded(w);
        if (game.mode !== 'playing') return;
      }
    }
  }

  function draw() {
    bg.draw(r);
    mascot.draw(r, r.W / 2, groundY());

    if (game.mode !== 'start') {
      for (const w of game.words) {
        if (w !== game.target) drawWord(r, w, false, game.clock);
      }
      if (game.target) drawWord(r, game.target, true, game.clock);
    }
    particles.draw(r);

    if (game.slowTime > 0) r.rect(0, 0, r.W, r.H, 'rgba(29, 43, 83, 0.22)');
    if (game.flashTime > 0) {
      const a = (game.flashTime / FX.flashTime) * 0.35;
      r.rect(0, 0, r.W, r.H, game.flashColor === C.white ? `rgba(255,241,232,${a})` : `rgba(255,0,77,${a})`);
    }
    popups.draw(r);

    if (game.mode === 'playing' || game.mode === 'paused') {
      drawHud(r, {
        score: game.score,
        combo: game.combo,
        mult: multiplier(game.combo),
        lives: game.lives,
        wpm: stats.avgWpm(),
        accuracy: stats.accuracy(),
        level: game.diff.level,
        slow: game.slowTime / POWERUP.slowTime,
        time: game.clock,
      });
    }

    const ui = { best: game.best, hoverId: game.hover, time: game.modeTime, touch, lang: game.lang, langs: LANGS };
    if (game.mode === 'start') game.buttons = drawStart(r, ui);
    else if (game.mode === 'paused') game.buttons = drawPause(r, ui);
    else if (game.mode === 'gameover') {
      game.buttons = drawGameOver(r, { ...ui, result: game.result, reveal: RULES.gameOverReveal });
    } else game.buttons = [];
    game.buttons.push(drawMuteButton(r, audio.muted, game.hover === 'mute'));

    transition.draw(r);
  }

  // Orientation flips and keyboard show/hide change W/H.
  r.onResize = (oldW, oldH, W, H) => {
    bg.resize(W, H);
    for (const w of game.words) {
      w.x = Math.min(Math.max(WORD.edgeMargin, (w.x / oldW) * W), W - WORD.edgeMargin - w.w);
    }
  };

  function debugInfo() {
    const d = game.diff;
    const peak = stats.peakWpm === null ? '--' : stats.peakWpm.toFixed(1);
    return [
      `mode ${game.mode}  ${game.lang}  view ${r.W}x${r.H} @${r.scale}x`,
      `time ${game.time.toFixed(1)}s  play ${stats.time.toFixed(1)}s  lvl ${d.level}  ${bg.theme}`,
      `words ${game.words.length}/${d.maxWords}  fall ${d.fallTime.toFixed(2)}s`,
      `spawn ${d.spawnInterval.toFixed(2)}s  tiers ${d.tierWeights.map((v) => Math.round(v)).join('/')}`,
      `ok ${stats.correct} bad ${stats.wrong} roll ${stats.rollingWpm().toFixed(1)} peak ${peak}`,
      `particles ${particles.count}  popups ${popups.count}  slow ${game.slowTime.toFixed(1)}`,
      `target ${game.target ? game.target.text : '-'}  mascot ${mascot.mood}`,
      game.lastEvent,
    ];
  }

  return {
    state: game,
    stats,
    particles,
    update,
    draw,
    pause,
    onChar,
    onBackspace,
    onEscape,
    onEnter,
    onArrow,
    onPointerMove,
    onClick,
    debugInfo,
  };
}
