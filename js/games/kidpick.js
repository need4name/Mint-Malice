// 🎲 Kid's pick: a kid insists on choosing their own pack from the display.
// One pack is a heavy hit pack. Tap two packs to swap them, but only while the kid looks away.
import { play } from './overlay.js';
import { drawPack, text } from '../draw.js';
import { sfx } from '../audio.js';
import { haptic } from '../ui.js';

// Resolves 'safe' (kid took a dud), 'lost' (kid took the hit) or 'caught'.
export function kidPick({ set }) {
  return play({ title: '🎲 “I wanna pick my own!”', sub: 'The glowing pack hides a hit. Tap two packs to swap them while the kid isn’t looking.', height: 0.5 }, (g, done) => {
    const N = 5;
    const order = [0, 1, 2, 3, 4]; // order[slot] = pack id; pack 0 is the heavy one
    const slotOf = id => order.indexOf(id);
    const shuffle = Math.floor(Math.random() * N);
    [order[0], order[shuffle]] = [order[shuffle], order[0]];
    const pw = Math.min(56, (g.W - 40) / N - 8), ph = pw * 1.45;
    const gap = (g.W - N * pw) / (N + 1);
    const slotX = i => gap + i * (pw + gap);
    const py = g.H * 0.55;
    let watching = true, phaseEnd = 1.2, target = Math.floor(Math.random() * N), hand = g.W / 2;
    let sel = null;
    const total = 9;

    g.input({
      down: p => {
        const i = [...Array(N).keys()].find(k => p.x >= slotX(k) - 6 && p.x <= slotX(k) + pw + 6 && p.y >= py - 10 && p.y <= py + ph + 10);
        if (i === undefined) return;
        if (sel === null) { sel = i; sfx.tap(); return; }
        if (sel === i) { sel = null; return; }
        if (watching) { sfx.fail(); haptic([60, 40, 60], 'bad'); done('caught'); return; }
        [order[sel], order[i]] = [order[i], order[sel]];
        sel = null;
        sfx.scale();
      },
    });
    g.buttons([]);

    g.loop((ctx, t, el) => {
      if (el > phaseEnd) {
        watching = !watching;
        phaseEnd = el + (watching ? 0.9 + Math.random() * 1.1 : 0.7 + Math.random() * 0.9);
        // kids love shiny things: they drift toward the glowing pack
        if (watching) target = Math.random() < 0.55 ? slotOf(0) : Math.floor(Math.random() * N);
      }
      const tx = slotX(target) + pw / 2;
      hand += (tx - hand) * 0.04;
      const left = Math.max(0, total - el);
      if (left <= 0) {
        const grabbed = order[Math.max(0, Math.min(N - 1, Math.round((hand - gap - pw / 2) / (pw + gap))))];
        done(grabbed === 0 ? 'lost' : 'safe');
        return;
      }
      ctx.font = `${g.H * 0.16}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(watching ? '🧒' : '📱', g.W / 2, g.H * 0.13);
      text(ctx, watching ? '👀 WATCHING' : '🙈 DISTRACTED — SWAP NOW', g.W / 2, g.H * 0.27, { size: 14, weight: 900, color: watching ? '#ff3d6e' : '#3dffb0' });
      for (let i = 0; i < N; i++) {
        const id = order[i];
        drawPack(ctx, slotX(i), py - (sel === i ? 10 : 0), pw, ph, { set }, { glow: id === 0 ? '#ff3dff' : sel === i ? '#ffd23d' : null });
      }
      ctx.font = `${pw * 0.7}px serif`;
      ctx.fillText('🤚', hand, py - 26 + Math.sin(t / 200) * 4);
      text(ctx, `${left.toFixed(1)}s until they grab`, g.W / 2, g.H * 0.95, { size: 12, color: '#c8cede', weight: 700 });
    });
  });
}
