import { FONTS } from './config.js';

// `?debug=1` overlay: FPS plus whatever lines the game reports.
export function createDebug(enabled) {
  if (!enabled) return null;
  let fps = 60;
  let frameMs = 16.7;

  return {
    visible: true, // `letterfall.debug.visible = false` in the console for clean screenshots
    update(rawDt) {
      if (rawDt <= 0) return;
      fps += (1 / rawDt - fps) * 0.05;
      frameMs += (rawDt * 1000 - frameMs) * 0.05;
    },
    draw(r, lines) {
      if (!this.visible) return;
      const all = [`fps ${fps.toFixed(0)}  ${frameMs.toFixed(1)}ms`, ...lines];
      const lineH = 7;
      const width = 120;
      const height = all.length * lineH + 4;
      const top = r.H - height; // bottom-left, clear of the HUD
      r.fctx.save();
      r.fctx.setTransform(1, 0, 0, 1, 0, 0);
      r.fctx.fillStyle = 'rgba(0,0,0,0.6)';
      r.fctx.fillRect(0, top * r.scale, width * r.scale, height * r.scale);
      r.fctx.restore();
      all.forEach((line, i) => {
        r.text(line, 2, top + 2 + i * lineH, { size: 5, family: FONTS.debug, color: '#00e436', baseline: 'top' });
      });
    },
  };
}
