// 🚨 Raid cleanup: Trading Standards are at the door. Drag contraband into hiding spots
// before the timer runs out. Anything left in sight is seized.
import { play, inRect } from './overlay.js';
import { text, rr } from '../draw.js';
import { sfx } from '../audio.js';
import { haptic } from '../ui.js';

// items: [{ id, icon, label }]; spots: [{ label, icon, cap }]. Resolves the ids left in sight.
export function raidCleanup(items, spots) {
  return play({ title: '🚨 TRADING STANDARDS!', sub: 'They’re at the door. Drag the evidence into hiding spots. Each spot only holds so much.', height: 0.62, cls: 'alarm' }, (g, done) => {
    const LIMIT = 15;
    const cols = 4;
    const sz = Math.min(54, (g.W - 40) / cols - 8);
    const pos = items.map((it, i) => ({ ...it, x: 20 + (i % cols) * (sz + 10) + sz / 2 + (g.W - cols * (sz + 10) - 20) / 2, y: g.H * 0.52 + Math.floor(i / cols) * (sz + 10), hidden: null }));
    const sw = (g.W - 20 - (spots.length - 1) * 8) / spots.length;
    const rects = spots.map((s, i) => ({ ...s, x: 10 + i * (sw + 8), y: 40, w: sw, h: g.H * 0.28, used: 0 }));
    let drag = null, beat = 0;

    g.input({
      down: p => {
        const it = [...pos].reverse().find(it => !it.hidden && Math.hypot(p.x - it.x, p.y - it.y) < sz * 0.6);
        if (it) drag = { it, dx: it.x - p.x, dy: it.y - p.y };
      },
      move: p => { if (drag) { drag.it.x = p.x + drag.dx; drag.it.y = p.y + drag.dy; } },
      up: () => {
        if (!drag) return;
        const r = rects.find(r => inRect(drag.it, r));
        if (r && r.used < r.cap) { r.used++; drag.it.hidden = r.label; sfx.scale(); haptic(10); }
        else if (r) sfx.fail();
        drag = null;
      },
    });
    g.buttons([{ label: 'Open the door', kind: 'danger', onClick: () => done(pos.filter(p => !p.hidden).map(p => p.id)) }]);

    g.loop((ctx, t, el) => {
      const left = LIMIT - el;
      if (left <= 0) { done(pos.filter(p => !p.hidden).map(p => p.id)); return; }
      if (el - beat > 0.5) { beat = el; sfx.thump(); }
      ctx.fillStyle = `rgba(255,61,110,${0.06 + 0.06 * Math.sin(t / 150)})`;
      ctx.fillRect(0, 0, g.W, g.H);
      text(ctx, `🚪 KNOCK KNOCK · ${Math.ceil(left)}s`, g.W / 2, 18, { size: 16, weight: 900, color: '#ff3d6e' });
      for (const r of rects) {
        ctx.fillStyle = r.used >= r.cap ? '#2a1a20' : '#1e2430';
        rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
        ctx.strokeStyle = drag ? '#ffd23d' : '#2a3140'; ctx.lineWidth = 2;
        rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.stroke();
        ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(r.icon, r.x + r.w / 2, r.y + r.h * 0.35);
        text(ctx, r.label, r.x + r.w / 2, r.y + r.h * 0.68, { size: 10, weight: 700 });
        text(ctx, `${r.used}/${r.cap}`, r.x + r.w / 2, r.y + r.h * 0.86, { size: 11, weight: 800, color: r.used >= r.cap ? '#ff3d6e' : '#3dffb0' });
      }
      text(ctx, `${pos.filter(p => !p.hidden).length} items in plain sight`, g.W / 2, g.H * 0.4, { size: 12, color: '#c8cede', weight: 700 });
      for (const it of pos) {
        if (it.hidden) continue;
        ctx.fillStyle = '#2a1f18'; rr(ctx, it.x - sz / 2, it.y - sz / 2, sz, sz, 10); ctx.fill();
        ctx.font = `${sz * 0.55}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.icon, it.x, it.y - 4);
        text(ctx, it.label, it.x, it.y + sz * 0.36, { size: 8, weight: 700, color: '#c8cede' });
      }
    });
  });
}
