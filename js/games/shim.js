// ⚖️ Weight balancing: an emptied pack is light. Drag shims onto it until it matches the
// set's dud weight within ±0.05g. Packs that match pass a collector's scale.
import { play, inRect } from './overlay.js';
import { drawPack, text, rr } from '../draw.js';
import { SETS } from '../data.js';
import { S, hasUpg, gauss } from '../state.js';
import { sfx } from '../audio.js';

const SHIMS = [
  { id: 'common', label: 'Bulk common', icon: '🃏', g: () => 1.78 + gauss() * 0.02, uses: 'commons' },
  { id: 'code', label: 'Code card', icon: '🔖', g: () => 1.21 + gauss() * 0.02 },
  { id: 'board', label: 'Card sliver', icon: '📏', g: () => 0.15 + gauss() * 0.01 },
  { id: 'glue', label: 'Glue dot', icon: '💧', g: () => 0.04 },
];

// Resolves { ok, w, commonsUsed }.
export function balance(pack) {
  const target = SETS[pack.set].weights.light;
  const precise = hasUpg('equip1');
  return play({ title: '⚖️ Balance the weight', sub: `Bring it to ${target.toFixed(2)}g (±0.05g). Drag shims onto the pack; tap a placed shim to remove it.`, height: 0.56 }, (g, done) => {
    let w = pack.w;
    const placed = [];
    let drag = null;
    let commons = 0;
    let noise = gauss() * 0.1;
    const trayY = g.H * 0.78, tw = (g.W - 50) / SHIMS.length;
    const tile = i => ({ x: 10 + i * (tw + 10), y: trayY, w: tw, h: g.H * 0.18 });
    const packR = { x: g.W / 2 - 45, y: g.H * 0.12, w: 90, h: 130 };

    const reading = () => (precise ? w.toFixed(2) : (Math.round((w + noise) * 10) / 10).toFixed(1));
    g.input({
      down: p => {
        // remove a placed shim
        const chip = placed.findIndex((_, i) => inRect(p, { x: 10 + (i % 8) * 36, y: g.H * 0.58 + Math.floor(i / 8) * 34, w: 32, h: 30 }));
        if (chip >= 0) {
          const [s] = placed.splice(chip, 1);
          w -= s.g;
          if (s.id === 'common') commons--;
          noise = gauss() * 0.1;
          sfx.tap();
          return;
        }
        const i = SHIMS.findIndex((_, k) => inRect(p, tile(k)));
        if (i >= 0) drag = { i, x: p.x, y: p.y };
      },
      move: p => { if (drag) { drag.x = p.x; drag.y = p.y; } },
      up: () => {
        if (!drag) return;
        const sh = SHIMS[drag.i];
        if (inRect(drag, { x: packR.x - 40, y: packR.y - 40, w: packR.w + 80, h: packR.h + 80 })) {
          if (sh.uses === 'commons' && S.commons - commons < 1) { sfx.fail(); drag = null; return; }
          const gr = sh.g();
          placed.push({ id: sh.id, icon: sh.icon, g: gr });
          w += gr;
          if (sh.uses === 'commons') commons++;
          noise = gauss() * 0.1;
          sfx.scale();
        }
        drag = null;
      },
    });
    g.buttons([
      { label: 'Done', kind: 'mint', onClick: () => done({ ok: Math.abs(w - target) <= 0.05, w, commonsUsed: commons }) },
      { label: 'Cancel', kind: 'ghost', onClick: () => done({ ok: false, w: pack.w, commonsUsed: 0, cancelled: true }) },
    ]);

    g.loop(ctx => {
      drawPack(ctx, packR.x, packR.y, packR.w, packR.h, { set: pack.set }, { openTop: true });
      ctx.fillStyle = '#c9ced8';
      rr(ctx, g.W / 2 - 80, packR.y + packR.h, 160, 8, 3); ctx.fill();
      ctx.fillStyle = '#0d1a12';
      rr(ctx, g.W / 2 - 60, packR.y + packR.h + 14, 120, 30, 5); ctx.fill();
      const diff = w - target;
      const ok = Math.abs(diff) <= 0.05;
      text(ctx, `${reading()} g`, g.W / 2, packR.y + packR.h + 29, { size: 18, weight: 800, color: '#62ff9a' });
      text(ctx, precise ? (ok ? '✓ ON TARGET' : diff < 0 ? `${(-diff).toFixed(2)}g light` : `${diff.toFixed(2)}g heavy`) : 'kitchen scale ±0.1g: trust carefully', g.W / 2, packR.y + packR.h + 58, { size: 11, weight: 700, color: ok && precise ? '#3dffb0' : '#ffd23d' });
      placed.forEach((s, i) => {
        const x = 10 + (i % 8) * 36, y = g.H * 0.58 + Math.floor(i / 8) * 34;
        ctx.fillStyle = '#2a3140'; rr(ctx, x, y, 32, 30, 6); ctx.fill();
        ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.icon, x + 16, y + 15);
      });
      SHIMS.forEach((s, i) => {
        const r = tile(i);
        ctx.fillStyle = '#1e2430'; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
        ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.icon, r.x + r.w / 2, r.y + r.h * 0.33);
        text(ctx, s.label, r.x + r.w / 2, r.y + r.h * 0.66, { size: 10, weight: 700 });
        const hint = s.id === 'common' ? `~1.78g · ${S.commons - commons} left` : s.id === 'code' ? '~1.21g' : s.id === 'board' ? '~0.15g' : '~0.04g';
        text(ctx, hint, r.x + r.w / 2, r.y + r.h * 0.86, { size: 9, color: '#8a93a6', weight: 600 });
      });
      if (drag) { ctx.font = '30px serif'; ctx.fillText(SHIMS[drag.i].icon, drag.x, drag.y); }
    });
  });
}
