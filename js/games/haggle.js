// 🤝 Price haggle: drag the dial to set a markup while the customer's face reacts.
// Release on "Offer" while they're still willing. Push too far for too long and they walk.
import { play } from './overlay.js';
import { text, rr } from '../draw.js';
import { money } from '../ui.js';
import { sfx } from '../audio.js';
import { clamp } from '../state.js';

const MIN = 0.8, MAX = 2.0;

// Resolves with a price multiplier, or null if the customer walks out.
export function haggle({ name, emoji, price, limit }) {
  return play({ title: '🤝 Haggle', sub: `${name} wants it for ${money(price)}. Drag to set your price, then make the offer.`, height: 0.42 }, (g, done) => {
    let mult = 1;
    let anger = 0;
    let last = performance.now();
    const r = () => mult / limit;
    const mood = () => (r() < 0.78 ? ['😃', 'Happy'] : r() < 0.93 ? ['🙂', 'Fine'] : r() <= 1 ? ['😬', 'Hesitant'] : ['😠', 'Annoyed']);

    g.input({
      down: p => { mult = MIN + (MAX - MIN) * clamp(p.x / g.W, 0, 1); },
      move: p => { mult = MIN + (MAX - MIN) * clamp(p.x / g.W, 0, 1); },
    });
    const offer = () => {
      if (r() <= 1) { sfx.cash(); done(mult); } else { sfx.fail(); done(null); }
    };
    g.buttons([
      { label: 'Make the offer', kind: 'mint', onClick: offer },
      { label: `Sell at ${money(price)}`, kind: 'ghost', onClick: () => done(1) },
    ]);

    g.loop((ctx, t) => {
      const dt = (t - last) / 1000;
      last = t;
      if (r() > 1) anger += dt; else anger = Math.max(0, anger - dt * 0.5);
      if (anger > 1.3) { sfx.fail(); done(null); return; }
      const [face, label] = mood();
      const wob = r() > 1 ? Math.sin(t / 40) * 4 : 0;
      ctx.font = `${g.H * 0.32}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(face, g.W / 2 + wob, g.H * 0.3);
      text(ctx, `${emoji} ${label}`, g.W / 2, g.H * 0.56, { size: 14, color: '#c8cede' });
      text(ctx, money(price * mult), g.W / 2, g.H * 0.68, { size: 26, weight: 900, color: mult >= 1 ? '#3dffb0' : '#ffd23d' });
      // dial track
      const y = g.H * 0.86, x0 = 16, w = g.W - 32;
      ctx.fillStyle = '#2a3140';
      rr(ctx, x0, y - 5, w, 10, 5); ctx.fill();
      const k = (mult - MIN) / (MAX - MIN);
      ctx.fillStyle = '#ffd23d';
      rr(ctx, x0, y - 5, w * k, 10, 5); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x0 + w * k, y, 13, 0, 7); ctx.fill();
      text(ctx, `×${mult.toFixed(2)}`, x0 + w * k, y - 24, { size: 12, weight: 800 });
      if (anger > 0.2) text(ctx, 'They’re reaching for the door…', g.W / 2, g.H * 0.08, { size: 13, weight: 800, color: '#ff3d6e' });
    });
  });
}

export function haggleLimit(arch, bonus) {
  const ranges = { timmy: [1.05, 1.35], parent: [1.2, 1.7], sweat: [1.0, 1.25], streamer: [1.1, 1.4] };
  const [a, b] = ranges[arch] || [1.05, 1.3];
  return (a + Math.random() * (b - a)) * (1 + bonus);
}
