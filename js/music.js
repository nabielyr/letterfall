// Background music: an upbeat chiptune loop synthesized live, no audio files.
// 128 BPM in C major, 16 bars (~30 s): a verse on I–V–vi–IV, then a chorus
// that climbs (IV–V–iii–vi, IV–V–I) before looping.
// Voices: 25% pulse lead, 12.5% pulse arpeggio, triangle bass, noise drums.

const BPM = 128;
const STEP = 60 / BPM / 2; // one eighth note, the scheduler's grid
const LOOKAHEAD = 0.12; // seconds of audio scheduled ahead of time
const TICK = 25; // ms between scheduler runs

const CHORDS = {
  C: [60, 64, 67],
  G: [59, 62, 67],
  Am: [60, 64, 69],
  F: [60, 65, 69],
  Em: [59, 64, 67],
};
const BASS = { C: 48, G: 43, Am: 45, F: 41, Em: 40 };
const PROGRESSION = ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'];

// One bar per line: [midi note | null for rest, length in eighths]; each bar sums to 8.
const MELODY = [
  // Verse
  [[76, 1], [79, 1], [84, 2], [79, 1], [76, 1], [74, 2]],
  [[74, 1], [79, 1], [83, 2], [81, 1], [79, 1], [74, 2]],
  [[72, 1], [76, 1], [81, 2], [79, 1], [76, 1], [72, 2]],
  [[77, 2], [76, 1], [74, 1], [72, 3], [null, 1]],
  [[76, 1], [79, 1], [84, 2], [86, 1], [84, 1], [79, 2]],
  [[83, 2], [81, 1], [79, 1], [81, 2], [83, 2]],
  [[84, 1], [83, 1], [81, 2], [79, 1], [76, 1], [79, 2]],
  [[77, 1], [76, 1], [74, 1], [76, 1], [72, 4]],
  // Chorus
  [[81, 2], [77, 1], [81, 1], [84, 2], [81, 2]],
  [[83, 2], [79, 1], [83, 1], [86, 2], [83, 2]],
  [[79, 1], [76, 1], [79, 1], [83, 1], [88, 2], [86, 2]],
  [[84, 3], [83, 1], [81, 4]],
  [[77, 1], [81, 1], [84, 1], [81, 1], [77, 1], [81, 1], [84, 2]],
  [[79, 1], [83, 1], [86, 1], [83, 1], [79, 1], [83, 1], [86, 2]],
  [[88, 2], [86, 1], [84, 1], [86, 2], [79, 2]],
  [[84, 6], [null, 2]],
];

const ARP = [0, 1, 2, 1, 0, 1, 2, 1];
const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Lead notes indexed by the step they start on.
const LEAD = (() => {
  const steps = new Array(PROGRESSION.length * 8).fill(null);
  MELODY.forEach((bar, b) => {
    let pos = b * 8;
    for (const [note, len] of bar) {
      if (note !== null) steps[pos] = { note, len };
      pos += len;
    }
  });
  return steps;
})();

// Pulse wave with the given duty cycle, from its Fourier series.
function pulseWave(ctx, duty) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

export function createMusic(ctx, destination, noiseBuffer) {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(destination);
  const lead = pulseWave(ctx, 0.25);
  const thin = pulseWave(ctx, 0.125);

  let playing = false;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  let level = 1;

  function envelope(t, dur, vol) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(bus);
    return g;
  }

  function note(t, f, dur, vol, wave) {
    const osc = ctx.createOscillator();
    if (typeof wave === 'string') osc.type = wave;
    else osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(f, t);
    osc.connect(envelope(t, dur, vol));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function kick(t) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    osc.connect(envelope(t, 0.14, 0.11));
    osc.start(t);
    osc.stop(t + 0.16);
  }

  function hiss(t, dur, vol, type, cutoff) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    src.connect(filter).connect(envelope(t, dur, vol));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function playStep(i, t) {
    const bar = i >> 3;
    const pos = i & 7;
    const chord = PROGRESSION[bar];
    note(t, freq(BASS[chord] + (pos % 2 ? 12 : 0)), STEP * 0.9, 0.09, 'triangle');
    note(t, freq(CHORDS[chord][ARP[pos]] + 12), STEP * 0.6, 0.025, thin);
    const l = LEAD[i];
    if (l) note(t, freq(l.note), l.len * STEP * 0.92, 0.06, lead);
    if (pos === 0 || pos === 4) kick(t);
    if (pos === 2 || pos === 6) hiss(t, 0.09, 0.05, 'bandpass', 1800);
    hiss(t, 0.03, pos % 2 ? 0.012 : 0.02, 'highpass', 7000);
    // From level 4 the hats double up for extra drive.
    if (level >= 4) hiss(t + STEP / 2, 0.025, 0.01, 'highpass', 8000);
  }

  function schedule() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      playStep(step, nextTime);
      nextTime += STEP;
      step = (step + 1) % LEAD.length;
    }
  }

  return {
    get playing() {
      return playing;
    },

    setLevel(n) {
      level = n;
    },

    // Fades in from the top of the song.
    start(volume) {
      if (playing) return;
      playing = true;
      step = 0;
      nextTime = ctx.currentTime + 0.05;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(0.0001, ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.6);
      schedule();
      timer = setInterval(schedule, TICK);
    },

    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    },

    // Smoothly change volume while playing (used for ducking under the pause menu).
    setVolume(volume) {
      if (!playing) return;
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), ctx.currentTime);
      bus.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.25);
    },
  };
}

export const SONG_SECONDS = LEAD.length * STEP;
