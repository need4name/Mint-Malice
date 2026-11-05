// 🔍 Return inspection: a buyer sent a card back. Is it the one you sold?
// Tap differences on the returned card, then accept or reject the return before time runs out.
import { play } from './overlay.js';
import { drawCard, text } from '../draw.js';
import { sfx } from '../audio.js';
import { pick } from '../state.js';

const ZONES = {
  name: { y0: 0, y1: 0.13, label: 'name' },
  art: { y0: 0.13, y1: 0.56, label: 'art' },
  rarity: { y0: 0.56, y1: 0.86, label: 'rarity line' },
  frame: { y0: 0.86, y1: 1, label: 'frame' },
};
const ARTS = ['🐀', '🦖', '🐸', '👾', '🐲', '🦄', '🐙'];
const typo = n => { const i = Math.max(1, Math.floor(n.length / 2) - 1); return n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2); };

// Resolves 'accept' or 'reject'.
export function inspectReturn(card, fake) {
  const diffs = fake ? [...Object.keys(ZONES)].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2)) : [];
  const returned = { ...card };
  const opts = {};
  if (diffs.includes('name')) returned.name = typo(card.name);
  if (diffs.includes('art')) returned.art = pick(ARTS.filter(a => a !== card.art));
  if (diffs.includes('rarity')) returned.rarity = card.rarity === 'holo' ? 'ultra' : 'holo';
  if (diffs.includes('frame')) opts.frame = '#d7b13a';
  return play({ title: '🔍 Inspect the return', sub: `A buyer returned <b>${card.name}</b>. Tap anything different on the returned card, then decide.`, height: 0.55 }, (g, done) => {
    const cw = Math.min(g.H * 0.72 / 1.4, g.W * 0.44), ch = cw * 1.4;
    const ox = g.W * 0.27, rx = g.W * 0.73, cy = g.H * 0.47;
    const found = new Set();
    let penalty = 0;
    const LIMIT = 15;
    g.input({
      down: p => {
        if (Math.abs(p.x - rx) > cw / 2 || Math.abs(p.y - cy) > ch / 2) return;
        const v = (p.y - (cy - ch / 2)) / ch;
        const zone = Object.keys(ZONES).find(k => v >= ZONES[k].y0 && v < ZONES[k].y1);
        if (diffs.includes(zone)) { found.add(zone); sfx.scale(); } else { penalty += 2; sfx.fail(); }
      },
    });
    g.buttons([
      { label: 'Accept return', kind: 'mint', onClick: () => done('accept') },
      { label: 'Reject: not my card', kind: 'danger', onClick: () => done('reject') },
    ]);
    g.loop((ctx, t, el) => {
      const left = LIMIT - el - penalty;
      if (left <= 0) { done('accept'); return; }
      drawCard(ctx, ox, cy, cw, ch, card);
      drawCard(ctx, rx, cy, cw, ch, returned, opts);
      text(ctx, 'You sold', ox, 12, { size: 12, weight: 800, color: '#8a93a6' });
      text(ctx, 'Returned', rx, 12, { size: 12, weight: 800, color: '#ffd23d' });
      for (const z of found) {
        const zy = cy - ch / 2 + ((ZONES[z].y0 + ZONES[z].y1) / 2) * ch;
        ctx.strokeStyle = '#3dffb0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(rx, zy, cw * 0.5, ch * (ZONES[z].y1 - ZONES[z].y0) * 0.55, 0, 0, 7); ctx.stroke();
      }
      text(ctx, `${Math.ceil(left)}s · ${found.size} difference${found.size === 1 ? '' : 's'} found`, g.W / 2, g.H - 10, { size: 13, weight: 800, color: left < 5 ? '#ff3d6e' : '#c8cede' });
    });
  });
}
