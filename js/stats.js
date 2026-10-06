import { STATS } from './config.js';

// Typing stats for one run. Standard WPM: 5 correct characters = 1 word.
// Time only advances through update(), which is only called while playing.
const RING_SIZE = 1024; // ~10 s of keystrokes even at 600 WPM

export function createStats() {
  const stamps = new Float64Array(RING_SIZE);
  let head = 0;
  let count = 0;

  const s = {
    time: 0,
    correct: 0,
    wrong: 0,
    words: 0,
    peakWpm: null,
  };

  s.reset = () => {
    head = 0;
    count = 0;
    s.time = 0;
    s.correct = 0;
    s.wrong = 0;
    s.words = 0;
    s.peakWpm = null;
  };

  s.addCorrect = () => {
    s.correct++;
    stamps[head] = s.time;
    head = (head + 1) % RING_SIZE;
    count = Math.min(count + 1, RING_SIZE);
  };

  s.addWrong = () => {
    s.wrong++;
  };

  s.addWord = () => {
    s.words++;
  };

  s.update = (dt) => {
    s.time += dt;
    if (s.time >= STATS.rollingWindow) {
      const rolling = s.rollingWpm();
      if (s.peakWpm === null || rolling > s.peakWpm) s.peakWpm = rolling;
    }
  };

  // null until enough time has passed for the number to mean anything.
  s.avgWpm = () => (s.time < STATS.wpmWarmup ? null : s.correct / 5 / (s.time / 60));

  s.rollingWpm = () => {
    const cutoff = s.time - STATS.rollingWindow;
    let n = 0;
    for (let i = 1; i <= count; i++) {
      if (stamps[(head - i + RING_SIZE) % RING_SIZE] < cutoff) break;
      n++;
    }
    return n / 5 / (STATS.rollingWindow / 60);
  };

  s.accuracy = () => {
    const total = s.correct + s.wrong;
    return total === 0 ? 1 : s.correct / total;
  };

  return s;
}
