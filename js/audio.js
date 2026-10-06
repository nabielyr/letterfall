// Chiptune sound effects synthesized with Web Audio: square/triangle
// oscillators with short envelopes, plus filtered white noise for booms.
// The AudioContext can only start after a user gesture, so unlock() is called
// from the first key press / tap; before that every effect is a silent no-op.
// Background music (music.js) shares the master volume, so mute silences both;
// the music toggle only affects the music.
import { createMusic } from './music.js';

const VOLUME = 0.5;
const MUSIC_VOLUME = 0.9; // relative to the master
const MUSIC_DUCKED = 0.25;

export function createAudio({ muted = false, music: musicOn = true } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let music = null;
  let musicWanted = false; // does the current screen want music?
  let musicDucked = false;
  const a = { muted, musicOn };

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = a.muted ? 0 : VOLUME;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    music = createMusic(ctx, master, noiseBuffer);
    return true;
  }

  function syncMusic() {
    if (!music) return;
    const play = a.musicOn && musicWanted && ctx.state === 'running';
    const volume = musicDucked ? MUSIC_VOLUME * MUSIC_DUCKED : MUSIC_VOLUME;
    if (play && !music.playing) music.start(volume);
    else if (!play && music.playing) music.stop();
    else if (play) music.setVolume(volume);
  }

  const ready = () => ctx && !a.muted && ctx.state === 'running';

  function envelope(t0, dur, vol) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master);
    return g;
  }

  function tone(type, f0, f1, dur, vol, delay = 0) {
    if (!ready()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    osc.connect(envelope(t0, dur, vol));
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, cutoff, delay = 0) {
    if (!ready()) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff / 6), t0 + dur);
    src.connect(filter).connect(envelope(t0, dur, vol));
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const arpeggio = (type, notes, step, dur, vol) => notes.forEach((f, i) => tone(type, f, f, dur, vol, i * step));

  a.unlock = () => {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().then(syncMusic);
    else syncMusic();
  };

  // Called by the game on every screen change.
  a.setMusicMode = (wanted, ducked = false) => {
    musicWanted = wanted;
    musicDucked = ducked;
    syncMusic();
  };

  a.setMusicOn = (on) => {
    a.musicOn = on;
    syncMusic();
  };

  a.setMusicLevel = (level) => music?.setLevel(level);

  // Debug helpers (used by ?debug=1 tests).
  Object.defineProperty(a, 'musicPlaying', { get: () => Boolean(music?.playing) });
  a.tap = () => {
    if (!ctx) return null;
    const analyser = ctx.createAnalyser();
    master.connect(analyser);
    return analyser;
  };

  // Hidden tab: freeze all audio (the music scheduler follows the frozen clock).
  a.suspend = () => {
    if (ctx && ctx.state === 'running') ctx.suspend();
  };
  a.resume = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume().then(syncMusic);
  };

  a.setMuted = (m) => {
    a.muted = m;
    if (master) master.gain.setValueAtTime(m ? 0 : VOLUME, ctx.currentTime);
  };

  // progress 0–1 through the word: pitch climbs as you type.
  a.type = (progress) => tone('square', 440 + progress * 440, 440 + progress * 440, 0.045, 0.045);
  a.wrong = () => tone('square', 150, 90, 0.12, 0.07);
  a.destroy = (style) => {
    if (style === 'meteor') {
      noise(0.28, 0.3, 1200);
      tone('square', 220, 55, 0.22, 0.07);
    } else if (style === 'star') {
      arpeggio('triangle', [1319, 1568, 2093, 2637], 0.035, 0.12, 0.07);
      tone('sine', 3136, 3136, 0.25, 0.03, 0.12);
    } else if (style === 'balloon') {
      noise(0.05, 0.2, 4000);
      arpeggio('square', [784, 988, 1175, 1568], 0.045, 0.07, 0.06);
    } else {
      arpeggio('triangle', [784, 1047, 1319], 0.04, 0.08, 0.1);
    }
  };
  a.combo = () => arpeggio('square', [659, 784, 1047, 1319], 0.06, 0.09, 0.06);
  a.hurt = () => {
    tone('square', 330, 70, 0.35, 0.09);
    noise(0.2, 0.15, 600);
  };
  a.power = () => arpeggio('square', [523, 659, 784, 1047, 1319], 0.05, 0.08, 0.06);
  a.bomb = () => {
    noise(0.6, 0.4, 900);
    tone('square', 120, 35, 0.5, 0.1);
  };
  a.gameOver = () => arpeggio('triangle', [523, 392, 330, 262, 196], 0.18, 0.24, 0.13);
  a.start = () => arpeggio('triangle', [392, 523, 659, 784], 0.06, 0.1, 0.1);
  a.click = () => tone('triangle', 660, 990, 0.06, 0.08);

  return a;
}
