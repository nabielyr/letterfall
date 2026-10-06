import { C, FONTS } from '../config.js';

// Floating text: rises with ease-out, blinks just before it disappears.
const MAX = 30;

export function createPopups() {
  const list = [];

  return {
    get count() {
      return list.length;
    },

    // colors: one color, or an array to cycle through (for big combo shouts).
    add(text, x, y, { color = C.white, size = 8, life = 0.9, rise = 18 } = {}) {
      if (list.length >= MAX) list.shift();
      list.push({ text, x, y, color, size, life, max: life, rise, age: 0 });
    },

    clear() {
      list.length = 0;
    },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        p.age += dt;
        if (p.life <= 0) list.splice(i, 1);
      }
    },

    draw(r) {
      for (const p of list) {
        if (p.life < 0.2 && Math.floor(p.life * 30) % 2) continue;
        const k = 1 - p.life / p.max;
        const y = p.y - p.rise * (1 - (1 - k) ** 3);
        const half = r.measure(p.text, p.size, FONTS.ui) / 2;
        const x = Math.min(Math.max(p.x, half + 3), r.W - half - 3);
        const color = Array.isArray(p.color) ? p.color[Math.floor(p.age * 12) % p.color.length] : p.color;
        r.text(p.text, x, y, {
          family: FONTS.ui,
          size: p.size,
          color,
          shadow: C.navy,
          align: 'center',
          baseline: 'middle',
        });
      }
    },
  };
}
