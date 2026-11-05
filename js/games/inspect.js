// 🔍 Return inspection: a buyer sent a card back. Is it the one you sold?
// Tap differences on the returned card, then accept or reject the return before time runs out.
import { play } from './overlay.js';
import { drawCard, text } from '../draw.js';
import { sfx } from '../audio.js';
import { pick, cardDef } from '../state.js';
import { SETS } from '../data.js';

// Where each difference shows on each franchise's layout (fraction of card height).
const ZONES = {
  choke: { name: 0.07, art: 0.32, rarity: 0.55, frame: 0.95 },
  yuno: { name: 0.07, art: 0.44, frame: 0.95 },
  tragic: { name: 0.09, art: 0.34, rarity: 0.59, frame: 0.95 },
  cryptid: { name: 0.6, art: 0.29, rarity: 0.9, frame: 0.03 },
};
const typo = n => { const i = Math.max(1, Math.floor(n.length / 2) - 1); return n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2); };

// Resolves 'accept' or 'reject'.
export function inspectReturn(card, fake) {
  const zones = ZONES[SETS[card.set]?.style] || ZONES.choke;
  const diffs = fake ? Object.keys(zones).sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2)) : [];
  const returned = { ...card };
  const opts = {};
  if (diffs.includes('name')) returned.printName = typo(cardDef(card)?.name || card.name);
  // a different card's illustration from the same set
  if (diffs.includes('art')) returned.spec = pick(SETS[card.set].cards.filter(c => c !== cardDef(card))).a;
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
        const zone = diffs.find(k => Math.abs(zones[k] - v) < 0.1);
        if (zone) { found.add(zone); sfx.scale(); } else { penalty += 2; sfx.fail(); }
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
        const zy = cy - ch / 2 + zones[z] * ch;
        ctx.strokeStyle = '#3dffb0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(rx, zy, cw * 0.5, ch * (z === 'art' ? 0.22 : 0.07), 0, 0, 7); ctx.stroke();
      }
      text(ctx, `${Math.ceil(left)}s · ${found.size} difference${found.size === 1 ? '' : 's'} found`, g.W / 2, g.H - 10, { size: 13, weight: 800, color: left < 5 ? '#ff3d6e' : '#c8cede' });
    });
  });
}
