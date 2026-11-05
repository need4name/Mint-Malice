// ✂️ Centering fix: swipe along an edge to shave a sliver off that border.
// Better centering raises value, but trim too much and the card is undersized (experts notice).
import { play } from './overlay.js';
import { drawCard, text, rr } from '../draw.js';
import { sfx } from '../audio.js';

const BORDER = 6;   // mm of border on each axis, split by the centering share
const SHAVE = 0.4;  // mm removed per swipe
export const UNDERSIZED = 1.0; // mm total trimmed before it's measurably small

// Resolves { lr, tb, trimmed (mm) } or null if cancelled.
export function trimCard(card) {
  return play({ title: '✂️ Trim the centering', sub: 'Swipe along an edge to shave that border. Aim for even borders. Over 1mm total and the card is undersized.', height: 0.58 }, (g, done) => {
    // border widths in mm
    const b = { l: BORDER * card.lr / 100, r: BORDER * (100 - card.lr) / 100, t: BORDER * card.tb / 100, bo: BORDER * (100 - card.tb) / 100 };
    let trimmed = card.trimmed || 0;
    const ch = g.H * 0.82, cw = ch / 1.4;
    const cx = g.W / 2, cy = g.H * 0.47;
    const scale = cw / 63; // px per mm (a card is 63mm wide)
    let stroke = null;

    const lr = () => Math.round(b.l / (b.l + b.r) * 100);
    const tb = () => Math.round(b.t / (b.t + b.bo) * 100);
    const edge = p => {
      const x0 = cx - cw / 2, x1 = cx + cw / 2, y0 = cy - ch / 2, y1 = cy + ch / 2, z = 30;
      if (Math.abs(p.x - x0) < z && p.y > y0 && p.y < y1) return 'l';
      if (Math.abs(p.x - x1) < z && p.y > y0 && p.y < y1) return 'r';
      if (Math.abs(p.y - y0) < z && p.x > x0 && p.x < x1) return 't';
      if (Math.abs(p.y - y1) < z && p.x > x0 && p.x < x1) return 'bo';
      return null;
    };
    g.input({
      down: p => { const e = edge(p); if (e) stroke = { e, x: p.x, y: p.y }; },
      up: p => {
        if (!stroke) return;
        const along = stroke.e === 'l' || stroke.e === 'r' ? Math.abs(p.y - stroke.y) : Math.abs(p.x - stroke.x);
        if (along > 40 && b[stroke.e] > SHAVE + 0.2) {
          b[stroke.e] -= SHAVE;
          trimmed += SHAVE;
          sfx.rip();
        }
        stroke = null;
      },
    });
    g.buttons([
      { label: 'Done', kind: 'mint', onClick: () => done({ lr: lr(), tb: tb(), trimmed: Math.round(trimmed * 10) / 10 }) },
      { label: 'Cancel', kind: 'ghost', onClick: () => done(null) },
    ]);

    g.loop(ctx => {
      // shrink the drawn card by the trimmed amount, offset the art by the border imbalance
      const shrinkX = (BORDER - b.l - b.r) * scale, shrinkY = (BORDER - b.t - b.bo) * scale;
      const w = cw - shrinkX, h = ch - shrinkY;
      ctx.fillStyle = '#f4efe1';
      rr(ctx, cx - w / 2, cy - h / 2, w, h, 6); ctx.fill();
      const innerW = w - (b.l + b.r) * scale * 2.2, innerH = h - (b.t + b.bo) * scale * 2.2;
      const ix = cx - w / 2 + b.l * scale * 2.2 + innerW / 2, iy = cy - h / 2 + b.t * scale * 2.2 + innerH / 2;
      drawCard(ctx, ix, iy, innerW, innerH, card, { holo: false });
      ctx.strokeStyle = 'rgba(255,210,61,.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
      rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 6); ctx.stroke(); ctx.setLineDash([]);
      const bad = Math.max(lr(), 100 - lr(), tb(), 100 - tb());
      text(ctx, `L/R ${lr()}/${100 - lr()}  ·  T/B ${tb()}/${100 - tb()}`, g.W / 2, 14, { size: 14, weight: 800, color: bad <= 55 ? '#3dffb0' : bad <= 60 ? '#ffd23d' : '#ff3d6e' });
      text(ctx, `Trimmed ${trimmed.toFixed(1)}mm${trimmed > UNDERSIZED ? ' · UNDERSIZED' : ''}`, g.W / 2, g.H - 10, { size: 12, weight: 800, color: trimmed > UNDERSIZED ? '#ff3d6e' : '#c8cede' });
    });
  });
}
