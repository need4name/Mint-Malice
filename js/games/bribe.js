// 💵 Inspector bribe: drag to stack cash. Watch the inspector's tells: glances at the cash
// mean you're getting close. Too little insults them; too much makes them suspicious.
import { play } from './overlay.js';
import { text, rr } from '../draw.js';
import { money } from '../ui.js';
import { sfx } from '../audio.js';
import { clamp } from '../state.js';

// Resolves { result: 'accepted'|'insulted'|'suspicious'|'declined', amount }.
export function bribe({ lo, hi, cap }) {
  return play({ title: '💵 A quiet word with the inspector', sub: 'Drag up and down to adjust the envelope. Read the face, then slide it across.', height: 0.5 }, (g, done) => {
    const max = Math.max(hi * 1.6, lo * 2);
    let amount = Math.round(lo * 0.4);
    g.input({
      down: p => { amount = Math.round(clamp(1 - p.y / g.H, 0, 1) * max); },
      move: p => { amount = Math.round(clamp(1 - p.y / g.H, 0, 1) * max); },
    });
    const slide = () => {
      if (amount > cap) return;
      if (amount < lo) { sfx.fail(); done({ result: 'insulted', amount }); }
      else if (amount > hi) { sfx.fail(); done({ result: 'suspicious', amount }); }
      else { sfx.cash(); done({ result: 'accepted', amount }); }
    };
    g.buttons([
      { label: 'Slide it across', kind: 'mint', onClick: slide },
      { label: 'Change my mind', kind: 'ghost', onClick: () => done({ result: 'declined', amount: 0 }) },
    ]);

    g.loop((ctx, t) => {
      // tells: the closer to the window, the more the eyes dart to the envelope
      const near = amount < lo ? clamp(1 - (lo - amount) / (lo * 0.6), 0, 1) : amount <= hi ? 1 : clamp(1 - (amount - hi) / (hi * 0.4), 0, 1);
      const glance = Math.sin(t / (380 - near * 250)) > 1 - near * 0.9;
      const face = amount > hi * 1.05 ? '🤨' : glance ? (amount >= lo && amount <= hi ? '😏' : '👀') : '😐';
      ctx.font = `${g.H * 0.3}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(face, g.W * 0.35, g.H * 0.4);
      // cash stack
      const bills = Math.ceil((amount / max) * 18);
      for (let i = 0; i < bills; i++) {
        ctx.fillStyle = i % 2 ? '#2f8f5b' : '#3aa96b';
        rr(ctx, g.W * 0.65, g.H * 0.85 - i * 9, g.W * 0.24, 8, 2); ctx.fill();
      }
      text(ctx, money(amount), g.W * 0.77, g.H * 0.92, { size: 18, weight: 900, color: amount > cap ? '#ff3d6e' : '#3dffb0' });
      if (amount > cap) text(ctx, 'You don’t have that much', g.W * 0.77, g.H * 0.08, { size: 11, color: '#ff3d6e', weight: 700 });
    });
  });
}
