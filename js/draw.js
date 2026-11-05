// Canvas drawing primitives shared by the bench stations.
import { SETS } from './data.js';
import { cardBitmap } from './cardface.js';
import { variantOf } from './state.js';
import { artBitmap } from './art.js';

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
  // window showing the set's flagship card art
  const flag = set.cards.find(c => c.name === set.flagship) || set.cards[0];
  const ww = w * 0.74, wh = h * 0.42;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  rr(ctx, x + (w - ww) / 2 - 1.5, y + h * 0.17 - 1.5, ww + 3, wh + 3, 4);
  ctx.fill();
  ctx.drawImage(artBitmap(flag.a, `${set.id}:${flag.name}`, ww, wh), x + (w - ww) / 2, y + h * 0.17, ww, wh);
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

// Trading card, centre anchored. Faces come from the cached renderer in cardface.js.
export function drawCard(ctx, cx, cy, w, h, card, o = {}) {
  const x = cx - w / 2, y = cy - h / 2, r = w * 0.05;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.blank) {
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 26; }
    ctx.fillStyle = '#f4efe1';
    rr(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#000';
    rr(ctx, x + 1, y + 1, w - 2, h - 2, r);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.drawImage(cardBitmap(card, w, h, { frame: o.frame, noSlab: o.noSlab }), x, y, w, h);
  // secret rares and foils get a live moving sheen
  const v = variantOf(card);
  if (o.live !== false && (card.rarity === 'secret' || v === 'Foil' || v === 'Reverse Holo')) {
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const t = (performance.now() / 2500) % 1;
    const sx = x - w + t * w * 3;
    const g = ctx.createLinearGradient(sx, y, sx + w * 0.6, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,240,200,.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  if (o.tint) {
    ctx.globalAlpha = (o.alpha ?? 1) * 0.35;
    ctx.fillStyle = o.tint;
    rr(ctx, x, y, w, h, r);
    ctx.fill();
  }
  ctx.restore();
}
