// Canvas drawing primitives shared by the bench stations.
import { SETS } from './data.js';

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function text(ctx, str, x, y, { size = 14, color = '#e8ecf3', align = 'center', weight = 600, base = 'middle' } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(str, x, y);
}

function fitText(ctx, str, x, y, maxW, size, weight = 700) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > 6 && ctx.measureText(str).width > maxW) { s -= 0.5; ctx.font = `${weight} ${s}px ${FONT}`; }
  ctx.fillText(str, x, y);
}

export function bench(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1f18');
  g.addColorStop(1, '#17110d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let y = 18; y < H; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.3, y + 6, W * 0.6, y - 6, W, y + 3);
    ctx.stroke();
  }
}

function zigzag(ctx, x, y, w, h) {
  const n = Math.max(6, Math.round(w / 7));
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= n; i++) ctx.lineTo(x + (i / n) * w, y + (i % 2 ? h : 0));
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
}

// Booster pack, top-left anchored.
export function drawPack(ctx, x, y, w, h, pack, o = {}) {
  const set = SETS[pack.set];
  const top = o.openTop ? h * 0.12 : 0;
  ctx.save();
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 22; }
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, set.color);
  g.addColorStop(0.55, set.color2);
  g.addColorStop(1, set.color);
  ctx.fillStyle = g;
  rr(ctx, x, y + top, w, h - top, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  // foil shine
  const s = ctx.createLinearGradient(x, y, x + w, y + h * 0.6);
  s.addColorStop(0.3, 'rgba(255,255,255,0)');
  s.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  s.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  rr(ctx, x, y + top, w, h - top, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  if (!o.openTop) zigzag(ctx, x, y + 2, w, h * 0.05);
  zigzag(ctx, x, y + h - h * 0.07, w, h * 0.05);
  ctx.font = `${w * 0.42}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(set.mascot, x + w / 2, y + h * 0.45);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x + 3, y + h * 0.66, w - 6, h * 0.13);
  text(ctx, set.short, x + w / 2, y + h * 0.725, { size: Math.max(7, w * 0.16), weight: 800, color: '#fff' });
  if (pack.resealed) {
    ctx.strokeStyle = 'rgba(255,140,40,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h * 0.075);
    ctx.lineTo(x + w - 2, y + h * 0.075);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// Trading card, centre anchored.
export function drawCard(ctx, cx, cy, w, h, card, o = {}) {
  const set = SETS[card.set] || SETS.choke;
  const x = cx - w / 2, y = cy - h / 2, r = w * 0.05;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 26; }
  ctx.fillStyle = o.blank ? '#f4efe1' : set.frame;
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (o.blank) { ctx.restore(); return; }
  const m = w * 0.06;
  ctx.fillStyle = '#fbf6e9';
  rr(ctx, x + m, y + m, w - 2 * m, h - 2 * m, r * 0.6);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fitText(ctx, card.name, x + m * 1.6, y + m + h * 0.05, w - 3.2 * m, Math.max(8, w * 0.07));
  const ax = x + m * 1.5, ay = y + m + h * 0.1, aw = w - 3 * m, ah = h * 0.42;
  const g = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
  g.addColorStop(0, set.color);
  g.addColorStop(1, set.color2);
  ctx.fillStyle = g;
  ctx.fillRect(ax, ay, aw, ah);
  if (o.holo !== false) {
    const hg = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
    ['rgba(255,0,128,.25)', 'rgba(255,255,0,.2)', 'rgba(0,255,200,.25)', 'rgba(80,80,255,.25)'].forEach((c, i) => hg.addColorStop(i / 3, c));
    ctx.fillStyle = hg;
    ctx.fillRect(ax, ay, aw, ah);
  }
  ctx.font = `${ah * 0.55}px serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(card.art || set.mascot, ax + aw / 2, ay + ah / 2 + ah * 0.04);
  const ty = ay + ah + h * 0.03;
  ctx.fillStyle = '#e9dfc4';
  ctx.fillRect(ax, ty, aw, h * 0.25);
  const fs = Math.max(6, w * 0.05);
  text(ctx, set.name, ax + aw / 2, ty + h * 0.06, { size: fs, color: '#5a4a2a', weight: 700 });
  text(ctx, card.secret ? '★ SECRET RARE ★' : '1st Edition · Holo Rare', ax + aw / 2, ty + h * 0.13, { size: fs, color: '#5a4a2a', weight: 500 });
  text(ctx, `©${set.year} Parody Wizards of the Toast`, ax + aw / 2, ty + h * 0.2, { size: fs * 0.8, color: '#8a7a5a', weight: 400 });
  if (o.tint) {
    ctx.globalAlpha = (o.alpha ?? 1) * 0.35;
    ctx.fillStyle = o.tint;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
  }
  ctx.restore();
}
