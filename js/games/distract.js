// 🥁 Distraction: before a sleight-of-hand swap, stage a distraction with a 4-beat rhythm.
// Tap as each shrinking ring hits the target. Better timing = longer look-away = wider green zone.
import { play } from './overlay.js';
import { text } from '../draw.js';
import { sfx } from '../audio.js';

const MOVES = [
  { label: '📦 Knock over the display', tempo: 650 },
  { label: '📞 Fake a phone call', tempo: 800 },
  { label: '👉 “Is that your car being towed?”', tempo: 560 },
];

// Resolves with bonus degrees for the swap wheel (0–30).
export function distraction() {
  return play({ title: '🥁 Stage a distraction', sub: 'Pick a move, then tap as each ring lands on the circle.', height: 0.45 }, (g, done) => {
    let move = null, start = 0;
    const beats = [];
    const scores = [];
    const FALL = 900;

    const begin = m => {
      move = m;
      start = performance.now() + 500;
      for (let i = 0; i < 4; i++) beats.push(start + FALL + i * m.tempo);
      g.buttons([]);
      g.sub(`${m.label}. Tap anywhere on the beat.`);
    };
    g.buttons(MOVES.map(m => ({ label: m.label, onClick: () => begin(m) })));

    g.input({
      down: () => {
        if (!move) return;
        const now = performance.now();
        const i = scores.length;
        if (i >= 4) return;
        const off = Math.abs(now - beats[i]);
        const s = off < 70 ? 1 : off < 150 ? 0.6 : off < 260 ? 0.25 : 0;
        scores.push(s);
        if (s >= 0.6) sfx.scale(); else sfx.tap();
      },
    });

    g.loop(ctx => {
      const cx = g.W / 2, cy = g.H * 0.5, R = Math.min(g.W, g.H) * 0.16;
      ctx.strokeStyle = '#3dffb0';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      if (!move) { text(ctx, 'Choose a distraction below', cx, cy, { size: 14, color: '#c8cede' }); return; }
      const now = performance.now();
      // count misses for beats that passed untapped
      while (scores.length < 4 && now > beats[scores.length] + 300) scores.push(0);
      beats.forEach((b, i) => {
        if (i < scores.length) return;
        const k = (b - now) / FALL;
        if (k > 1 || k < -0.3) return;
        ctx.strokeStyle = `rgba(255,210,61,${1 - Math.max(0, k) * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, R * (1 + Math.max(0, k) * 2), 0, 7); ctx.stroke();
      });
      const labels = scores.map(s => (s >= 1 ? 'PERFECT' : s >= 0.6 ? 'GOOD' : s > 0 ? 'OK' : 'MISS'));
      text(ctx, labels.join(' · '), cx, g.H * 0.88, { size: 13, weight: 800, color: '#ffd23d' });
      if (scores.length === 4) {
        const bonus = Math.round((scores.reduce((a, b) => a + b, 0) / 4) * 30);
        text(ctx, `+${bonus}° on the swap`, cx, cy, { size: 18, weight: 900, color: '#3dffb0' });
        setTimeout(() => done(bonus), 700);
        move = null;
        beats.length = 0;
      }
    });
  });
}
