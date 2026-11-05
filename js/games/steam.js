// ♨️ Steam-open: hold to run the kettle. Glue lifts in the warm band; too hot wrinkles the foil.
// A clean steam job leaves the wrapper intact, giving a bonus on the reseal.
import { play } from './overlay.js';
import { drawPack, text, rr } from '../draw.js';
import { sfx } from '../audio.js';

// Resolves { opened, bonus } (bonus = crimp quality points, 0–25).
export function steamOpen(pack) {
  return play({ title: '♨️ Steam it open', sub: 'Hold the picture to heat the kettle, let go to cool it. Keep the needle in the green band until the glue lets go.', height: 0.5 }, (g, done) => {
    let holding = false, temp = 20, glue = 0, wrinkle = 0, last = performance.now();
    const LIMIT = 18;
    g.input({ down: () => { holding = true; }, up: () => { holding = false; } });
    g.buttons([{ label: 'Give up', kind: 'ghost', onClick: () => done({ opened: false, bonus: 0 }) }]);

    g.loop((ctx, t, el) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      temp += (holding ? 30 : -16) * dt;
      temp = Math.max(20, Math.min(110, temp));
      if (temp >= 60 && temp <= 85) glue += 26 * dt;
      if (temp > 90) { wrinkle += 35 * dt; if (Math.random() < 0.2) sfx.sizzle(); }
      if (glue >= 100) {
        const bonus = Math.round(Math.max(0, 25 - wrinkle * 0.5));
        sfx.success();
        done({ opened: true, bonus });
        return;
      }
      if (el > LIMIT) { sfx.fail(); done({ opened: false, bonus: 0 }); return; }
      // kettle and steam
      const kx = g.W * 0.28, ky = g.H * 0.62;
      ctx.font = `${g.H * 0.22}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🫖', kx, ky);
      const puffs = Math.max(0, (temp - 40) / 15);
      for (let i = 0; i < puffs; i++) {
        const k = ((t / 900 + i / puffs) % 1);
        ctx.fillStyle = `rgba(230,230,240,${0.35 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(kx + 30 + k * 60, ky - 40 - k * 80, 10 + k * 16, 0, 7); ctx.fill();
      }
      const pw = g.W * 0.26, ph = pw * 1.45;
      ctx.save();
      ctx.translate(g.W * 0.68, g.H * 0.3);
      ctx.rotate(wrinkle > 10 ? Math.sin(t / 60) * 0.03 : 0);
      drawPack(ctx, -pw / 2, -ph / 2, pw, ph, pack);
      ctx.restore();
      // thermometer
      const bx = 18, bw = g.W - 36, by = g.H * 0.86;
      ctx.fillStyle = '#2a3140'; rr(ctx, bx, by, bw, 12, 6); ctx.fill();
      ctx.fillStyle = 'rgba(61,255,176,.5)'; ctx.fillRect(bx + bw * (60 / 110), by, bw * (25 / 110), 12);
      ctx.fillStyle = 'rgba(255,61,110,.5)'; ctx.fillRect(bx + bw * (90 / 110), by, bw * (20 / 110), 12);
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * (temp / 110) - 2, by - 6, 4, 24);
      text(ctx, `Glue ${Math.min(100, Math.round(glue))}%`, g.W * 0.25, g.H * 0.08, { size: 14, weight: 800, color: '#3dffb0' });
      text(ctx, `Wrinkles ${Math.round(wrinkle)}`, g.W * 0.75, g.H * 0.08, { size: 14, weight: 800, color: wrinkle > 10 ? '#ff3d6e' : '#c8cede' });
      text(ctx, `${Math.round(temp)}°C · ${Math.ceil(LIMIT - el)}s`, g.W / 2, by - 16, { size: 12, color: '#c8cede' });
    });
  });
}
