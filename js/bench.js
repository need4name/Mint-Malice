// 🧪 Backroom Bench: full-bleed canvas hosting the scam pipeline stations
// (Weigh & Scan → Crack & Strip → Crimp & Reseal) plus the Forgery Engine.
import { S, bus, changed, packCat, hasUpg, gauss, uid, clamp } from './state.js';
import { SETS, HEAVY, LIGHT } from './data.js';
import { attachInput } from './input.js';
import { bench, drawPack, drawCard, rr, text } from './draw.js';
import { toast, haptic, money, actions, bindActions } from './ui.js';
import { sfx } from './audio.js';
import { pickHit } from './rules.js';
import { Forge } from './forge.js';

let canvas, ctx, wrap, ctrlEl, hintEl, tabsEl, input;
let dpr = 1, raf = 0, visible = false, cur = 'weigh';
const api = {
  W: 0, H: 0,
  refresh: () => renderControls(),
  hint: t => { hintEl.textContent = t; },
  select: name => select(name),
};
const stations = {};
const find = id => S.packs.find(p => p.id === id);
const inRect = (p, x, y, w, h) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;

export function initBench(root) {
  root.innerHTML = `<div class="seg" id="bench-tabs">
      <button data-st="weigh">⚖️ Weigh</button><button data-st="crack">✂️ Crack</button>
      <button data-st="crimp">🔥 Crimp</button><button data-st="forge">🎨 Forge</button>
    </div>
    <div class="canvas-wrap"><canvas aria-label="Backroom workbench"></canvas><div class="bench-hint"></div></div>
    <div class="bench-ctrl"></div>`;
  canvas = root.querySelector('canvas');
  ctx = canvas.getContext('2d');
  wrap = root.querySelector('.canvas-wrap');
  ctrlEl = root.querySelector('.bench-ctrl');
  hintEl = root.querySelector('.bench-hint');
  tabsEl = root.querySelector('#bench-tabs');
  stations.weigh = new Weigh();
  stations.crack = new Crack();
  stations.crimp = new Crimp();
  stations.forge = new Forge(api);
  tabsEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sfx.tap(); select(b.dataset.st); }));
  input = attachInput(canvas, {
    down: (p, l) => stations[cur].down?.(p, l),
    move: (p, l) => stations[cur].move?.(p, l),
    up: (p, l) => stations[cur].up?.(p, l),
    wheel: e => stations[cur].wheel?.(e),
  });
  window.addEventListener('resize', () => { if (visible) resize(); });
  bus.on('change', () => { if (visible) { renderControls(); updateBadges(); } });
  select('weigh');
}

function select(name) {
  cur = name;
  input?.reset();
  tabsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.st === name));
  stations[name].enter?.();
  renderControls();
}

function updateBadges() {
  const n = {
    weigh: S.packs.filter(p => packCat(p) === 'sealed').length,
    crack: S.packs.filter(p => packCat(p) === 'heavy').length,
    crimp: S.packs.filter(p => packCat(p) === 'open').length,
  };
  tabsEl.querySelectorAll('button').forEach(b => {
    const v = n[b.dataset.st];
    b.dataset.badge = v ? String(v) : '';
  });
}

function renderControls() {
  const { A, a } = actions();
  ctrlEl.innerHTML = stations[cur].controls?.(a) || '';
  bindActions(ctrlEl, A);
}

function resize() {
  const r = wrap.getBoundingClientRect();
  dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
  api.W = r.width;
  api.H = r.height;
}

function loop(t) {
  if (!visible) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, api.W, api.H);
  stations[cur].render(ctx, api.W, api.H, t);
  raf = requestAnimationFrame(loop);
}

export function showBench() {
  visible = true;
  resize();
  updateBadges();
  stations[cur].enter?.();
  renderControls();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}
export function hideBench() {
  visible = false;
  cancelAnimationFrame(raf);
}

function emptyMsg(ctx, W, H, msg, sub) {
  text(ctx, msg, W / 2, H * 0.44, { size: 16, weight: 700 });
  if (sub) text(ctx, sub, W / 2, H * 0.44 + 24, { size: 13, color: '#8a93a6', weight: 500 });
}

// ============================================================================
// 1. WEIGH & SCAN — drag packs onto the scale, then into the DUD or HEAVY bin.
// ============================================================================
class Weigh {
  constructor() { this.drag = null; this.scaleId = null; this.readAt = 0; }

  enter() { api.hint(`Drag a pack onto the scale, then into a bin. Heavy ≈ ${HEAVY}g (foil) · Light ≈ ${LIGHT}g (dud).`); }

  onScale() {
    const p = this.scaleId && find(this.scaleId);
    if (!p || packCat(p) !== 'sealed') { this.scaleId = null; return null; }
    return p;
  }
  tray() {
    const skip = new Set([this.scaleId, this.drag?.id]);
    return S.packs.filter(p => packCat(p) === 'sealed' && !skip.has(p.id)).slice(0, 5);
  }
  L() {
    const { W, H } = api;
    const pw = Math.min(58, W / 7.2), ph = pw * 1.45;
    return {
      pw, ph,
      sc: { x: W / 2, y: H * 0.34, w: Math.min(200, W * 0.55) },
      bins: {
        dud: { x: W * 0.05, y: H * 0.5, w: W * 0.41, h: H * 0.2 },
        heavy: { x: W * 0.54, y: H * 0.5, w: W * 0.41, h: H * 0.2 },
      },
      trayY: H * 0.77,
    };
  }
  trayPos(i, n, L) {
    const gap = (api.W - n * L.pw) / (n + 1);
    return { x: gap + i * (L.pw + gap), y: L.trayY };
  }

  down(p) {
    if (this.drag) return;
    const L = this.L();
    const s = this.onScale();
    if (s) {
      const x = L.sc.x - L.pw / 2, y = L.sc.y - L.ph;
      if (inRect(p, x - 8, y - 8, L.pw + 16, L.ph + 16)) { this.drag = { id: s.id, pid: p.id, from: 'scale', x: p.x, y: p.y, ox: p.x - x, oy: p.y - y }; return; }
    }
    const tray = this.tray();
    for (let i = 0; i < tray.length; i++) {
      const pos = this.trayPos(i, tray.length, L);
      if (inRect(p, pos.x - 6, pos.y - 6, L.pw + 12, L.ph + 12)) {
        this.drag = { id: tray[i].id, pid: p.id, from: 'tray', x: p.x, y: p.y, ox: p.x - pos.x, oy: p.y - pos.y };
        haptic(8);
        return;
      }
    }
  }
  move(p) {
    if (this.drag && this.drag.pid === p.id) { this.drag.x = p.x; this.drag.y = p.y; }
  }
  up(p) {
    const d = this.drag;
    if (!d || d.pid !== p.id) return;
    this.drag = null;
    const pk = find(d.id);
    if (!pk) return;
    const L = this.L();
    const cx = d.x - d.ox + L.pw / 2, cy = d.y - d.oy + L.ph / 2;
    if (d.from === 'tray' && Math.abs(cx - L.sc.x) < L.sc.w / 2 + 12 && cy > L.sc.y - L.ph * 1.5 && cy < L.sc.y + 50) {
      this.scaleId = pk.id;
      if (pk.reading == null) {
        const sigma = hasUpg('equip1') ? 0.006 : 0.2;
        pk.reading = pk.w + gauss() * sigma;
        changed();
      }
      this.readAt = performance.now();
      sfx.scale();
      haptic(10);
      return;
    }
    if (d.from === 'scale') {
      for (const [bin, r] of Object.entries(L.bins)) {
        if (inRect({ x: cx, y: cy }, r.x, r.y, r.w, r.h)) {
          pk.sorted = bin;
          this.scaleId = null;
          sfx.tap();
          haptic(12);
          changed();
          return;
        }
      }
    }
  }

  render(ctx, W, H, t) {
    bench(ctx, W, H);
    const L = this.L();
    // Bins
    for (const [bin, r] of Object.entries(L.bins)) {
      const n = S.packs.filter(p => packCat(p) === bin).length;
      const hot = this.drag?.from === 'scale';
      ctx.fillStyle = bin === 'heavy' ? 'rgba(61,255,176,0.08)' : 'rgba(255,61,110,0.08)';
      rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = hot ? 3 : 1.5;
      ctx.strokeStyle = bin === 'heavy' ? '#3dffb0' : '#ff3d6e';
      rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, bin === 'heavy' ? '💎 HEAVY BIN' : '🗑️ DUD BIN', r.x + r.w / 2, r.y + r.h * 0.38, { size: 13, weight: 800, color: bin === 'heavy' ? '#3dffb0' : '#ff3d6e' });
      text(ctx, `${n} pack${n === 1 ? '' : 's'}`, r.x + r.w / 2, r.y + r.h * 0.66, { size: 12, color: '#c8cede', weight: 500 });
    }
    // Scale
    const sc = L.sc;
    ctx.fillStyle = '#3a4150';
    rr(ctx, sc.x - sc.w / 2 + 10, sc.y + 6, sc.w - 20, 46, 8); ctx.fill();
    ctx.fillStyle = '#c9ced8';
    rr(ctx, sc.x - sc.w / 2, sc.y, sc.w, 10, 4); ctx.fill();
    const s = this.onScale();
    let shown = 0;
    if (s && s.reading != null) {
      const k = clamp((t - this.readAt) / 700, 0, 1);
      shown = s.reading * (1 - Math.pow(1 - k, 3)) + Math.sin(t / 35) * 0.08 * (1 - k);
    }
    ctx.fillStyle = '#0d1a12';
    rr(ctx, sc.x - 56, sc.y + 16, 112, 28, 5); ctx.fill();
    const digits = hasUpg('equip1') ? 2 : 1;
    text(ctx, `${shown.toFixed(digits)} g`, sc.x, sc.y + 31, { size: 18, weight: 700, color: '#62ff9a' });
    text(ctx, hasUpg('equip1') ? 'DIGITAL GRAM SCALE' : 'KITCHEN SCALE ±0.2g', sc.x, sc.y + 62, { size: 9, color: '#8a93a6', weight: 600 });
    if (s && (!this.drag || this.drag.id !== s.id)) {
      const xray = hasUpg('equip3') && s.hit;
      drawPack(ctx, sc.x - L.pw / 2, sc.y - L.ph, L.pw, L.ph, s, { glow: xray ? '#ff3dff' : null });
      if (xray) text(ctx, 'X-RAY: HOLO DETECTED', sc.x, sc.y - L.ph - 12, { size: 10, weight: 800, color: '#ff8aff' });
    }
    // Tray
    const tray = this.tray();
    const left = S.packs.filter(p => packCat(p) === 'sealed').length;
    text(ctx, `UNWEIGHED PACKS · ${left}`, W / 2, L.trayY - 14, { size: 10, color: '#8a93a6', weight: 700 });
    if (!tray.length && !s && !this.drag) emptyMsg(ctx, W, H * 1.75, 'No unweighed packs', 'Buy boxes at the Shop or on ScamBay.');
    tray.forEach((pk, i) => {
      const pos = this.trayPos(i, tray.length, L);
      drawPack(ctx, pos.x, pos.y, L.pw, L.ph, pk, { glow: hasUpg('equip3') && pk.hit ? '#ff3dff' : null });
    });
    if (this.drag) {
      const pk = find(this.drag.id);
      if (pk) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 16;
        drawPack(ctx, this.drag.x - this.drag.ox, this.drag.y - this.drag.oy - 6, L.pw, L.ph, pk);
        ctx.restore();
      }
    }
  }

  controls(a) {
    const heavy = S.packs.filter(p => packCat(p) === 'heavy').length;
    return `<div class="ctrl-row"><span class="muted small">Duds sell as sealed packs with zero risk. Heavy packs hide the hits.</span>
      <button class="btn small" ${heavy ? '' : 'disabled'} data-a="${a(() => select('crack'))}">Crack heavy (${heavy}) ✂️</button></div>`;
  }
}

// ============================================================================
// 2. CRACK & STRIP — swipe across the top crimp to open, pocket the hit.
// ============================================================================
class Crack {
  constructor() { this.filter = 'heavy'; this.stroke = null; this.reveal = null; this.trail = []; }

  pool(f = this.filter) { return S.packs.filter(p => packCat(p) === (f === 'unsorted' ? 'sealed' : f)); }
  current() { return this.reveal ? find(this.reveal.id) : this.pool()[0]; }
  enter() {
    if (!this.reveal && !this.pool().length) {
      for (const f of ['heavy', 'unsorted', 'dud']) if (this.pool(f).length) { this.filter = f; break; }
    }
    api.hint('Swipe across the foil crimp at the top of the pack to tear it open.');
  }
  L() {
    const { W, H } = api;
    const ph = Math.min(H * 0.5, 260), pw = ph / 1.5;
    return { pw, ph, x: W / 2 - pw / 2, y: H * 0.26 };
  }
  down(p) {
    if (this.reveal || !this.current()) return;
    const L = this.L();
    if (p.y > L.y - 45 && p.y < L.y + L.ph * 0.25 && p.x > L.x - 70 && p.x < L.x + L.pw + 70) {
      this.stroke = { id: p.id, min: p.x, max: p.x };
      this.trail = [{ x: p.x, y: p.y, t: performance.now() }];
    }
  }
  move(p) {
    const s = this.stroke;
    if (!s || s.id !== p.id) return;
    const L = this.L();
    if (p.y < L.y - 80 || p.y > L.y + L.ph * 0.32) { this.stroke = null; return; }
    s.min = Math.min(s.min, p.x);
    s.max = Math.max(s.max, p.x);
    this.trail.push({ x: p.x, y: p.y, t: performance.now() });
    const cov = (Math.min(s.max, L.x + L.pw) - Math.max(s.min, L.x)) / L.pw;
    if (cov >= 0.78) this.open();
  }
  up(p) { if (this.stroke?.id === p.id) this.stroke = null; }

  open() {
    const pk = this.current();
    this.stroke = null;
    if (!pk) return;
    pk.opened = true;
    sfx.rip();
    haptic(40);
    let card;
    const hit = pk.hit;
    if (hit) {
      const h = pickHit(pk.set);
      card = { id: uid(), set: pk.set, name: h.name, value: h.value, art: h.art };
      S.singles.push(card);
      pk.hit = false;
      if (S.commons > 0) { S.commons--; pk.w = LIGHT + gauss() * 0.012; } // bulk common swapped in
      else { pk.short = true; pk.w = LIGHT - 1.7; }
      setTimeout(() => sfx.success(), 250);
      toast(`HIT! ${card.name} (${money(card.value)}) stashed${pk.short ? ' — no commons to swap in, pack is light!' : '. Bulk common swapped in.'}`, 'good');
    } else {
      card = { set: pk.set, name: 'Bulk Commons', value: 0, art: '🃏' };
      toast(pk.sorted === 'heavy' ? 'Dud! The scale lied… just commons.' : 'Just commons. Off to the crimper.', 'info');
    }
    this.reveal = { id: pk.id, card, hit, t: performance.now() };
    changed();
  }

  render(ctx, W, H, t) {
    bench(ctx, W, H);
    const pk = this.current();
    if (!pk) { emptyMsg(ctx, W, H, `No ${this.filter} packs`, 'Weigh packs first, or switch filter below.'); return; }
    const L = this.L();
    if (this.reveal) {
      const k = clamp((t - this.reveal.t) / 650, 0, 1);
      // torn strip flying away
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(L.x + L.pw / 2 + k * W * 0.4, L.y - k * 80);
      ctx.rotate(k * 0.8);
      ctx.fillStyle = SETS[pk.set].color;
      ctx.fillRect(-L.pw / 2, 0, L.pw, L.ph * 0.12);
      ctx.restore();
      const cw = L.pw * 0.86, ch = cw * 1.4;
      const cy = L.y + L.ph * 0.55 - k * L.ph * 0.55;
      drawCard(ctx, W / 2, cy, cw, ch, this.reveal.card, { glow: this.reveal.hit ? '#ffd23d' : null, holo: this.reveal.hit });
      drawPack(ctx, L.x, L.y + L.ph * 0.35, L.pw, L.ph * 0.65, pk, { openTop: true });
      const msg = this.reveal.hit ? `💎 ${this.reveal.card.name} · ${money(this.reveal.card.value)}` : '🃏 Commons only';
      text(ctx, msg, W / 2, Math.min(L.y + L.ph + 22, H * 0.86), { size: 15, weight: 800, color: this.reveal.hit ? '#ffd23d' : '#c8cede' });
      return;
    }
    const xray = hasUpg('equip3') && pk.hit;
    drawPack(ctx, L.x, L.y, L.pw, L.ph, pk, { glow: xray ? '#ff3dff' : null });
    // tear guide
    const pulse = 0.5 + 0.5 * Math.sin(t / 220);
    ctx.strokeStyle = `rgba(255,210,61,${0.4 + pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(L.x - 10, L.y + L.ph * 0.09); ctx.lineTo(L.x + L.pw + 10, L.y + L.ph * 0.09); ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, 'SWIPE → TO TEAR', W / 2, L.y - 22, { size: 12, weight: 800, color: '#ffd23d' });
    const reading = pk.reading != null ? `${pk.reading.toFixed(hasUpg('equip1') ? 2 : 1)} g` : 'unweighed';
    text(ctx, `${SETS[pk.set].name} · ${reading}${xray ? ' · X-RAY HOLO' : ''}`, W / 2, L.y + L.ph + 20, { size: 12, color: '#c8cede', weight: 600 });
    // swipe trail
    const now = performance.now();
    this.trail = this.trail.filter(q => now - q.t < 260);
    if (this.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      this.trail.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
    }
  }

  controls(a) {
    if (this.reveal) {
      const n = S.packs.filter(p => packCat(p) === 'open').length;
      return `<div class="ctrl-row">
        <button class="btn" data-a="${a(() => { this.reveal = null; this.enter(); api.refresh(); })}">Next pack ▶</button>
        <button class="btn mint" data-a="${a(() => { this.reveal = null; select('crimp'); })}">Reseal it 🔥 (${n})</button></div>`;
    }
    const f = (id, label) => {
      const n = this.pool(id).length;
      return `<button class="${this.filter === id ? 'on' : ''}" data-a="${a(() => { this.filter = id; api.refresh(); })}">${label} ${n}</button>`;
    };
    return `<div class="seg small">${f('heavy', '💎 Heavy')}${f('unsorted', '📦 Unweighed')}${f('dud', '🗑️ Duds')}</div>`;
  }
}

// ============================================================================
// 3. CRIMP & RESEAL — drag the heat iron along the seam at the right speed.
// ============================================================================
const NSEG = 24;
class Crimp {
  constructor() { this.job = null; this.drag = null; this.ema = 0; this.done = null; this.ironX = null; this.lastMove = 0; }

  queue() { return S.packs.filter(p => packCat(p) === 'open'); }
  band() { return hasUpg('equip2') ? [0.3, 1.35] : [0.45, 0.95]; } // seam-widths per second
  enter() { api.hint('Drag the hot iron along the seam. Too fast = loose pack · too slow = burnt plastic.'); }
  ensureJob() {
    if (this.done) return;
    const pk = this.queue()[0];
    if (!pk) { this.job = null; return; }
    if (!this.job || this.job.id !== pk.id) { this.job = { id: pk.id, seg: Array(NSEG).fill(null), prog: 0, segT: 0 }; this.ironX = null; }
  }
  L() {
    const { W, H } = api;
    const pw = Math.min(W * 0.86, 340), ph = Math.min(H * 0.36, pw * 0.75);
    const x = W / 2 - pw / 2, y = H * 0.24;
    return { pw, ph, x, y, x0: x + 12, x1: x + pw - 12, sy: y + 22 };
  }
  down(p) {
    this.ensureJob();
    const j = this.job;
    if (!j || this.done) return;
    const L = this.L();
    const px = L.x0 + (j.prog / NSEG) * (L.x1 - L.x0);
    if (Math.abs(p.y - L.sy) < 60 && p.x < px + 60 && p.x > px - 90) {
      const now = performance.now();
      this.drag = { id: p.id, hist: [{ t: now, x: Math.max(p.x, px) }] };
      this.ema = 0;
      j.segT = now;
      this.ironX = Math.max(p.x, px);
    }
  }
  move(p) {
    const d = this.drag, j = this.job;
    if (!d || d.id !== p.id || !j) return;
    const L = this.L();
    if (Math.abs(p.y - L.sy) > 100) { this.drag = null; return; }
    const now = performance.now();
    const span = L.x1 - L.x0;
    const x = clamp(p.x, L.x0, L.x1);
    // Speed over a short sliding window, so touch-event jitter doesn't flip segments.
    d.hist.push({ t: now, x });
    while (d.hist.length > 2 && now - d.hist[0].t > 180) d.hist.shift();
    const h0 = d.hist[0];
    if (now - h0.t > 30) this.ema = Math.max(0, (x - h0.x) / span) / ((now - h0.t) / 1000);
    this.lastMove = now;
    this.ironX = Math.max(this.ironX ?? x, x);
    const idx = x >= L.x1 - 3 ? NSEG : Math.min(NSEG, Math.floor(((x - L.x0) / span) * NSEG));
    if (idx > j.prog) {
      const [lo, hi] = this.band();
      const v = this.ema;
      for (let k = j.prog; k < idx; k++) if (!j.seg[k]) j.seg[k] = v < lo ? 'slow' : v > hi ? 'fast' : 'good';
      j.prog = idx;
      j.segT = now;
      sfx.sizzle();
      if (j.prog >= NSEG) this.finish();
    }
  }
  up(p) { if (this.drag?.id === p.id) this.drag = null; }

  finish() {
    const j = this.job;
    const pk = find(j.id);
    this.drag = null;
    if (!pk) return;
    const good = j.seg.filter(s => s === 'good').length;
    const fast = j.seg.filter(s => s === 'fast').length;
    const q = Math.round(((good + fast * 0.3) / NSEG) * 100);
    pk.resealed = true;
    pk.crimp = q;
    this.done = { id: pk.id, q, seg: j.seg.slice() };
    this.job = null;
    if (q >= 80) { sfx.success(); toast(`Factory-fresh seal! Quality ${q}%`, 'good'); }
    else if (q >= 50) { sfx.cash(); toast(`Passable seal. Quality ${q}%`, 'info'); }
    else { sfx.fail(); haptic([40, 30, 40], 'bad'); toast(`Ugly seal… quality ${q}%. Sell it to a kid.`, 'bad'); }
    changed();
  }

  render(ctx, W, H, t) {
    bench(ctx, W, H);
    this.ensureJob();
    const j = this.job, done = this.done;
    if (!j && !done) { emptyMsg(ctx, W, H, 'Nothing to reseal', 'Crack open some packs first.'); return; }
    const pk = find(done ? done.id : j.id);
    if (!pk) { this.done = null; return; }
    const L = this.L();
    const seg = done ? done.seg : j.seg;
    const prog = done ? NSEG : j.prog;
    // burning: iron resting on one segment too long
    if (j && this.drag) {
      const dwell = 2.5 / (NSEG * this.band()[0]); // seconds parked on one segment before it scorches
      if ((t - j.segT) / 1000 > dwell && j.prog < NSEG && !j.seg[j.prog]) { j.seg[j.prog] = 'slow'; haptic(20, 'bad'); }
      if (t - this.lastMove > 90) this.ema *= 0.9;
    }
    // close-up of the pack top
    const set = SETS[pk.set];
    const g = ctx.createLinearGradient(L.x, L.y, L.x + L.pw, L.y + L.ph);
    g.addColorStop(0, set.color); g.addColorStop(1, set.color2);
    ctx.fillStyle = g;
    rr(ctx, L.x, L.y, L.pw, L.ph, 10); ctx.fill();
    ctx.font = `${L.ph * 0.42}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(set.mascot, L.x + L.pw / 2, L.y + L.ph * 0.6);
    text(ctx, 'CLOSE-UP · TOP SEAM', L.x + L.pw / 2, L.y + L.ph - 14, { size: 10, weight: 800, color: 'rgba(255,255,255,.7)' });
    const sw = (L.x1 - L.x0) / NSEG;
    for (let k = 0; k < NSEG; k++) {
      const s = seg[k];
      const x = L.x0 + k * sw;
      if (!s) { ctx.fillStyle = '#111'; ctx.fillRect(x, L.sy - 3, sw + 0.5, 6); continue; }
      ctx.fillStyle = s === 'good' ? '#3dffb0' : s === 'fast' ? '#ffd23d' : '#6b2a12';
      ctx.fillRect(x, L.sy - 7, sw + 0.5, 14);
      if (s === 'fast') { ctx.fillStyle = '#111'; ctx.fillRect(x + sw * 0.3, L.sy - 2, sw * 0.4, 4); }
      if (s === 'slow' && Math.random() < 0.05 && !done) { ctx.fillStyle = 'rgba(200,200,200,.4)'; ctx.beginPath(); ctx.arc(x + sw / 2, L.sy - 18 - Math.random() * 20, 6, 0, 7); ctx.fill(); }
    }
    if (!done) {
      const ix = this.ironX ?? L.x0 + (prog / NSEG) * (L.x1 - L.x0);
      ctx.save();
      ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = this.drag ? 22 : 8;
      ctx.fillStyle = '#ff7a1a';
      rr(ctx, ix - 16, L.sy - 16, 32, 32, 6); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#555';
      rr(ctx, ix - 6, L.sy - 70, 12, 56, 4); ctx.fill();
      ctx.fillStyle = '#222';
      rr(ctx, ix - 12, L.sy - 96, 24, 34, 6); ctx.fill();
      if (!this.drag) text(ctx, prog ? 'KEEP GOING →' : 'DRAG IRON →', clamp(ix, 60, W - 60), L.sy + 36, { size: 12, weight: 800, color: '#ffd23d' });
    } else {
      text(ctx, `SEAL QUALITY ${done.q}%`, W / 2, L.y + L.ph + 34, { size: 20, weight: 800, color: done.q >= 80 ? '#3dffb0' : done.q >= 50 ? '#ffd23d' : '#ff3d6e' });
    }
    // speed gauge
    const gx = W * 0.08, gw = W * 0.84, gy = H * 0.78, max = 2;
    const [lo, hi] = this.band();
    ctx.fillStyle = '#2a3140'; rr(ctx, gx, gy, gw, 12, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,61,110,.5)'; ctx.fillRect(gx, gy, gw * (lo / max), 12);
    ctx.fillStyle = 'rgba(61,255,176,.6)'; ctx.fillRect(gx + gw * (lo / max), gy, gw * ((hi - lo) / max), 12);
    ctx.fillStyle = 'rgba(255,210,61,.45)'; ctx.fillRect(gx + gw * (hi / max), gy, gw * (1 - hi / max), 12);
    const nx = gx + gw * clamp(this.ema / max, 0, 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(nx - 2, gy - 6, 4, 24);
    text(ctx, 'BURNT', gx, gy + 28, { size: 10, align: 'left', color: '#ff3d6e', weight: 800 });
    text(ctx, 'SWEET SPOT', gx + gw * ((lo + hi) / 2 / max), gy + 28, { size: 10, color: '#3dffb0', weight: 800 });
    text(ctx, 'LOOSE', gx + gw, gy + 28, { size: 10, align: 'right', color: '#ffd23d', weight: 800 });
  }

  controls(a) {
    const n = this.queue().length;
    if (this.done) {
      return `<div class="ctrl-row"><span class="muted small">Resealed packs sell from the counter, ScamBay or live breaks.</span>
        <button class="btn" data-a="${a(() => { this.done = null; api.refresh(); })}">${n ? `Next pack ▶ (${n})` : 'Done ✓'}</button></div>`;
    }
    return `<div class="ctrl-row"><span class="muted small">${n} pack${n === 1 ? '' : 's'} awaiting reseal${hasUpg('equip2') ? ' · Thermal Crimp Sealer fitted' : ''}.</span>
      <button class="btn small" data-a="${a(() => select('crack'))}">✂️ Crack more</button></div>`;
  }
}
