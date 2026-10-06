import { C, DIFFICULTY, DIFFICULTIES, GROUND_H, WORD, FONTS, RULES, SCORE, THEMES, MASCOT, FX, POWERUP, LEADERBOARD } from './config.js';
import { difficultyAt, pickWord, pickX, rand } from './spawner.js';
import { typeChar, releaseTarget } from './targeting.js';
import { createStats } from './stats.js';
import { rollPower, POWERS } from './powerups.js';
import { loadBest, saveBest, saveLang, saveMuted, saveMusic, saveDifficulty, loadName, saveName } from './storage.js';
import { setLang, LANGS, t } from './i18n/index.js';
import { createBackground, themeAt } from './render/background.js';
import { createMascot } from './render/mascot.js';
import { createTransition } from './render/transition.js';
import { drawWord } from './render/entities.js';
import { drawHud, drawMuteButton, drawMusicButton } from './render/hud.js';
import { drawStart, drawPause, drawGameOver, drawLeaderboard } from './render/screens.js';
import { createParticles } from './fx/particles.js';
import { createPopups } from './fx/popups.js';

const BURST = { drop: 'splash', meteor: 'fire', star: 'stardust', balloon: 'confetti' };
const RAINBOW = [C.yellow, C.orange, C.pink, C.green, C.blue];

// Modes: 'start' → 'playing' ⇄ 'paused' → 'gameover' → 'playing' | 'start'
//        'start' | 'gameover' ⇄ 'leaderboard'
// ranked: false for debug runs (?level=N), which never reach the leaderboard.
export function createGame({ renderer, wordLists, lang, difficulty, audio, leaderboard: lb, ranked = true, startTime = 0, touch = false }) {
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
    difficulty,
    viewDifficulty: difficulty, // tab shown on the leaderboard screen
    returnMode: 'start', // where the leaderboard screen goes back to
    time: 0,
    words: [],
    target: null,
    spawnTimer: 0,
    diff: difficultyAt(0, difficulty),
    score: 0,
    combo: 0,
    maxCombo: 0,
    lives: RULES.lives,
    slowTime: 0,
    shakeTime: 0,
    shakeMag: 0,
    flashTime: 0,
    flashColor: C.red,
    best: loadBest(lang, difficulty),
    result: null,
    phaseTime: 0, // time in the current game-over phase
    name: '', // name being typed for the leaderboard
    runId: 0,
    runToken: null,
    buttons: [],
    hover: null,
    lastEvent: '',
  };

  const multiplier = (combo) =>
    Math.min(SCORE.maxMultiplier, 1 + Math.floor(combo / SCORE.comboStep) * SCORE.comboBonus);
  const groundY = () => r.H - GROUND_H;
  const boardId = (d = game.difficulty) => `${d}:${game.lang}`;
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
    // Music everywhere except game over (its jingle plays instead); quieter while paused.
    audio.setMusicMode(mode !== 'gameover', mode === 'paused');
  }
  audio.setMusicMode(true);

  function setLanguage(next) {
    if (next === game.lang || !wordLists[next]) return;
    game.lang = next;
    setLang(next);
    saveLang(next);
    game.best = loadBest(next, game.difficulty);
    lb.refresh(boardId());
    audio.click();
  }

  function setDifficulty(next) {
    if (next === game.difficulty || !DIFFICULTIES.includes(next)) return;
    game.difficulty = next;
    saveDifficulty(next);
    game.best = loadBest(game.lang, next);
    lb.refresh(boardId());
    audio.click();
  }

  const cycle = (list, current, dir) => list[(list.indexOf(current) + dir + list.length) % list.length];

  function toggleMusic() {
    audio.setMusicOn(!audio.musicOn);
    saveMusic(audio.musicOn);
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
    difficultyAt(game.time, game.difficulty, game.diff);
    bg.setTheme(themeAt(0), true);
    mascot.reset();
    setMode('playing');
    audio.start();

    // Ask the server to note the start time now; the token arrives in the background.
    const runId = ++game.runId;
    game.runToken = null;
    if (ranked) {
      lb.startRun(boardId()).then((token) => {
        if (game.runId === runId) game.runToken = token;
      });
      lb.refresh(boardId());
    }
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
    if (result.newBestScore || result.newBestWpm) saveBest(game.lang, game.difficulty, game.best);
    result.phase = ranked && lb.qualifies(boardId(), game.score) ? 'entry' : 'stats';
    game.name = loadName();
    game.phaseTime = 0;
    game.result = result;
    game.target = null;
    game.slowTime = 0;
    mascot.defeat();
    setMode('gameover');
    audio.gameOver();
  }

  function setPhase(phase) {
    game.result.phase = phase;
    game.phaseTime = 0;
  }

  function submitName() {
    const result = game.result;
    if (result.phase !== 'entry' || !game.name) return;
    setPhase('saving');
    saveName(game.name);
    audio.click();
    const runId = game.runId;
    lb.submit(boardId(), {
      name: game.name,
      score: result.score,
      chars: stats.correct,
      wrong: stats.wrong,
      words: stats.words,
      duration: Math.round(stats.time * 10) / 10,
      wpm: result.avgWpm === null ? 0 : Math.round(result.avgWpm),
      accuracy: Math.round(result.accuracy * 1000) / 1000,
      token: game.runToken,
    }).then((res) => {
      if (game.runId !== runId || game.result !== result) return;
      result.rank = res.rank;
      result.entryId = res.id;
      result.notice = res.notice;
      setPhase('board');
      if (res.rank) audio.power();
    });
  }

  function openLeaderboard() {
    game.returnMode = game.mode;
    game.viewDifficulty = game.difficulty;
    lb.refresh(boardId());
    audio.click();
    setMode('leaderboard');
  }

  function closeLeaderboard() {
    const back = game.returnMode;
    setMode(back);
    if (back === 'gameover') game.modeTime = RULES.gameOverInputDelay + 1; // skip the reveal again
    audio.click();
  }

  function viewTab(d) {
    if (!DIFFICULTIES.includes(d) || d === game.viewDifficulty) return;
    game.viewDifficulty = d;
    lb.refresh(boardId(d));
    audio.click();
  }

  function toMenu() {
    lb.refresh(boardId());
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
      style: power ? 'balloon' : THEMES.containers[bg.theme],
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
  // Game-over buttons wait a moment so a keystroke meant for the last word
  // doesn't skip the results; the same after the name is saved.
  const gameOverReady = () =>
    game.modeTime > RULES.gameOverInputDelay && (game.result.phase === 'stats' || game.phaseTime > 0.4);
  const typingName = () =>
    game.mode === 'gameover' && game.result.phase === 'entry' && game.modeTime > RULES.gameOverReveal;
  const LETTER = /^[a-z]$/;

  function onChar(ch) {
    if (!canAct()) return;
    if (typingName()) {
      if (game.name.length < LEADERBOARD.nameMax) game.name += ch.toUpperCase();
      return;
    }
    if (game.mode !== 'playing' || !LETTER.test(ch)) return;
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
    if (typingName()) game.name = game.name.slice(0, -1);
    else if (game.mode === 'playing') releaseTarget(game);
  }

  function onEscape() {
    if (!canAct()) return;
    if (game.mode === 'playing') pause();
    else if (game.mode === 'paused') resume();
    else if (game.mode === 'leaderboard') closeLeaderboard();
    else if (typingName()) setPhase('stats');
  }

  function onEnter() {
    if (!canAct()) return;
    if (game.mode === 'start') transition.start(startRun);
    else if (game.mode === 'paused') resume();
    else if (game.mode === 'leaderboard') closeLeaderboard();
    else if (typingName()) submitName();
    else if (game.mode === 'gameover' && game.result.phase !== 'saving' && gameOverReady()) transition.start(startRun);
  }

  // Start screen: ←→ difficulty, ↑↓ language. Leaderboard: ←→ difficulty tab.
  function onArrow(dir, axis) {
    if (!canAct()) return;
    if (game.mode === 'start') {
      if (axis === 'x') setDifficulty(cycle(DIFFICULTIES, game.difficulty, dir));
      else setLanguage(cycle(LANGS, game.lang, dir));
    } else if (game.mode === 'leaderboard' && axis === 'x') {
      viewTab(cycle(DIFFICULTIES, game.viewDifficulty, dir));
    }
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
    if (id === 'music') {
      toggleMusic();
      return;
    }
    if (!id || !canAct()) return;
    const [kind, value] = id.split(':');
    if (kind === 'lang') return setLanguage(value);
    if (kind === 'diff') return setDifficulty(value);
    if (kind === 'tab') return viewTab(value);
    switch (id) {
      case 'leaderboard':
        openLeaderboard();
        break;
      case 'back':
        closeLeaderboard();
        break;
      case 'save':
        submitName();
        break;
      case 'skip':
        if (game.result.phase === 'entry') setPhase('stats');
        break;
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
    game.phaseTime += dt;
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
    difficultyAt(game.time, game.difficulty, game.diff);
    audio.setMusicLevel(game.diff.level);
    const theme = themeAt(stats.time);
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
        difficulty: game.difficulty,
        slow: game.slowTime / POWERUP.slowTime,
        time: game.clock,
      });
    }

    const ui = {
      best: game.best,
      hoverId: game.hover,
      time: game.modeTime,
      touch,
      lang: game.lang,
      langs: LANGS,
      difficulty: game.difficulty,
      difficulties: DIFFICULTIES,
    };
    if (game.mode === 'start') game.buttons = drawStart(r, ui);
    else if (game.mode === 'paused') game.buttons = drawPause(r, ui);
    else if (game.mode === 'leaderboard') {
      game.buttons = drawLeaderboard(r, {
        ...ui,
        time: game.clock,
        difficulty: game.viewDifficulty,
        view: lb.view(boardId(game.viewDifficulty)),
      });
    } else if (game.mode === 'gameover') {
      game.buttons = drawGameOver(r, {
        ...ui,
        result: game.result,
        reveal: RULES.gameOverReveal,
        name: game.name,
        view: lb.view(boardId()),
      });
    } else game.buttons = [];
    game.buttons.push(drawMuteButton(r, audio.muted, game.hover === 'mute'));
    game.buttons.push(drawMusicButton(r, audio.musicOn, game.hover === 'music'));

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
      `mode ${game.mode}${game.result ? '/' + game.result.phase : ''}  ${game.difficulty}:${game.lang}  view ${r.W}x${r.H} @${r.scale}x`,
      `time ${game.time.toFixed(1)}s  play ${stats.time.toFixed(1)}s  lvl ${d.level}  ${bg.theme}`,
      `words ${game.words.length}/${d.maxWords}  fall ${d.fallTime.toFixed(2)}s`,
      `spawn ${d.spawnInterval.toFixed(2)}s  tiers ${d.tierWeights.map((v) => Math.round(v)).join('/')}`,
      `ok ${stats.correct} bad ${stats.wrong} roll ${stats.rollingWpm().toFixed(1)} peak ${peak}`,
      `particles ${particles.count}  popups ${popups.count}  slow ${game.slowTime.toFixed(1)}  board ${lb.online === null ? '?' : lb.online ? 'online' : 'local'}${game.runToken ? ' +token' : ''}`,
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
