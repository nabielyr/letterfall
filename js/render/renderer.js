import { VIEW, FONTS } from '../config.js';

// Two stacked canvases sharing world coordinates:
// - `bg`: native low-res canvas upscaled with pixelated rendering (background).
// - `fg`: full-res canvas for words, sprites and text. Shapes are snapped to the
//   world pixel grid (x * scale), so they stay pixel-perfect while text stays
//   sharp and draw order between words is correct.
export function createRenderer(root) {
  const frame = document.createElement('div');
  frame.className = 'frame';
  const bg = document.createElement('canvas');
  bg.className = 'layer layer-bg';
  const fg = document.createElement('canvas');
  fg.className = 'layer layer-fg';
  frame.append(bg, fg);
  root.append(frame);

  const bctx = bg.getContext('2d');
  const fctx = fg.getContext('2d');
  const measureCache = new Map();
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  const r = {
    W: 0,
    H: 0,
    scale: 1,
    bctx,
    fctx,
    frame,
    shakeX: 0,
    shakeY: 0,
    onResize: null,
  };

  function resize() {
    const vv = window.visualViewport;
    const cssW = vv ? vv.width : window.innerWidth;
    const cssH = vv ? vv.height : window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // Keep the stage glued to the visible area (shrinks above a mobile keyboard).
    root.style.width = `${cssW}px`;
    root.style.height = `${cssH}px`;
    root.style.top = `${vv ? vv.offsetTop : 0}px`;
    root.style.left = `${vv ? vv.offsetLeft : 0}px`;

    // On touch devices the keyboard shrinks the viewport, so judge orientation
    // by the physical screen to avoid flipping layouts while typing.
    const portrait = isTouch ? screen.height > screen.width : cssH > cssW;
    const v = portrait ? VIEW.portrait : VIEW.landscape;
    const devW = cssW * dpr;
    const devH = cssH * dpr;
    // Integer scale in device pixels so every world pixel maps to a whole block.
    const scale = Math.max(1, Math.floor(Math.min(devW / v.minW, devH / v.minH)));
    const W = Math.min(v.maxW, Math.max(v.minW, Math.floor(devW / scale)));
    const H = Math.min(v.maxH, Math.max(v.minH, Math.floor(devH / scale)));

    frame.style.width = `${(W * scale) / dpr}px`;
    frame.style.height = `${(H * scale) / dpr}px`;

    if (W === r.W && H === r.H && scale === r.scale) return;

    const oldW = r.W;
    const oldH = r.H;
    bg.width = W;
    bg.height = H;
    fg.width = W * scale;
    fg.height = H * scale;
    bctx.imageSmoothingEnabled = false;
    fctx.imageSmoothingEnabled = false;
    r.W = W;
    r.H = H;
    r.scale = scale;
    measureCache.clear();

    if (oldW && r.onResize) r.onResize(oldW, oldH, W, H);
  }

  r.begin = () => {
    const sx = Math.round(r.shakeX);
    const sy = Math.round(r.shakeY);
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, r.W, r.H);
    bctx.setTransform(1, 0, 0, 1, sx, sy);
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, fg.width, fg.height);
    fctx.setTransform(1, 0, 0, 1, sx * r.scale, sy * r.scale);
  };

  // Background layer, native pixels.
  r.bgRect = (x, y, w, h, color) => {
    bctx.fillStyle = color;
    bctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  // Foreground layer, snapped to world pixels.
  r.rect = (x, y, w, h, color) => {
    const s = r.scale;
    fctx.fillStyle = color;
    fctx.fillRect(Math.round(x) * s, Math.round(y) * s, Math.round(w) * s, Math.round(h) * s);
  };

  r.sprite = (img, x, y) => {
    const s = r.scale;
    fctx.drawImage(img, Math.round(x) * s, Math.round(y) * s, img.width * s, img.height * s);
  };

  // `shadow`: color of a 1-world-pixel drop shadow, for text over busy backgrounds.
  r.text = (str, x, y, o = {}) => {
    const size = o.size ?? 10;
    fctx.font = `${o.weight ?? 400} ${size * r.scale}px ${o.family ?? FONTS.word}`;
    fctx.textAlign = o.align ?? 'left';
    fctx.textBaseline = o.baseline ?? 'alphabetic';
    const px = Math.round(x * r.scale);
    const py = Math.round(y * r.scale);
    if (o.shadow) {
      fctx.fillStyle = o.shadow;
      fctx.fillText(str, px + r.scale, py + r.scale);
    }
    fctx.fillStyle = o.color ?? '#fff';
    fctx.fillText(str, px, py);
  };

  // Client (CSS) coordinates → world coordinates.
  r.toWorld = (clientX, clientY) => {
    const box = frame.getBoundingClientRect();
    return {
      x: ((clientX - box.left) / box.width) * r.W - r.shakeX,
      y: ((clientY - box.top) / box.height) * r.H - r.shakeY,
    };
  };

  // Width in world pixels (fractional).
  r.measure = (str, size = 10, family = FONTS.word, weight = 400) => {
    const key = `${weight}|${size}|${family}|${str}`;
    let w = measureCache.get(key);
    if (w === undefined) {
      fctx.font = `${weight} ${size * r.scale}px ${family}`;
      w = fctx.measureText(str).width / r.scale;
      measureCache.set(key, w);
    }
    return w;
  };

  resize();
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('scroll', resize);

  return r;
}
