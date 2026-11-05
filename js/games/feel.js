// 👆 Search by feel: rub your thumb over a sealed pack. A foil card has a ridge you can
// feel (and hear). Quicker than the scale, but cheap card stock gives false ticks.
import { play } from './overlay.js';
import { drawPack, text } from '../draw.js';
import { sfx } from '../audio.js';
import { haptic } from '../ui.js';

// Resolves 'heavy', 'dud' or null (cancelled).
export function feelPack(pack) {
  return play({ title: '👆 Feel for the foil', sub: 'Rub up and down the pack. A foil ridge ticks in one spot every pass; random ticks are just cheap card.', height: 0.55 }, (g, done) => {
    const pw = g.W * 0.5, ph = Math.min(g.H * 0.85, pw * 1.45);
    const px = g.W / 2 - pw / 2, py = (g.H - ph) / 2;
    const band = py + ph * (0.3 + Math.random() * 0.45);
    const ripples = [];
    let lastTick = 0;

    g.input({
      move: p => {
        if (p.x < px || p.x > px + pw || p.y < py || p.y > py + ph) return;
        const now = performance.now();
        if (now - lastTick < 90) return;
        const onRidge = pack.hit && Math.abs(p.y - band) < 10;
        const falseTick = Math.random() < 0.035;
        if (onRidge || falseTick) {
          lastTick = now;
          ripples.push({ x: p.x, y: p.y, t: now, strong: onRidge });
          sfx.scale();
          haptic(8);
        }
      },
    });
    g.buttons([
      { label: '💎 Heavy', kind: 'mint', onClick: () => done('heavy') },
      { label: '🗑️ Dud', onClick: () => done('dud') },
      { label: 'Cancel', kind: 'ghost', onClick: () => done(null) },
    ]);

    g.loop(ctx => {
      drawPack(ctx, px, py, pw, ph, pack);
      const now = performance.now();
      for (const r of ripples) {
        const k = (now - r.t) / 600;
        if (k > 1) continue;
        ctx.strokeStyle = `rgba(255,255,255,${(r.strong ? 0.9 : 0.6) * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(r.x, r.y, 8 + k * 30, 0, 7); ctx.stroke();
      }
      text(ctx, 'rub here', g.W / 2, py + ph + 14 > g.H ? g.H - 8 : py + ph + 14, { size: 11, color: '#8a93a6' });
    });
  });
}
