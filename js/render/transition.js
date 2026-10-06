import { C, TRANSITION } from '../config.js';

// Retro block wipe: squares grow diagonally to cover the screen, the action
// runs while it's covered, then they shrink away in the same direction.
export function createTransition() {
  let phase = null; // 'cover' | 'reveal' | null
  let t = 0;
  let action = null;

  return {
    // Input is only blocked while the screen is being covered; during the
    // reveal the new screen is already live.
    get covering() {
      return phase === 'cover';
    },

    start(fn) {
      if (phase === 'cover') return;
      // Starting mid-reveal re-covers from the current coverage instead of jumping.
      t = phase === 'reveal' ? Math.max(0, TRANSITION.duration - t) : 0;
      phase = 'cover';
      action = fn;
    },

    update(dt) {
      if (!phase) return;
      t += dt;
      if (t < TRANSITION.duration) return;
      if (phase === 'cover') {
        const fn = action;
        action = null;
        phase = 'reveal';
        t = 0;
        fn?.();
      } else {
        phase = null;
      }
    },

    draw(r) {
      if (!phase) return;
      const B = TRANSITION.block;
      const cols = Math.ceil(r.W / B);
      const rows = Math.ceil(r.H / B);
      const spread = cols + rows - 2 || 1;
      const p = Math.min(1, t / TRANSITION.duration);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const d = (i + j) / spread;
          // Cover: grows top-left → bottom-right. Reveal: shrinks in the same order.
          const f = phase === 'cover' ? clamp01((p - d * 0.6) / 0.4) : 1 - clamp01((p - d * 0.6) / 0.4);
          if (f <= 0) continue;
          const size = Math.max(1, Math.round(f * B));
          const off = Math.floor((B - size) / 2);
          r.rect(i * B + off, j * B + off, size, size, C.navy);
        }
      }
    },
  };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
