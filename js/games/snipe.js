// ⏱️ Live auction: the last bid when the clock hits zero wins. Rivals react after a short
// delay, so a bid in the final half-second can't be answered. Bid too late and it's closed.
import { play } from './overlay.js';
import { text, rr } from '../draw.js';
import { money } from '../ui.js';
import { sfx } from '../audio.js';
import { S } from '../state.js';

// Resolves { won, price }.
export function snipe({ title, price, rival, step }) {
  return play({ title: '⏱️ Ending live', sub: `${title}. Highest bidder when the timer hits zero wins.`, height: 0.42 }, (g, done) => {
    const LEN = 12;
    let leader = 'rival', cur = price, reactAt = null, closed = false, lateTap = false;
    const log = [];
    const myBid = () => {
      if (closed) { lateTap = true; sfx.fail(); return; }
      if (leader === 'you') return;
      if (cur + step > S.cash) { log.unshift('Not enough cash for that bid'); return; }
      cur += step;
      leader = 'you';
      reactAt = performance.now() + 400 + Math.random() * 600;
      log.unshift(`You bid ${money(cur)}`);
      sfx.tap();
    };
    g.buttons([{ label: 'BID', kind: 'mint', onClick: myBid }]);
    g.input({ down: myBid });

    g.loop((ctx, t, el) => {
      const left = LEN - el;
      const now = performance.now();
      if (!closed && left <= 0) {
        closed = true;
        setTimeout(() => done({ won: leader === 'you', price: cur }), 900);
      }
      // rival: answers your bid after a reaction delay, up to their max
      if (!closed && leader === 'you' && reactAt && now >= reactAt) {
        reactAt = null;
        if (cur + step <= rival) { cur += step; leader = 'rival'; log.unshift(`Rival bid ${money(cur)}`); sfx.fail(); }
      }
      // occasional early rival bids to push the price
      if (!closed && leader === 'rival' && Math.random() < 0.004 && cur + step <= rival * 0.8) { cur += step; log.unshift(`Rival bid ${money(cur)}`); }
      const k = Math.max(0, left) / LEN;
      ctx.fillStyle = '#2a3140'; rr(ctx, 16, 16, g.W - 32, 12, 6); ctx.fill();
      ctx.fillStyle = left < 2 ? '#ff3d6e' : '#ffd23d'; rr(ctx, 16, 16, (g.W - 32) * k, 12, 6); ctx.fill();
      text(ctx, closed ? (leader === 'you' ? 'SOLD TO YOU!' : 'SOLD TO RIVAL') : `${left.toFixed(1)}s`, g.W / 2, g.H * 0.28, { size: 30, weight: 900, color: closed ? (leader === 'you' ? '#3dffb0' : '#ff3d6e') : '#fff' });
      text(ctx, money(cur), g.W / 2, g.H * 0.48, { size: 26, weight: 900, color: '#ffd23d' });
      text(ctx, leader === 'you' ? 'You’re winning' : 'Rival is winning', g.W / 2, g.H * 0.6, { size: 13, color: leader === 'you' ? '#3dffb0' : '#ff8aa6', weight: 700 });
      log.slice(0, 3).forEach((l, i) => text(ctx, l, g.W / 2, g.H * 0.74 + i * 16, { size: 11, color: '#8a93a6' }));
      if (lateTap) text(ctx, 'Too late! Auction closed.', g.W / 2, g.H * 0.95, { size: 12, color: '#ff3d6e', weight: 800 });
    });
  });
}
