import { PALETTE, GROUND_H, THEMES } from '../config.js';

// Living pixel background on the low-res canvas:
// sky (dithered gradient + sun/moon + stars) → 3 parallax cloud layers →
// land (hills, town, ground) → drizzle. Sky and land are baked per theme;
// switching themes crossfades with an ordered-dither mask, 16 steps.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const RGB = PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const col = (digit) => PALETTE[parseInt(digit, 16)];

const DEFS = {
  day: {
    sky: [[0, 'c'], [0.6, 'c'], [0.74, '7']], // short dither band, mostly hidden by the hills
    sun: { x: 0.82, y: 0.15, r: 9, core: 'a', rim: '9' },
    stars: 0,
    hills: ['b', '3'],
    buildings: ['f', 'e', '6', '9', 'd'],
    outline: '1',
    roof: '8',
    window: 'c',
    lit: 'a',
    litChance: 0.08,
    grass: ['b', '3'],
    dirt: ['4', '9', '5'],
    clouds: ['7', '6'],
    drizzle: 1,
    drizzleColor: '6',
  },
  dusk: {
    sky: [[0, '1'], [0.3, '2'], [0.6, 'e'], [0.85, '9']],
    sun: { x: 0.25, y: 0.55, r: 15, core: 'a', rim: '9' },
    stars: 0.25,
    hills: ['d', '2'],
    buildings: ['d', '2', '4', '5', '2'],
    outline: '1',
    roof: '2',
    window: '1',
    lit: 'a',
    litChance: 0.35,
    grass: ['3', '3'],
    dirt: ['4', '2', '5'],
    clouds: ['e', '2'],
    drizzle: 0.35,
    drizzleColor: 'e',
  },
  dawn: {
    sky: [[0, '1'], [0.25, 'd'], [0.55, 'e'], [0.8, 'f']],
    sun: { x: 0.74, y: 0.6, r: 12, core: 'a', rim: 'f' },
    stars: 0.12,
    hills: ['e', 'd'],
    buildings: ['f', 'd', 'e', '6', 'd'],
    outline: '1',
    roof: '2',
    window: '1',
    lit: 'a',
    litChance: 0.18,
    grass: ['b', '3'],
    dirt: ['4', '9', '5'],
    clouds: ['7', 'f'],
    drizzle: 0.5,
    drizzleColor: 'f',
  },
  night: {
    sky: [[0, '0'], [0.4, '1'], [0.9, '2']],
    moon: { x: 0.78, y: 0.14, r: 8 },
    stars: 1,
    hills: ['5', '1'],
    buildings: ['1', '5', '2', '1', '5'],
    outline: '0',
    roof: '0',
    window: '0',
    lit: 'a',
    litChance: 0.55,
    grass: ['3', '1'],
    dirt: ['5', '1', '0'],
    clouds: ['5', '1'],
    drizzle: 0,
    drizzleColor: '6',
  },
};

// Deterministic RNG so every theme bakes the same town layout.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

function makeLayout(W, H) {
  const rand = mulberry32(1337);
  const groundY = H - GROUND_H;

  const hillPhase = [rand() * 6, rand() * 6, rand() * 6];
  const hillTop = (x) =>
    Math.round(
      groundY - H * 0.26 +
        Math.sin(x / 37 + hillPhase[0]) * H * 0.035 +
        Math.sin(x / 19 + hillPhase[1]) * H * 0.018 +
        Math.sin(x / 71 + hillPhase[2]) * H * 0.03,
    );

  const buildings = [];
  for (let x = -6; x < W; ) {
    const w = 11 + Math.floor(rand() * 12);
    const h = Math.round(H * (0.09 + rand() * 0.13));
    const b = { x, w, h, color: buildings.length % 5, roof: Math.floor(rand() * 3), windows: [] };
    for (let wy = groundY - h + 5; wy < groundY - 5; wy += 5) {
      for (let wx = x + 3; wx < x + w - 3; wx += 4) b.windows.push({ x: wx, y: wy, r: rand() });
    }
    b.door = rand() < 0.5 ? x + Math.floor(w / 2) - 1 : null;
    buildings.push(b);
    x += w + Math.floor(rand() * 4) - 1;
  }

  const specks = [];
  for (let i = 0; i < (W * GROUND_H) / 18; i++) {
    specks.push({ x: Math.floor(rand() * W), y: groundY + 4 + Math.floor(rand() * (GROUND_H - 4)), c: rand() < 0.6 ? 1 : 2 });
  }

  const stars = [];
  for (let i = 0; i < (W * H) / 260; i++) {
    stars.push({ x: Math.floor(rand() * W), y: Math.floor(rand() * H * 0.6), c: rand(), r: rand() });
  }

  // Cloud shapes: unions of circles, baked per theme later.
  const cloudShapes = [];
  for (let i = 0; i < 9; i++) {
    const w = 16 + Math.floor(rand() * 26);
    const h = Math.round(w * 0.38) + 2;
    const blobs = [];
    const n = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const r = h * (0.35 + rand() * 0.25);
      blobs.push({ x: r + rand() * (w - 2 * r), y: h - r - rand() * (h * 0.25), r });
    }
    cloudShapes.push({ w, h, blobs });
  }

  return { groundY, hillTop, buildings, specks, stars, cloudShapes };
}

function bakeSky(W, H, def, layout) {
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const stops = def.sky;
  for (let y = 0; y < H; y++) {
    const f = y / H;
    let i = 0;
    while (i < stops.length - 2 && f > stops[i + 1][0]) i++;
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    const t = Math.min(1, Math.max(0, (f - p0) / (p1 - p0)));
    const a = RGB[parseInt(c0, 16)];
    const b = RGB[parseInt(c1, 16)];
    for (let x = 0; x < W; x++) {
      const rgb = t > bayer(x, y) ? b : a;
      const o = (y * W + x) * 4;
      img.data[o] = rgb[0];
      img.data[o + 1] = rgb[1];
      img.data[o + 2] = rgb[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  for (const s of layout.stars) {
    if (s.r > def.stars) continue;
    ctx.fillStyle = col(s.c < 0.5 ? '7' : s.c < 0.8 ? '6' : 'f');
    ctx.fillRect(s.x, s.y, 1, 1);
  }
  if (def.sun) {
    const { x, y, r, core, rim } = def.sun;
    disc(ctx, Math.round(W * x), Math.round(H * y), r + 1, col(rim));
    disc(ctx, Math.round(W * x), Math.round(H * y), r - 1, col(core));
  }
  if (def.moon) {
    const mx = Math.round(W * def.moon.x);
    const my = Math.round(H * def.moon.y);
    disc(ctx, mx, my, def.moon.r, col('7'));
    disc(ctx, mx - 3, my - 2, 2, col('6'));
    disc(ctx, mx + 2, my + 3, 1, col('6'));
    ctx.fillStyle = col('6');
    ctx.fillRect(mx + 3, my - 3, 1, 1);
  }
  return c;
}

function bakeLand(W, H, def, layout) {
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const { groundY } = layout;

  // Far hills.
  for (let x = 0; x < W; x++) {
    const top = layout.hillTop(x);
    ctx.fillStyle = col(def.hills[1]);
    ctx.fillRect(x, top, 1, groundY - top);
    ctx.fillStyle = col(def.hills[0]);
    ctx.fillRect(x, top, 1, 1);
  }

  // Town.
  for (const b of layout.buildings) {
    const top = groundY - b.h;
    ctx.fillStyle = col(def.outline);
    ctx.fillRect(b.x, top, b.w, b.h);
    ctx.fillStyle = col(def.buildings[b.color]);
    ctx.fillRect(b.x + 1, top + 1, b.w - 2, b.h - 1);
    if (b.roof === 1) {
      // Gable roof.
      const half = Math.ceil(b.w / 2);
      for (let i = 0; i < half; i++) {
        ctx.fillStyle = col(def.outline);
        ctx.fillRect(b.x + i, top - i, b.w - i * 2, 1);
        if (b.w - i * 2 - 2 > 0) {
          ctx.fillStyle = col(def.roof);
          ctx.fillRect(b.x + i + 1, top - i, b.w - i * 2 - 2, 1);
        }
        if (b.w - i * 2 <= 2) break;
      }
    } else if (b.roof === 2) {
      // Antenna.
      ctx.fillStyle = col(def.outline);
      ctx.fillRect(b.x + 3, top - 5, 1, 5);
      ctx.fillRect(b.x + 2, top - 5, 3, 1);
    }
    for (const w of b.windows) {
      ctx.fillStyle = col(w.r < def.litChance ? def.lit : def.window);
      ctx.fillRect(w.x, w.y, 2, 2);
    }
    if (b.door !== null) {
      ctx.fillStyle = col(def.outline);
      ctx.fillRect(b.door, groundY - 4, 3, 4);
    }
  }

  // Ground.
  ctx.fillStyle = col(def.dirt[0]);
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = col(def.grass[0]);
  ctx.fillRect(0, groundY, W, 2);
  ctx.fillStyle = col(def.grass[1]);
  ctx.fillRect(0, groundY + 2, W, 1);
  for (let x = 0; x < W; x += 3) {
    if ((x * 7) % 5 < 2) ctx.fillRect(x, groundY + 3, 1, 1);
  }
  for (const s of layout.specks) {
    ctx.fillStyle = col(def.dirt[s.c]);
    ctx.fillRect(s.x, s.y, s.c === 1 ? 2 : 1, 1);
  }
  return c;
}

function bakeCloud(shape, body, shade) {
  const c = canvas(shape.w, shape.h);
  const ctx = c.getContext('2d');
  for (let y = 0; y < shape.h; y++) {
    for (let x = 0; x < shape.w; x++) {
      const inside = shape.blobs.some((b) => (x + 0.5 - b.x) ** 2 + (y + 0.5 - b.y) ** 2 <= b.r * b.r);
      if (!inside) continue;
      ctx.fillStyle = y > shape.h * 0.62 ? shade : body;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

const LAYERS = [
  { speed: 2, density: 90, yMin: 0.05, yMax: 0.32, tint: 1 }, // far: drawn in the shade color
  { speed: 5, density: 130, yMin: 0.08, yMax: 0.3, tint: 0 },
  { speed: 9, density: 190, yMin: 0.03, yMax: 0.2, tint: 0 },
];

export function createBackground() {
  let W = 0;
  let H = 0;
  let layout = null;
  const baked = {}; // theme → { sky, land, clouds: [[layer0 cloud canvases], ...] }
  let theme = 'day';
  let fade = null; // { from, to, t, step, sky, land, skyA, skyB, landA, landB }
  const clouds = [];
  const drops = [];
  let time = 0;

  function bakeTheme(name) {
    const def = DEFS[name];
    const sky = bakeSky(W, H, def, layout);
    const land = bakeLand(W, H, def, layout);
    const cloudImgs = layout.cloudShapes.map((s) => [
      bakeCloud(s, col(def.clouds[0]), col(def.clouds[1])),
      bakeCloud(s, col(def.clouds[1]), col(def.clouds[1])),
    ]);
    baked[name] = { sky, land, cloudImgs };
  }

  function resize(newW, newH) {
    if (newW === W && newH === H) return;
    W = newW;
    H = newH;
    layout = makeLayout(W, H);
    for (const name of Object.keys(DEFS)) bakeTheme(name);
    fade = null;

    clouds.length = 0;
    const rand = mulberry32(7);
    LAYERS.forEach((layer, li) => {
      const n = Math.max(2, Math.round(W / layer.density));
      for (let i = 0; i < n; i++) {
        clouds.push({
          layer: li,
          shape: Math.floor(rand() * layout.cloudShapes.length),
          x: (i / n) * (W + 40) + rand() * 30 - 20,
          y: Math.round(H * (layer.yMin + rand() * (layer.yMax - layer.yMin))),
        });
      }
    });
    // Far layers first so nearer clouds overlap them.
    clouds.sort((a, b) => a.layer - b.layer);

    drops.length = 0;
    for (let i = 0; i < (W * H) / 900; i++) {
      drops.push({ x: rand() * W, y: rand() * layout.groundY, v: 140 + rand() * 80 });
    }
  }

  function pixelsOf(c) {
    return c.getContext('2d').getImageData(0, 0, W, H);
  }

  function setTheme(name, instant = false) {
    if (!DEFS[name] || (name === theme && !fade)) return;
    if (instant || !layout) {
      theme = name;
      fade = null;
      return;
    }
    const from = baked[theme];
    const to = baked[name];
    fade = {
      t: 0,
      step: -1,
      sky: canvas(W, H),
      land: canvas(W, H),
      skyA: pixelsOf(from.sky),
      skyB: pixelsOf(to.sky),
      landA: pixelsOf(from.land),
      landB: pixelsOf(to.land),
      fromTheme: theme,
    };
    theme = name;
  }

  function blend(a, b, target, step) {
    const out = new ImageData(W, H);
    const threshold = step / 16;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        const src = bayer(x, y) < threshold ? b.data : a.data;
        out.data[o] = src[o];
        out.data[o + 1] = src[o + 1];
        out.data[o + 2] = src[o + 2];
        out.data[o + 3] = src[o + 3];
      }
    }
    target.getContext('2d').putImageData(out, 0, 0);
  }

  function update(dt) {
    time += dt;
    for (const c of clouds) {
      c.x -= LAYERS[c.layer].speed * dt;
      const w = layout.cloudShapes[c.shape].w;
      if (c.x < -w) c.x += W + w + 20;
    }
    const groundY = layout.groundY;
    for (const d of drops) {
      d.y += d.v * dt;
      d.x -= d.v * 0.25 * dt;
      if (d.y > groundY) {
        d.y -= groundY + 6;
        d.x = (d.x + W * 0.37) % W;
      }
      if (d.x < 0) d.x += W;
    }
    if (fade) {
      fade.t += dt;
      const step = Math.min(16, Math.floor((fade.t / THEMES.fadeTime) * 16));
      if (step !== fade.step) {
        fade.step = step;
        if (step >= 16) fade = null;
        else {
          blend(fade.skyA, fade.skyB, fade.sky, step);
          blend(fade.landA, fade.landB, fade.land, step);
        }
      }
    }
  }

  function draw(r) {
    const ctx = r.bctx;
    const current = baked[theme];
    // Clouds and drizzle swap palettes halfway through a fade.
    const look = fade && fade.step < 8 ? baked[fade.fromTheme] : current;
    const def = fade && fade.step < 8 ? DEFS[fade.fromTheme] : DEFS[theme];

    ctx.drawImage(fade ? fade.sky : current.sky, 0, 0);

    // Twinkling stars.
    if (def.stars > 0) {
      ctx.fillStyle = col('7');
      for (let i = 0; i < layout.stars.length; i += 9) {
        const s = layout.stars[i];
        if (s.r > def.stars || Math.sin(time * 2 + i) < 0.92) continue;
        ctx.fillRect(s.x - 1, s.y, 3, 1);
        ctx.fillRect(s.x, s.y - 1, 1, 3);
      }
    }

    for (const c of clouds) {
      ctx.drawImage(look.cloudImgs[c.shape][LAYERS[c.layer].tint], Math.round(c.x), c.y);
    }

    ctx.drawImage(fade ? fade.land : current.land, 0, 0);

    const count = Math.floor(drops.length * def.drizzle);
    if (count > 0) {
      ctx.fillStyle = col(def.drizzleColor);
      for (let i = 0; i < count; i++) {
        ctx.fillRect(Math.round(drops[i].x), Math.round(drops[i].y), 1, 3);
      }
    }
  }

  return {
    resize,
    setTheme,
    update,
    draw,
    get theme() {
      return theme;
    },
  };
}

// Theme for a moment in the run (seconds of play), following THEMES.cycle.
const CYCLE_LENGTH = THEMES.cycle.reduce((sum, [, secs]) => sum + secs, 0);
export function themeAt(t) {
  let m = t % CYCLE_LENGTH;
  for (const [name, secs] of THEMES.cycle) {
    if (m < secs) return name;
    m -= secs;
  }
  return THEMES.cycle[0][0];
}
