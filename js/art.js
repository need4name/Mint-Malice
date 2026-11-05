// Procedural card artwork. Each card's spec names a body (creature or object), a palette,
// extras and a backdrop; this draws an original cartoon illustration from that spec.
// Art is drawn in a 100×100 unit box with thick outlines for a printed-card look.

const INK = '#1b1420';

// Small deterministic RNG so each card's backdrop is always the same.
export function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

// ---- Primitives (unit space) ---------------------------------------------------------
function path(ctx, fill, build, stroke = true) {
  ctx.beginPath();
  build();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke(); }
}
const ell = (ctx, x, y, rx, ry, fill, stroke = true, rot = 0) => path(ctx, fill, () => ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2), stroke);
const poly = (ctx, pts, fill, stroke = true) => path(ctx, fill, () => { ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); }, stroke);
const rect = (ctx, x, y, w, h, fill, r = 3) => path(ctx, fill, () => { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); });
function line(ctx, pts, color = INK, w = 2.6) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
function shade(ctx, x, y, r, c1, c2) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, c2); g.addColorStop(1, c1);
  return g;
}
function shine(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2); ctx.fill();
}

function eyes(ctx, x1, x2, y, s, style = 'cute') {
  for (const x of [x1, x2]) {
    if (style === 'sleepy') { line(ctx, [[x - s, y], [x - s / 2, y + s / 2.5], [x + s / 2, y + s / 2.5], [x + s, y]], INK, 2.2); continue; }
    if (style === 'dot') { ell(ctx, x, y, s * 0.35, s * 0.45, INK, false); continue; }
    if (style === 'glow') { ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 8; ell(ctx, x, y, s * 0.8, s * 0.55, '#fff6a0'); ctx.shadowBlur = 0; continue; }
    ell(ctx, x, y, s * 0.75, s, '#fff');
    const px = style === 'angry' ? 0 : s * 0.15;
    ell(ctx, x + px, y + s * 0.15, s * 0.42, s * 0.55, INK, false);
    ell(ctx, x + px + s * 0.15, y - s * 0.1, s * 0.15, s * 0.18, '#fff', false);
    if (style === 'angry') line(ctx, [[x - s, y - s * 1.2], [x + s * 0.8, y - s * 0.6]], INK, 3);
  }
  if (style === 'angry') { /* brows drawn per eye above; mirror the second */ }
}
const smile = (ctx, x, y, w) => line(ctx, [[x - w, y], [x, y + w * 0.6], [x + w, y]], INK, 2.2);
const fangs = (ctx, x, y, w) => { poly(ctx, [[x - w, y], [x - w + 3, y + 5], [x - w + 6, y]], '#fff'); poly(ctx, [[x + w - 6, y], [x + w - 3, y + 5], [x + w, y]], '#fff'); };

// ---- Extras -------------------------------------------------------------------------
const X = {
  horns(ctx, P, x, y, s = 1) { poly(ctx, [[x - 12 * s, y], [x - 16 * s, y - 16 * s], [x - 6 * s, y - 4 * s]], P.c3 || '#f3e7c9'); poly(ctx, [[x + 12 * s, y], [x + 16 * s, y - 16 * s], [x + 6 * s, y - 4 * s]], P.c3 || '#f3e7c9'); },
  crown(ctx, x, y, s = 1) { poly(ctx, [[x - 12 * s, y], [x - 12 * s, y - 10 * s], [x - 6 * s, y - 4 * s], [x, y - 12 * s], [x + 6 * s, y - 4 * s], [x + 12 * s, y - 10 * s], [x + 12 * s, y]], '#ffd23d'); ell(ctx, x, y - 5 * s, 2 * s, 2 * s, '#ff3d6e', false); },
  halo(ctx, x, y) { ctx.save(); ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.ellipse(x, y, 14, 4, 0, 0, Math.PI * 2); ctx.strokeStyle = '#ffe36b'; ctx.lineWidth = 3.5; ctx.stroke(); ctx.restore(); },
  wings(ctx, P, x, y, s = 1, feather = false) {
    for (const d of [-1, 1]) {
      const pts = feather
        ? [[x, y], [x + d * 40 * s, y - 28 * s], [x + d * 44 * s, y - 6 * s], [x + d * 34 * s, y + 4 * s], [x + d * 38 * s, y + 14 * s], [x + d * 14 * s, y + 10 * s]]
        : [[x, y], [x + d * 42 * s, y - 30 * s], [x + d * 36 * s, y - 8 * s], [x + d * 44 * s, y + 2 * s], [x + d * 30 * s, y + 4 * s], [x + d * 32 * s, y + 16 * s], [x + d * 10 * s, y + 10 * s]];
      poly(ctx, pts, feather ? '#fffaf0' : (P.c3 || P.c2));
    }
  },
  flame(ctx, x, y, s = 1) {
    ctx.save(); ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 10;
    poly(ctx, [[x, y + 6 * s], [x - 8 * s, y - 4 * s], [x - 3 * s, y - 6 * s], [x - 4 * s, y - 16 * s], [x + 3 * s, y - 8 * s], [x + 6 * s, y - 18 * s], [x + 9 * s, y - 2 * s]], '#ff7a1a');
    poly(ctx, [[x, y + 3 * s], [x - 3 * s, y - 3 * s], [x + 1 * s, y - 8 * s], [x + 4 * s, y - 2 * s]], '#ffe36b', false);
    ctx.restore();
  },
  hat(ctx, P, x, y, s = 1) { poly(ctx, [[x - 18 * s, y], [x + 18 * s, y], [x + 4 * s, y - 32 * s], [x + 12 * s, y - 36 * s], [x - 2 * s, y - 30 * s]], P.c1); ell(ctx, x, y, 20 * s, 4 * s, P.c1); for (let i = 0; i < 3; i++) ell(ctx, x - 6 * s + i * 5 * s, y - 12 * s - i * 6 * s, 1.6, 1.6, '#ffd23d', false); },
  glasses(ctx, x1, x2, y) { ell(ctx, x1, y, 6, 5, 'rgba(180,220,255,.35)'); ell(ctx, x2, y, 6, 5, 'rgba(180,220,255,.35)'); line(ctx, [[x1 + 6, y], [x2 - 6, y]]); },
  staff(ctx, x, y, orb = '#c792ff') { line(ctx, [[x, y], [x + 6, y - 50]], '#7a4a2a', 4); ctx.save(); ctx.shadowColor = orb; ctx.shadowBlur = 12; ell(ctx, x + 6, y - 54, 6, 6, orb); ctx.restore(); },
  clock(ctx, x, y, r = 10) { ell(ctx, x, y, r, r, '#fff6dc'); line(ctx, [[x, y], [x, y - r * 0.7]]); line(ctx, [[x, y], [x + r * 0.5, y + r * 0.2]]); },
  spikes(ctx, pts, color) { for (const [x, y] of pts) poly(ctx, [[x - 5, y + 2], [x, y - 9], [x + 5, y + 2]], color); },
  chain(ctx, x, y, w) { for (let i = 0; i < 6; i++) ell(ctx, x - w / 2 + i * (w / 5), y + Math.sin(i) * 1.5, 3.2, 2.2, '#ffd23d'); },
  tie(ctx, x, y) { poly(ctx, [[x - 3, y], [x + 3, y], [x + 5, y + 14], [x, y + 18], [x - 5, y + 14]], '#ff3d6e'); },
  smoke(ctx, x, y) { ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 4; i++) ell(ctx, x + i * 6, y - i * 7, 6 + i * 2, 5 + i * 1.5, '#e8e0ff', false); ctx.restore(); },
};
const has = (P, k) => P.x.includes(k);

// ---- Bodies ------------------------------------------------------------------------------
const BODIES = {
  blob(ctx, P) {
    ell(ctx, 50, 66, 34, 27, shade(ctx, 50, 66, 34, P.c1, P.c2));
    shine(ctx, 36, 52, 7, 4);
    eyes(ctx, 40, 60, 62, 5, P.e);
    smile(ctx, 50, 72, 5);
    if (has(P, 'blush')) { ell(ctx, 32, 70, 4, 2.5, '#ff7aa8', false); ell(ctx, 68, 70, 4, 2.5, '#ff7aa8', false); }
  },
  puff(ctx, P) {
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; ell(ctx, 50 + Math.cos(a) * 26, 60 + Math.sin(a) * 24, 9, 9, P.c2); }
    ell(ctx, 50, 60, 27, 25, shade(ctx, 50, 60, 27, P.c1, P.c2), false);
    eyes(ctx, 42, 58, 57, 4.5, P.e);
    ell(ctx, 50, 67, 3, 2, '#ff7a7a', false);
    ell(ctx, 36, 66, 3.5, 2, '#ff9cc4', false); ell(ctx, 64, 66, 3.5, 2, '#ff9cc4', false);
    ell(ctx, 40, 88, 6, 4, P.c1); ell(ctx, 60, 88, 6, 4, P.c1);
  },
  turtle(ctx, P) {
    for (const [x, y] of [[30, 82], [44, 86], [58, 86], [72, 82]]) ell(ctx, x, y, 6, 6, P.c1);
    ell(ctx, 82, 60, 12, 11, shade(ctx, 82, 60, 12, P.c1, P.c2));
    eyes(ctx, 79, 88, 57, 3.5, P.e);
    smile(ctx, 85, 65, 3);
    path(ctx, P.c3 || '#b3772f', () => { ctx.ellipse(48, 70, 32, 26, 0, Math.PI, 0); ctx.lineTo(80, 74); ctx.lineTo(16, 74); ctx.closePath(); });
    ctx.save(); ctx.strokeStyle = 'rgba(27,20,32,.45)'; ctx.lineWidth = 1.6;
    for (const [x, y] of [[38, 58], [56, 58], [47, 48], [30, 66], [64, 66]]) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 6); } ctx.closePath(); ctx.stroke(); }
    ctx.restore();
    rect(ctx, 16, 72, 66, 6, P.c2, 3);
  },
  frog(ctx, P) {
    if (has(P, 'bulb')) { ell(ctx, 50, 40, 16, 14, '#e86a9a'); for (const d of [-1, 1]) ell(ctx, 50 + d * 12, 34, 9, 5, '#7ad15f', true, d * 0.6); poly(ctx, [[50, 20], [44, 30], [56, 30]], '#ff9ac0'); }
    ell(ctx, 50, 68, 34, 22, shade(ctx, 50, 68, 34, P.c1, P.c2));
    ell(ctx, 50, 76, 20, 11, P.c2, false);
    ell(ctx, 34, 48, 10, 10, P.c1); ell(ctx, 66, 48, 10, 10, P.c1);
    eyes(ctx, 34, 66, 48, 5, P.e);
    line(ctx, [[34, 66], [50, 70], [66, 66]], INK, 2.2);
    ell(ctx, 22, 88, 9, 4, P.c1); ell(ctx, 78, 88, 9, 4, P.c1);
    if (has(P, 'spray')) { rect(ctx, 76, 58, 8, 18, '#ff3dff', 2); ell(ctx, 80, 56, 3, 2, '#c8c8c8'); }
  },
  golem(ctx, P) {
    rect(ctx, 26, 62, 14, 30, P.c1, 4); rect(ctx, 60, 62, 14, 30, P.c1, 4);
    rect(ctx, 12, 44, 14, 32, P.c2, 5); rect(ctx, 74, 44, 14, 32, P.c2, 5);
    rect(ctx, 24, 40, 52, 34, shade(ctx, 50, 56, 30, P.c1, P.c2), 6);
    rect(ctx, 34, 18, 32, 26, P.c2, 6);
    eyes(ctx, 43, 57, 30, 4, P.e === 'cute' ? 'angry' : P.e);
    line(ctx, [[30, 50], [38, 56], [34, 64]], 'rgba(27,20,32,.5)', 1.8);
    line(ctx, [[62, 46], [66, 54]], 'rgba(27,20,32,.5)', 1.8);
    if (has(P, 'bolts')) for (const [x, y] of [[30, 46], [70, 46], [30, 68], [70, 68]]) ell(ctx, x, y, 2.2, 2.2, '#ffd23d');
  },
  cat(ctx, P) {
    line(ctx, [[66, 84], [84, 76], [88, 58], [80, 50]], P.c1, 7);
    ell(ctx, 50, 72, 22, 20, shade(ctx, 50, 72, 22, P.c1, P.c2));
    poly(ctx, [[33, 34], [36, 14], [46, 28]], P.c1); poly(ctx, [[67, 34], [64, 14], [54, 28]], P.c1);
    ell(ctx, 50, 40, 21, 18, shade(ctx, 50, 40, 21, P.c1, P.c2));
    eyes(ctx, 42, 58, 40, 4.5, P.e);
    poly(ctx, [[48, 47], [52, 47], [50, 49.5]], '#ff7aa8', false);
    if (has(P, 'gem')) { ctx.save(); ctx.shadowColor = '#ff3d6e'; ctx.shadowBlur = 8; poly(ctx, [[50, 25], [54, 29], [50, 33], [46, 29]], '#ff3d6e'); ctx.restore(); }
    for (const d of [-1, 1]) { line(ctx, [[50 + d * 6, 48], [50 + d * 20, 46]], INK, 1.2); line(ctx, [[50 + d * 6, 50], [50 + d * 20, 51]], INK, 1.2); }
  },
  shroom(ctx, P) {
    rect(ctx, 36, 50, 28, 40, '#fff1dc', 10);
    eyes(ctx, 44, 56, 66, 3.5, P.e);
    smile(ctx, 50, 74, 3);
    path(ctx, shade(ctx, 50, 44, 34, P.c1, P.c2), () => { ctx.ellipse(50, 52, 38, 34, 0, Math.PI, 0); ctx.closePath(); });
    for (const [x, y, r] of [[34, 38, 5], [52, 30, 6], [66, 42, 4], [44, 46, 3]]) ell(ctx, x, y, r, r * 0.8, P.c3 || '#fff', false);
  },
  rodent(ctx, P) {
    if (has(P, 'boltTail')) poly(ctx, [[70, 78], [84, 66], [78, 62], [92, 46], [88, 44], [96, 30], [80, 46], [86, 50], [72, 64]], P.c1);
    else line(ctx, [[68, 80], [86, 74], [92, 62]], '#e8a0a8', 3);
    ell(ctx, 50, 70, 24, 20, shade(ctx, 50, 70, 24, P.c1, P.c2));
    ell(ctx, 33, 28, 10, 11, P.c1); ell(ctx, 67, 28, 10, 11, P.c1);
    ell(ctx, 33, 28, 5, 6, P.c3 || '#ffb0c0', false); ell(ctx, 67, 28, 5, 6, P.c3 || '#ffb0c0', false);
    ell(ctx, 50, 44, 20, 17, shade(ctx, 50, 44, 20, P.c1, P.c2));
    eyes(ctx, 42, 58, 42, 4.5, P.e);
    ell(ctx, 50, 50, 2.5, 2, INK, false);
    if (has(P, 'cheeks')) { ell(ctx, 34, 50, 5, 4, '#ff4d3d', false); ell(ctx, 66, 50, 5, 4, '#ff4d3d', false); }
    if (has(P, 'hat')) { rect(ctx, 34, 20, 32, 6, '#7a8a99', 2); line(ctx, [[42, 20], [42, 26]], 'rgba(27,20,32,.4)', 1.2); line(ctx, [[58, 20], [58, 26]], 'rgba(27,20,32,.4)', 1.2); }
  },
  ghost(ctx, P) {
    const g = shade(ctx, 50, 50, 34, P.c1, P.c2);
    path(ctx, g, () => {
      ctx.moveTo(18, 84); ctx.lineTo(18, 46); ctx.bezierCurveTo(18, 10, 82, 10, 82, 46); ctx.lineTo(82, 84);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(82 - i * 16 - 4, 92, 82 - (i + 1) * 16, 84);
      ctx.closePath();
    });
    eyes(ctx, 40, 60, 46, 5.5, P.e);
    if (has(P, 'legs')) { line(ctx, [[42, 84], [40, 98]], INK, 3); line(ctx, [[58, 84], [60, 98]], INK, 3); }
    path(ctx, INK, () => { ctx.ellipse(50, 62, 8, has(P, 'grin') ? 3 : 5, 0, 0, Math.PI * 2); }, false);
    if (has(P, 'gas')) { ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 5; i++) ell(ctx, 12 + i * 18, 90 - (i % 2) * 6, 9, 6, P.c2, false); ctx.restore(); }
  },
  dragon(ctx, P) {
    if (has(P, 'wings')) X.wings(ctx, P, 50, 48, 1);
    line(ctx, [[60, 80], [80, 84], [92, 72]], P.c1, 8);
    if (has(P, 'tailflame')) X.flame(ctx, 93, 68, 1);
    ell(ctx, 50, 68, 22, 20, shade(ctx, 50, 68, 22, P.c1, P.c2));
    ell(ctx, 50, 73, 12, 13, P.c2, false);
    for (let i = 0; i < 3; i++) line(ctx, [[42, 66 + i * 6], [58, 66 + i * 6]], 'rgba(27,20,32,.25)', 1.4);
    ell(ctx, 36, 88, 7, 5, P.c1); ell(ctx, 64, 88, 7, 5, P.c1);
    ell(ctx, 50, 38, 17, 15, shade(ctx, 50, 38, 17, P.c1, P.c2));
    ell(ctx, 50, 47, 10, 6, P.c2);
    ell(ctx, 46, 46, 1.2, 1.2, INK, false); ell(ctx, 54, 46, 1.2, 1.2, INK, false);
    if (has(P, 'horns')) X.horns(ctx, P, 50, 26, 0.8);
    eyes(ctx, 43, 57, 35, 4, P.e);
    if (has(P, 'spikes')) X.spikes(ctx, [[40, 52], [50, 49], [60, 52]], P.c3 || P.c2);
    if (has(P, 'fire')) { ctx.save(); ctx.shadowColor = '#ffb020'; ctx.shadowBlur = 12; poly(ctx, [[50, 52], [38, 62], [24, 60], [34, 66], [20, 72], [44, 66]], '#ff9a1a'); ctx.restore(); }
  },
  mage(ctx, P) {
    const skin = P.skin || '#f2c9a0';
    if (has(P, 'wings')) X.wings(ctx, P, 50, 50, 1, true);
    poly(ctx, [[50, 34], [22, 94], [78, 94]], shade(ctx, 50, 66, 34, P.c1, P.c2));
    line(ctx, [[50, 44], [50, 92]], 'rgba(27,20,32,.3)', 1.6);
    if (has(P, 'tie')) X.tie(ctx, 50, 48);
    if (has(P, 'ears')) { poly(ctx, [[34, 30], [22, 22], [36, 36]], skin); poly(ctx, [[66, 30], [78, 22], [64, 36]], skin); }
    ell(ctx, 50, 32, 14, 14, skin);
    if (has(P, 'beard')) poly(ctx, [[38, 34], [62, 34], [50, 56]], '#e8e8e8');
    eyes(ctx, 44, 56, 31, 3.2, P.e);
    if (has(P, 'glasses')) X.glasses(ctx, 44, 56, 31);
    if (has(P, 'hat')) X.hat(ctx, P, 50, 22, 0.9);
    if (has(P, 'hood')) path(ctx, P.c1, () => { ctx.ellipse(50, 28, 18, 18, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(66, 40); ctx.lineTo(34, 40); ctx.closePath(); });
    if (has(P, 'halo')) X.halo(ctx, 50, 12);
    if (has(P, 'staff')) X.staff(ctx, 76, 90, P.c3 || '#c792ff');
    if (has(P, 'sword')) { line(ctx, [[24, 86], [20, 40]], '#d8dde6', 4); line(ctx, [[16, 76], [30, 74]], '#a07a3a', 4); }
    if (has(P, 'clock')) X.clock(ctx, 24, 60, 11);
    if (has(P, 'tail')) line(ctx, [[64, 90], [86, 86], [90, 70]], P.c1, 6);
  },
  bird(ctx, P) {
    ell(ctx, 48, 66, 24, 20, shade(ctx, 48, 66, 24, P.c1, P.c2));
    ell(ctx, 44, 70, 12, 9, P.c2, true, -0.3);
    line(ctx, [[42, 86], [40, 94]], '#ff9a3d', 3); line(ctx, [[54, 86], [56, 94]], '#ff9a3d', 3);
    ell(ctx, 62, 40, 15, 14, shade(ctx, 62, 40, 15, P.c1, P.c2));
    poly(ctx, [[74, 40], [88, 44], [74, 48]], '#ffb03d');
    eyes(ctx, 62, 70, 37, 3.4, P.e);
    if (has(P, 'neck')) ell(ctx, 56, 52, 8, 4, '#6affc8', false);
    if (has(P, 'helmet')) { ctx.save(); ctx.globalAlpha = 0.35; ell(ctx, 63, 40, 21, 20, '#bfe8ff'); ctx.restore(); ell(ctx, 63, 40, 21, 20, null); }
    if (has(P, 'crown')) X.crown(ctx, 62, 27, 0.8);
    if (has(P, 'chain')) X.chain(ctx, 54, 56, 22);
  },
  quad(ctx, P) {
    for (const x of [30, 40, 62, 72]) rect(ctx, x - 4, 70, 9, 20, P.c1, 3);
    if (has(P, 'tail')) line(ctx, [[78, 62], [92, 54]], P.c1, 5);
    ell(ctx, 54, 64, 28, 16, shade(ctx, 54, 64, 28, P.c1, P.c2));
    if (has(P, 'spikes')) X.spikes(ctx, [[40, 50], [50, 47], [60, 47], [70, 50]], P.c3 || '#e0e0e0');
    if (has(P, 'longears')) { ell(ctx, 22, 20, 5, 15, P.c1, true, -0.2); ell(ctx, 34, 18, 5, 15, P.c1, true, 0.2); }
    if (has(P, 'antlers')) { line(ctx, [[22, 32], [16, 14], [10, 10]], '#c9a07a', 3); line(ctx, [[16, 20], [22, 12]], '#c9a07a', 3); line(ctx, [[34, 30], [40, 12], [46, 8]], '#c9a07a', 3); line(ctx, [[40, 20], [34, 12]], '#c9a07a', 3); }
    ell(ctx, 28, 44, 16, 15, shade(ctx, 28, 44, 16, P.c1, P.c2));
    ell(ctx, 20, 50, 7, 5, P.c2);
    eyes(ctx, 24, 36, 41, 3.4, P.e);
    if (has(P, 'fangs')) fangs(ctx, 20, 53, 6);
    if (has(P, 'skewer')) { line(ctx, [[60, 30], [92, 22]], '#c9a07a', 2); for (const x of [68, 76, 84]) ell(ctx, x, 27 - (x - 68) * 0.25, 4, 3.5, '#a0522d'); }
  },
  cone(ctx, P) {
    rect(ctx, 22, 82, 56, 8, P.c1, 2);
    poly(ctx, [[50, 12], [30, 84], [70, 84]], shade(ctx, 50, 50, 36, P.c1, P.c2));
    poly(ctx, [[42, 42], [58, 42], [61, 54], [39, 54]], '#fff', false);
    poly(ctx, [[37, 64], [63, 64], [66, 74], [34, 74]], '#fff', false);
    eyes(ctx, 44, 56, 34, 3, P.e);
    ell(ctx, 40, 92, 5, 3, INK, false); ell(ctx, 60, 92, 5, 3, INK, false);
  },
  fish(ctx, P) {
    poly(ctx, [[78, 58], [96, 42], [92, 58], [96, 74]], P.c2);
    poly(ctx, [[46, 46], [58, 32], [64, 48]], P.c2);
    ell(ctx, 50, 60, 32, 18, shade(ctx, 50, 60, 32, P.c1, '#fff'));
    for (const [x, y, r] of [[42, 54, 6], [58, 64, 7], [66, 54, 4]]) ell(ctx, x, y, r, r * 0.8, P.c2, false);
    eyes(ctx, 28, 28, 56, 4, P.e);
    line(ctx, [[20, 64], [16, 74]], P.c2, 2); line(ctx, [[22, 65], [24, 76]], P.c2, 2);
  },
  moth(ctx, P) {
    for (const d of [-1, 1]) {
      ell(ctx, 50 + d * 22, 40, 24, 18, shade(ctx, 50 + d * 22, 40, 24, P.c1, P.c2), true, d * 0.4);
      ell(ctx, 50 + d * 18, 66, 15, 12, P.c1, true, -d * 0.4);
      ell(ctx, 50 + d * 24, 40, 6, 6, P.c3 || '#ff3d3d', false);
    }
    ell(ctx, 50, 56, 9, 26, '#3a2a3a');
    line(ctx, [[46, 30], [36, 14]], INK, 2); line(ctx, [[54, 30], [64, 14]], INK, 2);
    eyes(ctx, 46, 54, 38, 3.2, P.e);
    if (has(P, 'smoke')) X.smoke(ctx, 60, 80);
  },
  serpent(ctx, P) {
    for (const [x, w] of [[30, 12], [54, 10], [74, 8]]) path(ctx, shade(ctx, x, 70, w * 1.4, P.c1, P.c2), () => { ctx.ellipse(x, 76, w, 14, 0, Math.PI, 0); ctx.closePath(); });
    path(ctx, P.c1, () => { ctx.moveTo(12, 78); ctx.quadraticCurveTo(6, 40, 20, 26); ctx.lineTo(28, 30); ctx.quadraticCurveTo(18, 46, 22, 78); ctx.closePath(); });
    ell(ctx, 26, 26, 12, 9, shade(ctx, 26, 26, 12, P.c1, P.c2));
    eyes(ctx, 24, 32, 23, 2.8, P.e);
    if (has(P, 'spikes')) X.spikes(ctx, [[30, 63], [54, 63], [74, 66]], P.c3 || P.c2);
    if (has(P, 'glow')) { ctx.save(); ctx.globalAlpha = 0.35; ell(ctx, 50, 80, 46, 8, P.c1, false); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = 0.7; for (let i = 0; i < 5; i++) line(ctx, [[i * 22, 82], [i * 22 + 10, 80], [i * 22 + 20, 82]], '#e0f4ff', 2); ctx.restore();
  },
  bone(ctx, P) {
    ctx.save(); ctx.shadowColor = '#c792ff'; ctx.shadowBlur = 16;
    for (let i = 0; i < 3; i++) rect(ctx, 40, 64 - i * 20, 20, 22, i === 2 ? P.c1 : P.c2, 8);
    ctx.restore();
    ell(ctx, 50, 24, 7, 6, '#f8e6e6');
    for (let i = 0; i < 2; i++) line(ctx, [[40, 64 - i * 20], [60, 64 - i * 20]], 'rgba(27,20,32,.4)', 1.6);
    rect(ctx, 34, 82, 32, 8, '#6a4a2a', 2);
    line(ctx, [[36, 50], [64, 58]], '#c8b090', 3);
  },
  furball(ctx, P) {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 28 + (i % 2 ? 4 : -1); ctx.lineTo(50 + Math.cos(a) * r, 58 + Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = shade(ctx, 50, 58, 30, P.c1, P.c2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    eyes(ctx, 40, 60, 54, 7, P.e);
    ell(ctx, 20, 68, 5, 4, P.c1); ell(ctx, 80, 68, 5, 4, P.c1);
    ell(ctx, 40, 90, 6, 4, '#ffcc99'); ell(ctx, 60, 90, 6, 4, '#ffcc99');
  },
  ape(ctx, P) {
    line(ctx, [[30, 50], [18, 84]], P.c1, 12); line(ctx, [[70, 50], [82, 84]], P.c1, 12);
    ell(ctx, 50, 62, 26, 30, shade(ctx, 50, 62, 26, P.c1, P.c2));
    rect(ctx, 34, 84, 12, 10, P.c1, 3); rect(ctx, 54, 84, 12, 10, P.c1, 3);
    ell(ctx, 50, 30, 16, 16, P.c1);
    ell(ctx, 50, 34, 11, 10, P.c2);
    eyes(ctx, 45, 55, 31, 2.8, P.e);
    line(ctx, [[46, 39], [54, 39]], INK, 2);
    if (has(P, 'stamp')) { ctx.save(); ctx.translate(70, 74); ctx.rotate(-0.3); rect(ctx, -12, -6, 24, 12, 'rgba(255,61,110,.85)', 2); ctx.fillStyle = '#fff'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('NOTARY', 0, 2); ctx.restore(); }
  },
  squid(ctx, P) {
    for (let i = 0; i < 6; i++) { const x = 22 + i * 11; line(ctx, [[x, 60], [x - 6 + (i % 2) * 12, 78], [x + (i % 2 ? -8 : 8), 96]], P.c1, 6); }
    ell(ctx, 50, 40, 26, 30, shade(ctx, 50, 40, 26, P.c1, P.c2));
    eyes(ctx, 40, 60, 46, 5, P.e);
    if (has(P, 'invoice')) { ctx.save(); ctx.translate(82, 76); ctx.rotate(0.2); rect(ctx, -9, -12, 18, 24, '#fff', 1); for (let k = 0; k < 4; k++) line(ctx, [[-6, -6 + k * 5], [6, -6 + k * 5]], '#888', 1); ctx.fillStyle = '#d0021b'; ctx.font = 'bold 5px sans-serif'; ctx.fillText('DUE', -5, 10); ctx.restore(); }
  },
  alien(ctx, P) {
    line(ctx, [[60, 84], [84, 82], [92, 64], [84, 54]], P.c2, 7);
    line(ctx, [[38, 58], [24, 70], [20, 82]], P.c1, 6); line(ctx, [[62, 58], [76, 66], [80, 54]], P.c1, 6);
    ell(ctx, 50, 68, 15, 22, shade(ctx, 50, 68, 15, P.c1, '#fff'));
    ell(ctx, 50, 74, 9, 12, P.c2, false);
    rect(ctx, 40, 86, 7, 8, P.c1, 3); rect(ctx, 53, 86, 7, 8, P.c1, 3);
    ell(ctx, 50, 34, 19, 17, shade(ctx, 50, 34, 19, P.c1, '#fff'));
    line(ctx, [[46, 18], [50, 12], [54, 18]], P.c1, 4);
    eyes(ctx, 43, 57, 35, 4, P.e);
    if (P.e === 'glow') { ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = P.c2; ctx.lineWidth = 2; for (let r = 30; r < 46; r += 7) { ctx.beginPath(); ctx.arc(50, 50, r, -0.4, Math.PI + 0.4, true); ctx.stroke(); } ctx.restore(); }
  },
  // ---- objects ----
  mirror(ctx, P) {
    rect(ctx, 46, 78, 8, 14, '#c9a33a', 2);
    ell(ctx, 50, 46, 28, 36, '#c9a33a');
    const g = ctx.createLinearGradient(30, 20, 70, 70); g.addColorStop(0, '#e9f8ff'); g.addColorStop(0.5, P.c1); g.addColorStop(1, '#5a7aa0');
    ell(ctx, 50, 46, 22, 30, g);
    line(ctx, [[40, 28], [52, 44], [46, 52], [58, 66]], 'rgba(27,20,32,.6)', 1.6);
    ell(ctx, 50, 46, 9, 10, 'rgba(255,255,255,.25)', false);
  },
  pot(ctx, P) {
    rect(ctx, 34, 20, 32, 8, P.c2, 3);
    path(ctx, shade(ctx, 50, 58, 34, P.c1, P.c2), () => { ctx.moveTo(36, 28); ctx.bezierCurveTo(10, 40, 14, 92, 50, 92); ctx.bezierCurveTo(86, 92, 90, 40, 64, 28); ctx.closePath(); });
    eyes(ctx, 40, 60, 52, 4, 'angry');
    path(ctx, INK, () => { ctx.moveTo(34, 66); ctx.quadraticCurveTo(50, 84, 66, 66); ctx.quadraticCurveTo(50, 72, 34, 66); }, false);
    for (let i = 0; i < 4; i++) poly(ctx, [[38 + i * 6, 68], [41 + i * 6, 73], [44 + i * 6, 69]], '#fff', false);
  },
  scroll(ctx, P) {
    rect(ctx, 24, 24, 52, 56, '#f3e2b8', 2);
    ell(ctx, 24, 52, 5, 30, '#d9c08a'); ell(ctx, 76, 52, 5, 30, '#d9c08a');
    for (let i = 0; i < 6; i++) line(ctx, [[32, 34 + i * 7], [68 - (i % 3) * 6, 34 + i * 7]], 'rgba(27,20,32,.35)', 1.6);
    ctx.save(); ctx.shadowColor = P.c1; ctx.shadowBlur = 10; ell(ctx, 62, 72, 8, 8, P.c1); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center'; ctx.fillText('©', 62, 75);
  },
  bolt(ctx, P) {
    ctx.save(); ctx.shadowColor = P.c2; ctx.shadowBlur = 18;
    poly(ctx, [[58, 6], [26, 54], [46, 54], [34, 94], [76, 38], [54, 38], [70, 6]], P.c1);
    ctx.restore();
    ell(ctx, 72, 78, 12, 12, '#ffd23d');
    ctx.fillStyle = INK; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', 72, 83);
  },
  candle(ctx, P) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = P.c2; ctx.lineWidth = 1.5;
    ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); ctx.lineTo(50 + Math.cos(a) * 34, 76 + Math.sin(a) * 12); } ctx.stroke(); ctx.restore();
    for (const [x, h] of [[30, 30], [50, 40], [70, 26]]) { rect(ctx, x - 6, 86 - h, 12, h, P.c1, 2); X.flame(ctx, x, 82 - h, 0.6); }
    ell(ctx, 50, 90, 12, 4, '#e8e0d0');
  },
  gem(ctx, P) {
    ctx.save(); ctx.shadowColor = P.c1; ctx.shadowBlur = 20;
    poly(ctx, [[30, 36], [70, 36], [84, 50], [50, 90], [16, 50]], P.c1);
    ctx.restore();
    poly(ctx, [[30, 36], [40, 50], [16, 50]], P.c2, false);
    poly(ctx, [[40, 50], [60, 50], [50, 90]], 'rgba(255,255,255,.25)', false);
    line(ctx, [[16, 50], [84, 50]], INK, 1.6); line(ctx, [[40, 50], [30, 36]], INK, 1.4); line(ctx, [[60, 50], [70, 36]], INK, 1.4); line(ctx, [[40, 50], [50, 90]], INK, 1.4); line(ctx, [[60, 50], [50, 90]], INK, 1.4);
    rect(ctx, 36, 22, 28, 10, '#c9a33a', 3);
  },
  stairs(ctx, P) {
    for (let i = 13; i >= 0; i--) {
      const a = i * 0.7, r = 10 + i * 2.6;
      const x = 50 + Math.cos(a) * r, y = 90 - i * 5.5 + Math.sin(a) * r * 0.25;
      rect(ctx, x - 7, y - 3, 14, 6, i % 2 ? P.c1 : P.c2, 1.5);
    }
    ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; ell(ctx, 50, 12, 6, 6, '#fff', false); ctx.restore();
  },
  lotus(ctx, P) {
    ctx.save(); ctx.shadowColor = P.c2; ctx.shadowBlur = 22;
    for (let i = 0; i < 7; i++) { const a = -Math.PI + (i / 6) * Math.PI; ell(ctx, 50 + Math.cos(a) * 18, 62 + Math.sin(a) * 18, 9, 22, P.c1, true, a + Math.PI / 2); }
    ctx.restore();
    for (let i = 0; i < 5; i++) { const a = -Math.PI + 0.3 + (i / 4) * (Math.PI - 0.6); ell(ctx, 50 + Math.cos(a) * 8, 62 + Math.sin(a) * 10, 6, 15, P.c2, true, a + Math.PI / 2); }
    ell(ctx, 50, 66, 10, 6, '#ffd23d');
    ell(ctx, 50, 86, 30, 5, '#2a7a5a');
  },
};

// ---- Backdrops ----------------------------------------------------------------------------
function backdrop(ctx, bg, rnd) {
  const G = (stops, x1 = 0, y1 = 0, x2 = 0, y2 = 100) => { const g = ctx.createLinearGradient(x1, y1, x2, y2); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100); };
  const dots = (n, color, r = 1) => { ctx.fillStyle = color; for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(rnd() * 100, rnd() * 100, r * (0.5 + rnd()), 0, 7); ctx.fill(); } };
  switch (bg) {
    case 'fire': G(['#3a0a0a', '#c0392b', '#ff9a3d']); ctx.fillStyle = '#2a0a0a'; ctx.beginPath(); ctx.moveTo(0, 100); ctx.lineTo(20, 70); ctx.lineTo(34, 78); ctx.lineTo(60, 52); ctx.lineTo(80, 76); ctx.lineTo(100, 66); ctx.lineTo(100, 100); ctx.fill(); dots(18, '#ffd23d', 0.9); break;
    case 'water': G(['#7fd3ff', '#2f7ad8', '#123a7a']); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; for (let y = 20; y < 100; y += 14) { ctx.beginPath(); for (let x = 0; x <= 100; x += 10) ctx.lineTo(x, y + Math.sin(x / 8 + y) * 2); ctx.stroke(); } dots(10, 'rgba(255,255,255,.5)', 1.5); break;
    case 'grass': G(['#bfeaff', '#e9ffd8']); ctx.fillStyle = '#7ad15f'; ctx.beginPath(); ctx.moveTo(0, 100); ctx.quadraticCurveTo(30, 66, 60, 80); ctx.quadraticCurveTo(80, 70, 100, 76); ctx.lineTo(100, 100); ctx.fill(); ctx.fillStyle = '#4ea83a'; ctx.fillRect(0, 88, 100, 12); break;
    case 'electric': G(['#1a1030', '#4a2a7a', '#ffd23d']); ctx.strokeStyle = 'rgba(255,240,120,.7)'; ctx.lineWidth = 1.6; for (let k = 0; k < 3; k++) { ctx.beginPath(); let x = rnd() * 100; ctx.moveTo(x, 0); for (let y = 0; y < 100; y += 12) { x += (rnd() - 0.5) * 18; ctx.lineTo(x, y); } ctx.stroke(); } break;
    case 'psychic': G(['#ffb3e6', '#a06bff', '#3a1a6a']); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.4; for (let r = 8; r < 80; r += 9) { ctx.beginPath(); ctx.arc(50, 50, r, 0, 7); ctx.stroke(); } break;
    case 'dark': case 'night': G(['#05060f', '#1a1f4a', '#2a2a5a']); dots(30, 'rgba(255,255,255,.8)', 0.6); ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(78, 20, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#1a1f4a'; ctx.beginPath(); ctx.arc(82, 17, 8, 0, 7); ctx.fill(); if (bg === 'night') { ctx.fillStyle = '#05060f'; ctx.fillRect(0, 84, 100, 16); ctx.fillRect(10, 70, 4, 14); ctx.fillRect(86, 70, 4, 14); ctx.fillRect(10, 70, 80, 3); } break;
    case 'wind': G(['#e8f6ff', '#9fd4ff']); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const y = 15 + i * 22; ctx.beginPath(); ctx.moveTo(4, y); ctx.bezierCurveTo(30, y - 6, 50, y + 8, 70, y); ctx.arc(70, y - 4, 4, Math.PI / 2, -Math.PI); ctx.stroke(); } break;
    case 'earth': G(['#f2d0a0', '#c98a4a', '#7a4a2a']); ctx.fillStyle = 'rgba(90,50,20,.35)'; for (let y = 40; y < 100; y += 12) ctx.fillRect(0, y, 100, 4); break;
    case 'city': G(['#5a4a5a', '#2a2230']); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; for (let y = 0; y < 90; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(100, y); ctx.stroke(); for (let x = (y / 8) % 2 ? 0 : 8; x < 100; x += 16) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke(); } } ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 88, 100, 12); ctx.fillStyle = 'rgba(120,160,255,.25)'; ctx.beginPath(); ctx.ellipse(60, 94, 26, 3, 0, 0, 7); ctx.fill(); break;
    case 'neon': G(['#0a0618', '#1a0a2a']); for (const [c, y] of [['#ff3dff', 24], ['#3dffe0', 40], ['#ffd23d', 14]]) { ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 8; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8 + rnd() * 20, y); ctx.lineTo(60 + rnd() * 30, y + rnd() * 6); ctx.stroke(); ctx.restore(); } ctx.fillStyle = '#05030a'; ctx.fillRect(0, 88, 100, 12); break;
    case 'light': G(['#fffbe8', '#ffe9a8']); ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 10; i++) { ctx.save(); ctx.translate(50, 30); ctx.rotate(i / 10 * Math.PI * 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, 90); ctx.lineTo(5, 90); ctx.fill(); ctx.restore(); } break;
    case 'arcane': G(['#2a1a3a', '#0f0a1a']); ctx.strokeStyle = 'rgba(199,146,255,.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(50, 56, 38, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(50, 56, 30, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(199,146,255,.5)'; ctx.font = '6px serif'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillText('ᚠᚢᚦᚨᚱᚲ'[i % 6], 48 + Math.cos(a) * 34, 58 + Math.sin(a) * 34); } break;
    case 'forest': G(['#0d1a2a', '#1a3a2a']); ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(24, 18, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#071209'; for (let i = 0; i < 7; i++) { const x = i * 16 + rnd() * 6; ctx.beginPath(); ctx.moveTo(x, 100); ctx.lineTo(x + 8, 40 + rnd() * 20); ctx.lineTo(x + 16, 100); ctx.fill(); } break;
    case 'desert': G(['#ffcf8a', '#ff9a5a']); ctx.fillStyle = '#fff1c0'; ctx.beginPath(); ctx.arc(76, 24, 10, 0, 7); ctx.fill(); ctx.fillStyle = '#e8a060'; ctx.beginPath(); ctx.moveTo(0, 100); ctx.quadraticCurveTo(40, 70, 100, 86); ctx.lineTo(100, 100); ctx.fill(); ctx.fillStyle = '#4a8a4a'; ctx.fillRect(84, 60, 5, 26); ctx.fillRect(80, 68, 4, 10); break;
    case 'lake': case 'sea': G(bg === 'sea' ? ['#0a1a3a', '#123a6a', '#0a2a4a'] : ['#c8d8e8', '#7a9ab0', '#3a5a6a']); ctx.fillStyle = bg === 'sea' ? '#0a2a4a' : '#4a6a7a'; ctx.fillRect(0, 70, 100, 30); ctx.fillStyle = 'rgba(40,60,70,.6)'; ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(16, 56); ctx.lineTo(34, 70); ctx.lineTo(60, 52); ctx.lineTo(86, 70); ctx.fill(); break;
    default: G(['#fff8ee', '#ffe2c6']); ctx.fillStyle = 'rgba(255,255,255,.9)'; for (const [x, y] of [[20, 20], [70, 30]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.arc(x + 7, y - 3, 7, 0, 7); ctx.arc(x + 14, y, 6, 0, 7); ctx.fill(); }
  }
}

// Draw the illustration for an art spec into the box (x, y, w, h).
export function drawArt(ctx, x, y, w, h, spec, seedKey = '') {
  const s = spec || { b: 'blob', c: ['#bbb', '#eee'] };
  const P = { c1: s.c[0], c2: s.c[1] || s.c[0], c3: s.c[2], x: s.x || [], e: s.e || 'cute', skin: s.skin };
  const rnd = seeded(seedKey || s.b);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x, y);
  ctx.scale(w / 100, h / 100);
  backdrop(ctx, s.bg || 'normal', rnd);
  // keep the creature in proportion when the box isn't square
  const k = Math.min(w, h) / Math.max(w, h);
  ctx.translate(50, 54);
  if (w > h) ctx.scale(k, 1); else ctx.scale(1, k);
  ctx.scale(1.06, 1.06);
  ctx.translate(-50, -52);
  ctx.shadowColor = 'rgba(0,0,0,.25)';
  ctx.shadowBlur = 0;
  (BODIES[s.b] || BODIES.blob)(ctx, P);
  ctx.restore();
}

// Cached bitmap of an illustration, for things drawn every frame (pack windows).
const artCache = new Map();
export function artBitmap(spec, key, w, h) {
  const k = `${key}|${Math.round(w)}x${Math.round(h)}`;
  let c = artCache.get(k);
  if (!c) {
    const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    drawArt(ctx, 0, 0, w, h, spec, key);
    artCache.set(k, c);
    if (artCache.size > 60) artCache.delete(artCache.keys().next().value);
  }
  return c;
}
