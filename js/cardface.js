// Card faces. Each franchise has its own layout (Chokémon, Y-U-No-Pay, Tragic, Cryptid
// case files). Faces are rendered once into an offscreen canvas and cached, so the bench
// can draw them every frame cheaply. Variants (1st Edition, Misprint, Ghost Rare…) and
// grading slabs change how the card looks.
import { SETS, RARITY } from './data.js';
import { cardDef, variantOf } from './state.js';
import { drawArt } from './art.js';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = '"Courier New", Courier, monospace';

const TYPE = {
  normal: { color: '#c8c0a8', icon: '✦' }, fire: { color: '#ff6a3d', icon: '🔥' }, water: { color: '#3d9aff', icon: '💧' },
  grass: { color: '#4ec04a', icon: '🍃' }, electric: { color: '#ffd23d', icon: '⚡' }, psychic: { color: '#c56bff', icon: '👁' },
  fighting: { color: '#c0703a', icon: '✊' }, dark: { color: '#4a4a6a', icon: '☾' }, steel: { color: '#9aa6b8', icon: '⚙' },
  poison: { color: '#a04ad8', icon: '☠' },
};
const MANA = { W: '#f8f1d8', U: '#a8d0f0', B: '#a8a0a8', R: '#f0a890', G: '#a8d8a0' };
const ATTR = { DARK: '#5a3a7a', LIGHT: '#e8c83a', EARTH: '#8a6a3a', FIRE: '#e8503a', WATER: '#3a8ae8', WIND: '#4ac08a' };

// ---- helpers --------------------------------------------------------------------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fill(ctx, color, x, y, w, h, r = 0) { ctx.fillStyle = color; rr(ctx, x, y, w, h, r); ctx.fill(); }
function txt(ctx, s, x, y, size, { color = '#1b1420', weight = 700, align = 'left', font = FONT, maxW = 0, italic = false } = {}) {
  let sz = size;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${sz}px ${font}`;
  if (maxW) while (sz > 4 && ctx.measureText(s).width > maxW) { sz -= 0.5; ctx.font = `${italic ? 'italic ' : ''}${weight} ${sz}px ${font}`; }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
function wrap(ctx, s, x, y, maxW, size, lineH, maxLines, opts = {}) {
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight || 500} ${size}px ${opts.font || FONT}`;
  const words = String(s).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  lines.slice(0, maxLines).forEach((l, i) => txt(ctx, l, x, y + i * lineH, size, { ...opts, weight: opts.weight || 500 }));
  return Math.min(lines.length, maxLines) * lineH;
}
function holoSheen(ctx, x, y, w, h, strength) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  ['#ff3d9a', '#ffd23d', '#3dffb0', '#3d9aff', '#c56bff'].forEach((c, i) => g.addColorStop(i / 4, c));
  ctx.globalAlpha = strength;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
// The illustration, with optional variant effects.
function art(ctx, card, def, x, y, w, h, variant) {
  const spec = card.spec || def?.a;
  const key = `${card.set}:${def?.name || card.name}`;
  if (variant === 'Blurry Photo') {
    // render small and scale up for a convincingly bad photo
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(8, Math.round(w / 5)); tmp.height = Math.max(8, Math.round(h / 5));
    drawArt(tmp.getContext('2d'), 0, 0, tmp.width, tmp.height, spec, key);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, x, y, w, h); ctx.restore();
  } else drawArt(ctx, x, y, w, h, spec, key);
  if (variant === 'Ghost Rare') {
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#888'; ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.25; ctx.fillStyle = '#cfe8ff'; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  if (variant === 'Misprint') { ctx.save(); ctx.globalAlpha = 0.25; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#ff3dff'; ctx.fillRect(x + w * 0.04, y, w, h * 0.96); ctx.restore(); }
  const strength = { holo: 0.25, ultra: 0.4, secret: 0.55 }[card.rarity] || 0;
  if (strength && variant !== 'Reverse Holo') holoSheen(ctx, x, y, w, h, variant === 'Foil' ? strength + 0.25 : strength);
}
const raritySymbol = r => ({ holo: '●', ultra: '◆', secret: '★' }[r] || '●');
const displayName = (card, def) => card.printName || def?.name || card.base || String(card.name).replace(/ \(.*?\)| \[.*?\]/g, '');
const numberOf = (card, def) => { const cards = SETS[card.set]?.cards || []; const i = cards.indexOf(def); return `${i >= 0 ? i + 1 : '?'}/${cards.length}`; };

// ---- Chokémon (and Neon Gutter) ------------------------------------------------------------
function chokeFace(ctx, W, H, card, def, set, variant) {
  const u = W / 100;
  const t = TYPE[def?.type] || TYPE.normal;
  const neon = set.id === 'gutter';
  fill(ctx, neon ? '#2a2440' : set.frame, 0, 0, W, H, 5 * u);
  if (neon) { ctx.save(); ctx.shadowColor = '#ff3d9a'; ctx.shadowBlur = 6 * u; ctx.strokeStyle = '#ff3d9a'; ctx.lineWidth = 1.2 * u; rr(ctx, 2.5 * u, 2.5 * u, W - 5 * u, H - 5 * u, 4 * u); ctx.stroke(); ctx.restore(); }
  const ig = ctx.createLinearGradient(0, 0, 0, H);
  ig.addColorStop(0, '#fffdf5'); ig.addColorStop(1, t.color + '55');
  fill(ctx, ig, 4 * u, 4 * u, W - 8 * u, H - 8 * u, 3 * u);
  if (variant === 'Reverse Holo') holoSheen(ctx, 4 * u, 4 * u, W - 8 * u, H - 8 * u, 0.45);
  // header
  const name = displayName(card, def);
  if (variant === 'Misprint') txt(ctx, name, 8.6 * u, 10.6 * u, 7 * u, { color: '#3dd2ff', maxW: 58 * u });
  txt(ctx, name, 8 * u, 10 * u, 7 * u, { maxW: 58 * u });
  txt(ctx, `${def?.hp ?? 30} HP`, 82 * u, 10 * u, 5 * u, { color: '#d0021b', align: 'right', weight: 800 });
  ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(89 * u, 10 * u, 4 * u, 0, 7); ctx.fill();
  txt(ctx, t.icon, 89 * u, 10.3 * u, 4.5 * u, { align: 'center', font: 'serif' });
  // art
  const ax = 8 * u, ay = 16 * u, aw = 84 * u, ah = 56 * u;
  if (variant !== 'Shadowless') { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 1.5 * u; ctx.shadowOffsetY = 1.5 * u; fill(ctx, '#000', ax, ay, aw, ah); ctx.restore(); }
  fill(ctx, neon ? '#ff3d9a' : '#d8b04a', ax - 1.2 * u, ay - 1.2 * u, aw + 2.4 * u, ah + 2.4 * u, 1 * u);
  art(ctx, card, def, ax, ay, aw, ah, variant);
  const ink = neon ? '#e8e0ff' : '#5a4a2a';
  txt(ctx, `${RARITY[card.rarity]?.label || 'Common'} · ${set.name}`, 50 * u, 76 * u, 3.3 * u, { align: 'center', italic: true, color: ink, weight: 600, maxW: 86 * u });
  if (variant === '1st Edition') {
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(13 * u, 75.5 * u, 3.6 * u, 0, 7); ctx.fill();
    txt(ctx, '1', 13 * u, 75.8 * u, 4.4 * u, { align: 'center', color: '#fff', weight: 900 });
  }
  // move
  const [mv, dmg] = def?.move || ['Tackle', 10];
  const orbs = Math.max(1, Math.min(4, Math.round(dmg / 30)));
  for (let i = 0; i < orbs; i++) { ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc((10 + i * 6) * u, 86 * u, 2.6 * u, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 0.5 * u; ctx.stroke(); }
  txt(ctx, mv, (12 + orbs * 6) * u, 86 * u, 5.4 * u, { maxW: (64 - orbs * 6) * u, color: neon ? '#fff' : '#1b1420' });

  txt(ctx, String(dmg), 90 * u, 86 * u, 6.5 * u, { align: 'right', weight: 900, color: neon ? '#fff' : '#1b1420' });
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(8 * u, 93 * u, 84 * u, 0.4 * u);
  // flavor
  fill(ctx, 'rgba(255,255,255,.55)', 8 * u, 96 * u, 84 * u, 28 * u, 1.5 * u);
  wrap(ctx, def?.flavor || '', 11 * u, 101 * u, 78 * u, 3.6 * u, 5 * u, 4, { italic: true, color: '#3a3020', font: SERIF, weight: 500 });
  // footer
  txt(ctx, 'Illus. Mint & Malice Studio', 8 * u, 131 * u, 2.6 * u, { color: ink, weight: 600 });
  txt(ctx, `${raritySymbol(card.rarity)} ${set.code} ${numberOf(card, def)}`, 92 * u, 131 * u, 3.2 * u, { align: 'right', weight: 800, color: neon ? '#fff' : '#3a3020' });
  if (variant === 'Error Stamp') { ctx.save(); ctx.translate(76 * u, 112 * u); ctx.rotate(Math.PI); txt(ctx, `${set.code} ${set.code}`, 0, 0, 5 * u, { align: 'center', color: 'rgba(208,2,27,.75)', weight: 900 }); ctx.restore(); }
}

const race = n => (/Dragon|Lizard/.test(n) ? 'Dragon' : /Wizard|Magician/.test(n) ? 'Spellcaster' : /Guardian/.test(n) ? 'Warrior' : 'Fiend');

// ---- Y-U-No-Pay -----------------------------------------------------------------------------
function yunoFace(ctx, W, H, card, def, set, variant) {
  const u = W / 100;
  const kind = def?.kind || 'monster';
  const frame = kind === 'spell' ? '#1d9a7a' : kind === 'trap' ? '#b0407a' : '#c27a3a';
  fill(ctx, '#2a1a10', 0, 0, W, H, 3 * u);
  const fg = ctx.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, frame); fg.addColorStop(1, '#00000044');
  fill(ctx, frame, 2.5 * u, 2.5 * u, W - 5 * u, H - 5 * u, 2 * u);
  fill(ctx, fg, 2.5 * u, 2.5 * u, W - 5 * u, H - 5 * u, 2 * u);
  // name plate
  fill(ctx, 'rgba(255,255,255,.18)', 6 * u, 5 * u, 88 * u, 10 * u, 1 * u);
  const name = displayName(card, def);
  txt(ctx, name, 8 * u, 10.2 * u, 6.2 * u, { color: variant === 'Ghost Rare' ? '#e8f4ff' : card.rarity === 'secret' ? '#ffe9a0' : '#111', maxW: 74 * u, font: SERIF, weight: 800 });
  const attr = kind === 'monster' ? (def?.attr || 'DARK') : kind === 'spell' ? 'SPELL' : 'TRAP';
  ctx.fillStyle = ATTR[attr] || frame; ctx.beginPath(); ctx.arc(89 * u, 10 * u, 4 * u, 0, 7); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.6 * u; ctx.stroke();
  txt(ctx, attr[0], 89 * u, 10.3 * u, 4 * u, { align: 'center', color: '#fff', weight: 900, font: SERIF });
  // level / card type
  if (kind === 'monster') for (let i = 0; i < (def?.level || 1); i++) { const x = 88 * u - i * 7 * u; ctx.fillStyle = '#e8503a'; ctx.beginPath(); ctx.arc(x, 19.5 * u, 2.8 * u, 0, 7); ctx.fill(); txt(ctx, '★', x, 19.7 * u, 3.6 * u, { align: 'center', color: '#ffd23d', weight: 900 }); }
  else txt(ctx, `[${kind === 'spell' ? 'SPELL' : 'TRAP'} CARD]`, 92 * u, 19.5 * u, 4 * u, { align: 'right', color: '#fff', weight: 800, font: SERIF });
  // art
  const ax = 12 * u, ay = 24 * u, as = 76 * u;
  fill(ctx, '#1b1420', ax - 1.4 * u, ay - 1.4 * u, as + 2.8 * u, as + 2.8 * u);
  art(ctx, card, def, ax, ay, as, as, variant);
  if (variant === '1st Edition') txt(ctx, '1st Edition', 8 * u, 104 * u, 3.4 * u, { weight: 800, color: '#111' });
  txt(ctx, `${set.code}-EN${String((SETS[card.set].cards.indexOf(def) + 1) || 0).padStart(3, '0')}`, 92 * u, 104 * u, 3 * u, { align: 'right', weight: 700, color: '#111' });
  // text box
  fill(ctx, '#f0e4c4', 6 * u, 107 * u, 88 * u, 28 * u, 1 * u);
  let ty = 111 * u;
  if (kind === 'monster') { txt(ctx, `[ ${race(name)} / Effect ]`, 8 * u, ty, 3.4 * u, { weight: 800 }); ty += 4.5 * u; }
  wrap(ctx, def?.text || '', 8 * u, ty, 84 * u, 3.3 * u, 4.2 * u, kind === 'monster' ? 3 : 5, { font: SERIF, weight: 500 });
  if (kind === 'monster') {
    ctx.fillStyle = '#1b1420'; ctx.fillRect(8 * u, 129.5 * u, 84 * u, 0.3 * u);
    txt(ctx, `ATK/${def?.atk ?? 0}  DEF/${def?.def ?? 0}`, 92 * u, 132.5 * u, 3.8 * u, { align: 'right', weight: 900, font: SERIF });
  }
}

// ---- Tragic: The Hoarding --------------------------------------------------------------------
function manaColor(cost) {
  const cols = [...new Set((cost || '').replace(/[0-9]/g, '').split('').filter(Boolean))];
  if (!cols.length) return '#c8c8d0';
  if (cols.length > 1) return '#e8c86a';
  return MANA[cols[0]];
}
function tragicFace(ctx, W, H, card, def, set, variant) {
  const u = W / 100;
  const alpha = variant === 'Alpha';
  fill(ctx, '#111', 0, 0, W, H, (alpha ? 9 : 4.5) * u);
  const c = manaColor(def?.cost);
  fill(ctx, c, 5 * u, 5 * u, 90 * u, 128 * u, 2 * u);
  ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; for (let i = 0; i < 40; i++) ctx.fillRect((5 + (i * 37) % 90) * u, (5 + (i * 53) % 128) * u, 0.6 * u, 0.6 * u); ctx.restore();
  // name bar + mana pips
  fill(ctx, 'rgba(255,255,255,.75)', 8 * u, 7.5 * u, 84 * u, 9 * u, 4 * u);
  const name = displayName(card, def);
  const pips = (def?.cost || '').match(/\d+|[WUBRG]/g) || [];
  txt(ctx, name, 11 * u, 12 * u, 5.2 * u, { maxW: (80 - pips.length * 6) * u, font: SERIF, weight: 800 });
  pips.reverse().forEach((p, i) => {
    const x = (87 - i * 6) * u;
    ctx.fillStyle = MANA[p] || '#c8c8d0'; ctx.beginPath(); ctx.arc(x, 12 * u, 2.6 * u, 0, 7); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 0.4 * u; ctx.stroke();
    txt(ctx, p, x, 12.2 * u, 3.2 * u, { align: 'center', weight: 900, color: '#111' });
  });
  if (variant === 'Misprint') { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#1b1420'; ctx.beginPath(); ctx.ellipse(84 * u, 13 * u, 6 * u, 2 * u, 0.3, 0, 7); ctx.fill(); ctx.restore(); }
  // art
  const ax = 10 * u, ay = 19 * u, aw = 80 * u, ah = 58 * u;
  fill(ctx, '#111', ax - 0.8 * u, ay - 0.8 * u, aw + 1.6 * u, ah + 1.6 * u);
  art(ctx, card, def, ax, ay, aw, ah, variant);
  // type line
  fill(ctx, 'rgba(255,255,255,.75)', 8 * u, 79 * u, 84 * u, 8 * u, 3 * u);
  txt(ctx, def?.typeLine || 'Artifact', 11 * u, 83.2 * u, 4 * u, { font: SERIF, weight: 700, maxW: 70 * u });
  txt(ctx, '♛', 88 * u, 83.2 * u, 4.6 * u, { align: 'center', color: { holo: '#111', ultra: '#c9a33a', secret: '#e8603a' }[card.rarity] || '#111', font: 'serif' });
  // rules + flavor
  fill(ctx, '#f5ecd8', 9 * u, 89 * u, 82 * u, 36 * u, 1 * u);
  const used = wrap(ctx, def?.text || '', 12 * u, 93 * u, 76 * u, 3.6 * u, 4.6 * u, 4, { font: SERIF, weight: 500 });
  if (def?.flavor) wrap(ctx, def.flavor, 12 * u, 95 * u + used, 76 * u, 3.2 * u, 4.2 * u, 2, { font: SERIF, italic: true, weight: 500, color: '#3a3020' });
  if (def?.pt) { fill(ctx, 'rgba(255,255,255,.85)', 76 * u, 125 * u, 16 * u, 8 * u, 2 * u); txt(ctx, def.pt, 84 * u, 129.2 * u, 4.6 * u, { align: 'center', weight: 900, font: SERIF }); }
  txt(ctx, `Illus. M&M · ©${set.year} Parody Wizards`, 8 * u, 136.5 * u, 2.5 * u, { color: '#bbb', weight: 600 });
}

// ---- Cryptid Clash: case files ----------------------------------------------------------------
function cryptidFace(ctx, W, H, card, def, set, variant) {
  const u = W / 100;
  fill(ctx, '#d9c18e', 0, 0, W, H, 3 * u);
  fill(ctx, '#e8d5a8', 0, 6 * u, W, H - 6 * u, 3 * u);
  fill(ctx, '#d9c18e', 6 * u, 0, 36 * u, 10 * u, 2 * u);
  const idx = SETS[card.set].cards.indexOf(def) + 1;
  txt(ctx, `CASE #${set.code}-${String(idx || 0).padStart(2, '0')}`, 9 * u, 5 * u, 3.4 * u, { font: MONO, weight: 700 });
  // polaroid
  ctx.save();
  ctx.translate(50 * u, 40 * u);
  ctx.rotate(-0.04);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 2 * u; ctx.shadowOffsetY = 1 * u;
  fill(ctx, '#fff', -38 * u, -28 * u, 76 * u, 64 * u, 0.5 * u);
  ctx.shadowColor = 'transparent';
  art(ctx, card, def, -34 * u, -24 * u, 68 * u, 50 * u, variant);
  txt(ctx, variant === 'Blurry Photo' ? 'is that it??' : 'photo: anonymous', 0, 31 * u, 3.4 * u, { align: 'center', font: SERIF, italic: true, color: '#555' });
  ctx.restore();
  // paperclip
  ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1.2 * u; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(70 * u, 6 * u, 7 * u, 18 * u, 3 * u) : ctx.rect(70 * u, 6 * u, 7 * u, 18 * u); ctx.stroke();
  // details
  const name = displayName(card, def);
  txt(ctx, name.toUpperCase(), 8 * u, 84 * u, 5.4 * u, { font: MONO, weight: 800, maxW: 84 * u });
  txt(ctx, 'THREAT:', 8 * u, 91 * u, 3.4 * u, { font: MONO, weight: 700 });
  for (let i = 0; i < 5; i++) txt(ctx, '☠', (27 + i * 5) * u, 91 * u, 4 * u, { color: i < (def?.threat || 1) ? '#b01020' : 'rgba(0,0,0,.2)', font: 'serif' });
  txt(ctx, `HABITAT: ${def?.habitat || 'Unknown'}`, 8 * u, 97 * u, 3.2 * u, { font: MONO, weight: 600, maxW: 84 * u });
  ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 6; i++) ctx.fillRect(8 * u, (104 + i * 5) * u, 84 * u, 0.25 * u);
  if (variant === 'Classified') {
    ctx.fillStyle = '#111';
    for (let i = 0; i < 4; i++) ctx.fillRect(8 * u, (101.5 + i * 5) * u, (50 + (i * 17) % 34) * u, 3.4 * u);
  } else wrap(ctx, `NOTES: ${def?.text || ''}`, 8 * u, 103 * u, 84 * u, 3.3 * u, 5 * u, 5, { font: MONO, weight: 600 });
  ctx.save(); ctx.translate(72 * u, 126 * u); ctx.rotate(-0.18);
  const stamp = variant === 'Classified' ? 'CLASSIFIED' : { holo: 'UNVERIFIED', ultra: 'SIGHTED', secret: 'CONFIRMED' }[card.rarity] || 'UNVERIFIED';
  ctx.strokeStyle = 'rgba(176,16,32,.8)'; ctx.lineWidth = 0.8 * u; ctx.strokeRect(-17 * u, -4 * u, 34 * u, 8 * u);
  txt(ctx, stamp, 0, 0.2 * u, 4 * u, { align: 'center', color: 'rgba(176,16,32,.85)', weight: 900, font: MONO, maxW: 32 * u });
  ctx.restore();
  txt(ctx, `${raritySymbol(card.rarity)} ${set.code} ${numberOf(card, def)}`, 8 * u, 134 * u, 3 * u, { font: MONO, weight: 700 });
}

// ---- card back, slab ----------------------------------------------------------------------------
function backFace(ctx, W, H, set) {
  const u = W / 100;
  fill(ctx, '#1b1420', 0, 0, W, H, 5 * u);
  const g = ctx.createRadialGradient(W / 2, H / 2, 4 * u, W / 2, H / 2, 70 * u);
  g.addColorStop(0, set.color); g.addColorStop(1, set.color2);
  fill(ctx, g, 4 * u, 4 * u, W - 8 * u, H - 8 * u, 3 * u);
  txt(ctx, '?', W / 2, H / 2, 40 * u, { align: 'center', color: 'rgba(255,255,255,.75)', weight: 900 });
}

function faceFor(ctx, W, H, card, o) {
  const set = SETS[card.set] || SETS.choke;
  if (o.unknown) return backFace(ctx, W, H, set);
  const def = cardDef(card);
  const variant = variantOf(card);
  const style = set.style || 'choke';
  if (style === 'yuno') yunoFace(ctx, W, H, card, def, set, variant);
  else if (style === 'tragic') tragicFace(ctx, W, H, card, def, set, variant);
  else if (style === 'cryptid') cryptidFace(ctx, W, H, card, def, set, variant);
  else chokeFace(ctx, W, H, card, def, set, variant);
  if (o.frame) { ctx.save(); ctx.strokeStyle = o.frame; ctx.lineWidth = W * 0.05; rr(ctx, 0, 0, W, H, W * 0.05); ctx.stroke(); ctx.restore(); }
}

// Grading slabs: a clear case with a label.
function slab(ctx, W, H, card, o) {
  const lh = H * 0.12, pad = W * 0.06;
  fill(ctx, 'rgba(200,215,235,.35)', 0, 0, W, H, W * 0.04);
  fill(ctx, '#f8f8f8', pad * 0.6, pad * 0.6, W - pad * 1.2, lh, W * 0.02);
  const alt = card.gsa === 'A';
  txt(ctx, 'GSA', pad, pad * 0.6 + lh * 0.32, lh * 0.26, { color: '#b01020', weight: 900 });
  txt(ctx, displayName(card, cardDef(card)), pad, pad * 0.6 + lh * 0.7, lh * 0.22, { maxW: W * 0.6, weight: 700 });
  txt(ctx, alt ? 'ALTERED' : String(card.gsa), W - pad, pad * 0.6 + lh * 0.5, alt ? lh * 0.28 : lh * 0.6, { align: 'right', weight: 900, color: alt ? '#b01020' : '#111' });
  const iw = W - pad * 2, ih = H - lh - pad * 2.2;
  const cw = Math.min(iw, ih / 1.4), ch = cw * 1.4;
  ctx.save();
  ctx.translate((W - cw) / 2, lh + pad * 1.2 + (ih - ch) / 2);
  faceFor(ctx, cw, ch, card, o);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = W * 0.01; rr(ctx, W * 0.01, W * 0.01, W * 0.98, H - W * 0.02, W * 0.04); ctx.stroke();
}

// ---- cache ------------------------------------------------------------------------------------------
const cache = new Map();
const DPR = () => Math.min(3, Math.max(2, window.devicePixelRatio || 1));

export function cardBitmap(card, w, h, o = {}) {
  const key = [card.set, card.base || card.name, card.name, card.printName, card.variant, card.gsa, card.rarity, Math.round(w), Math.round(h), o.unknown ? 1 : 0, o.frame || '', o.noSlab ? 1 : 0, card.spec ? JSON.stringify(card.spec) : ''].join('|');
  let c = cache.get(key);
  if (c) { cache.delete(key); cache.set(key, c); return c; }
  const dpr = DPR();
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  if (card.gsa && !o.noSlab && !o.unknown) slab(ctx, w, h, card, o); else faceFor(ctx, w, h, card, o);
  cache.set(key, c);
  if (cache.size > 160) cache.delete(cache.keys().next().value);
  return c;
}

// A data URL for DOM thumbnails (binder, index, ScamBay).
const urls = new Map();
export function cardImage(card, w = 60, o = {}) {
  const key = [card.set, card.base || card.name, card.name, card.variant, card.gsa, card.rarity, w, o.unknown ? 1 : 0].join('|');
  if (!urls.has(key)) urls.set(key, cardBitmap(card, w, w * 1.4, o).toDataURL('image/png'));
  return urls.get(key);
}
