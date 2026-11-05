// 📸 Photo staging: drag the lamp to light the card for its listing photo.
// Too far is dark, too close glares across the art. Fakes have flaws that show under raking light.
import { play } from './overlay.js';
import { drawCard, text } from '../draw.js';
import { sfx } from '../audio.js';
import { clamp } from '../state.js';

// Resolves a photo score 0–1.
export function stagePhoto(card, fake = false) {
  return play({ title: '📸 Stage the listing photo', sub: fake ? 'Drag the lamp ☀️. Light the card well, keep the glare off the art, and keep light away from the flaws.' : 'Drag the lamp ☀️. Light the card well and keep the glare off the art.', height: 0.56 }, (g, done) => {
    const ch = g.H * 0.62, cw = ch / 1.4, cx = g.W / 2, cy = g.H * 0.45;
    const lamp = { x: g.W * 0.12, y: g.H * 0.12 };
    const flaws = fake ? [0, 1].map(() => ({ x: cx + (Math.random() - 0.5) * cw * 0.7, y: cy + (Math.random() - 0.5) * ch * 0.7 })) : [];
    let dragging = false;

    const score = () => {
      const d = Math.hypot(lamp.x - cx, lamp.y - cy);
      const far = Math.hypot(g.W, g.H) * 0.6;
      const bright = clamp(1 - d / far, 0, 1);
      const light = 1 - Math.min(1, Math.abs(bright - 0.6) / 0.45);
      const gx = cx + (lamp.x - cx) * 0.55, gy = cy + (lamp.y - cy) * 0.55;
      const glareArt = clamp(1 - Math.hypot(gx - cx, gy - (cy - ch * 0.1)) / (cw * 0.55), 0, 1) * bright;
      const flawVis = flaws.reduce((t, f) => t + clamp(1 - Math.hypot(lamp.x - f.x, lamp.y - f.y) / 170, 0, 1), 0) / Math.max(1, flaws.length);
      return { s: clamp(light * (1 - glareArt) * (1 - flawVis * 0.6), 0, 1), gx, gy, bright, flawVis };
    };
    g.input({
      down: p => { if (Math.hypot(p.x - lamp.x, p.y - lamp.y) < 50) dragging = true; },
      move: p => { if (dragging) { lamp.x = clamp(p.x, 10, g.W - 10); lamp.y = clamp(p.y, 10, g.H - 10); } },
      up: () => { dragging = false; },
    });
    g.buttons([
      { label: 'Snap 📸', kind: 'mint', onClick: () => { sfx.cash(); done(score().s); } },
      { label: 'Quick phone snap', kind: 'ghost', onClick: () => done(0.3) },
    ]);

    g.loop(ctx => {
      const sc = score();
      ctx.fillStyle = `rgba(255,255,240,${0.04 + sc.bright * 0.12})`;
      ctx.fillRect(0, 0, g.W, g.H);
      drawCard(ctx, cx, cy, cw, ch, card);
      ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - sc.bright)})`;
      ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
      for (const f of flaws) {
        const v = clamp(1 - Math.hypot(lamp.x - f.x, lamp.y - f.y) / 170, 0, 1);
        if (v <= 0) continue;
        ctx.strokeStyle = `rgba(255,61,110,${v})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(f.x - 10, f.y - 4); ctx.lineTo(f.x + 10, f.y + 4); ctx.moveTo(f.x - 6, f.y + 6); ctx.lineTo(f.x + 8, f.y - 6); ctx.stroke();
      }
      const gr = ctx.createRadialGradient(sc.gx, sc.gy, 0, sc.gx, sc.gy, cw * 0.45);
      gr.addColorStop(0, `rgba(255,255,255,${0.85 * sc.bright})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
      ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('☀️', lamp.x, lamp.y);
      text(ctx, `Photo quality ${Math.round(sc.s * 100)}%`, g.W / 2, g.H - 12, { size: 14, weight: 800, color: sc.s > 0.7 ? '#3dffb0' : sc.s > 0.4 ? '#ffd23d' : '#ff3d6e' });
    });
  });
}
