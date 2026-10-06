import { C } from '../config.js';

// Fixed-size particle pool stored as parallel typed arrays: no allocation per
// particle, dead ones are swap-removed. Drawn as world-pixel squares.
const MAX = 900;

const KINDS = {
  splash: { count: 14, colors: [C.white, C.blue, C.silver], speed: 70, up: [-90, -30], grav: 240, life: [0.4, 0.7], size: [1, 2] },
  fire: { count: 22, colors: [C.yellow, C.orange, C.red, C.grey], radial: [40, 130], grav: 40, life: [0.35, 0.8], size: [1, 2] },
  confetti: { count: 26, colors: [C.red, C.orange, C.yellow, C.green, C.blue, C.pink], speed: 80, up: [-110, -40], grav: 120, life: [0.8, 1.3], size: [2, 2] },
  dust: { count: 10, colors: [C.brown, C.grey, C.silver], speed: 40, up: [-40, -10], grav: 80, life: [0.3, 0.6], size: [1, 2] },
  spark: { count: 3, colors: [C.red, C.pink], radial: [30, 60], grav: 0, life: [0.15, 0.3], size: [1, 1] },
  chip: { count: 2, colors: [C.white, C.yellow], speed: 30, up: [-50, -20], grav: 150, life: [0.2, 0.35], size: [1, 1] },
  stardust: { count: 24, colors: [C.white, C.yellow, C.blue, C.lavender], radial: [25, 95], grav: 25, life: [0.5, 1.1], size: [1, 2] },
  heart: { count: 14, colors: [C.red, C.pink, C.white], radial: [30, 80], grav: -20, life: [0.5, 0.9], size: [1, 2] },
};

const rand = (a, b) => a + Math.random() * (b - a);

export function createParticles() {
  const x = new Float32Array(MAX);
  const y = new Float32Array(MAX);
  const vx = new Float32Array(MAX);
  const vy = new Float32Array(MAX);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const grav = new Float32Array(MAX);
  const size = new Uint8Array(MAX);
  const color = new Array(MAX);
  let n = 0;

  function add(px, py, pvx, pvy, l, c, s, g) {
    if (n >= MAX) return;
    x[n] = px;
    y[n] = py;
    vx[n] = pvx;
    vy[n] = pvy;
    life[n] = l;
    maxLife[n] = l;
    color[n] = c;
    size[n] = s;
    grav[n] = g;
    n++;
  }

  function move(from, to) {
    x[to] = x[from];
    y[to] = y[from];
    vx[to] = vx[from];
    vy[to] = vy[from];
    life[to] = life[from];
    maxLife[to] = maxLife[from];
    color[to] = color[from];
    size[to] = size[from];
    grav[to] = grav[from];
  }

  return {
    get count() {
      return n;
    },

    clear() {
      n = 0;
    },

    // w: spread the spawn points across a word's width.
    burst(kind, cx, cy, w = 0, intensity = 1) {
      const k = KINDS[kind];
      const count = Math.round(k.count * intensity);
      for (let i = 0; i < count; i++) {
        let pvx;
        let pvy;
        if (k.radial) {
          const angle = Math.random() * Math.PI * 2;
          const speed = rand(k.radial[0], k.radial[1]);
          pvx = Math.cos(angle) * speed;
          pvy = Math.sin(angle) * speed;
        } else {
          pvx = rand(-k.speed, k.speed);
          pvy = rand(k.up[0], k.up[1]);
        }
        add(
          cx + (w ? rand(-w / 2, w / 2) : 0),
          cy + rand(-2, 2),
          pvx,
          pvy,
          rand(k.life[0], k.life[1]),
          k.colors[Math.floor(Math.random() * k.colors.length)],
          Math.round(rand(k.size[0], k.size[1])),
          k.grav,
        );
      }
    },

    update(dt) {
      for (let i = n - 1; i >= 0; i--) {
        life[i] -= dt;
        if (life[i] <= 0) {
          n--;
          if (i !== n) move(n, i);
          continue;
        }
        vy[i] += grav[i] * dt;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
      }
    },

    draw(r) {
      for (let i = 0; i < n; i++) {
        const s = life[i] < maxLife[i] * 0.3 ? 1 : size[i]; // shrink as they die
        r.rect(x[i], y[i], s, s, color[i]);
      }
    },
  };
}
