// 🎨 Card Forgery Engine — 3-step touch canvas:
// 1. Foil Centering (drag / pinch / two-finger rotate)  2. Texture Emboss (rub)
// 3. Artificial Aging (sponge the edges to the set's era wear grade).
import { S, changed, addHeat, hasUpg, artSkill, unlockedSets, uid, clamp, rand } from './state.js';
import { SETS, WEAR } from './data.js';
import { drawCard, rr, text, bench } from './draw.js';
import { toast, haptic, money } from './ui.js';
import { sfx } from './audio.js';

const NEDGE = 60;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function forgeGrade(align, texture, art) {
  return align * 0.4 + texture * 0.35 + art * 0.25;
}

export class Forge {
  constructor(api) { this.api = api; this.step = 'select'; this.ti = 0; this.job = null; this.g = null; this.cursor = null; this.rubAcc = 0; }

  templates() {
    const out = [];
    for (const s of unlockedSets()) {
      for (const h of SETS[s].hits) {
        out.push({ ...h, set: s });
        if (hasUpg('art3')) out.push({ ...h, set: s, name: `${h.name} ★`, value: h.value * 2, secret: true });
      }
    }
    return out;
  }
  tpl() { const t = this.templates(); this.ti = ((this.ti % t.length) + t.length) % t.length; return t[this.ti]; }
  R() {
    const { W, H } = this.api;
    const ch = Math.min(H * 0.6, W * 0.6 * 1.4);
    return { cx: W / 2, cy: H * 0.47, cw: ch / 1.4, ch };
  }
  enter() {
    const hints = {
      select: 'Pick a chase card to counterfeit. Each forgery uses one sheet of blank cardstock.',
      center: 'Step 1 · Drag, pinch & two-finger rotate the yellow foil onto the green boundary.',
      emboss: 'Step 2 · Rub back and forth to emboss. Stop in the green zone — over-rubbing tears the stock!',
      age: 'Step 3 · Drag the sponge along the edges until wear matches the set’s era.',
      result: 'Forgery complete. Sell it at the counter, on ScamBay, or swap it for a real one.',
    };
    this.api.hint(hints[this.step]);
  }
  go(step) { this.step = step; this.g = null; this.enter(); this.api.refresh(); }

  start() {
    if (S.blanks < 1) { toast('No blank cardstock. Buy some from the Supplier.', 'bad'); return; }
    S.blanks--;
    const { cw, ch } = this.R();
    const sgn = () => (Math.random() < 0.5 ? -1 : 1);
    this.job = {
      tpl: this.tpl(),
      ov: { dx: sgn() * rand(0.12, 0.3) * cw, dy: sgn() * rand(0.1, 0.25) * ch, s: 1 + sgn() * rand(0.12, 0.28), a: sgn() * rand(0.12, 0.4) },
      align: 0, fill: 0, tear: false, texture: 0, wear: Array(NEDGE).fill(0),
      dots: Array.from({ length: 260 }, () => [Math.random(), Math.random()]),
    };
    changed();
    this.go('center');
  }

  // ---- Step 1: centering ----------------------------------------------------
  accuracy() {
    const { cw } = this.R();
    const o = this.job.ov;
    const errPos = (Math.hypot(o.dx, o.dy) / cw) * 100;
    const errS = Math.abs(o.s - 1) * 100;
    const errA = Math.abs((o.a * 180) / Math.PI);
    return Math.round(clamp(100 - errPos * 2.2 - errS * 1.6 - errA * 1.6, 0, 100));
  }
  beginGesture(list) {
    const o = { ...this.job.ov };
    if (list.length >= 2) {
      const [a, b] = list;
      this.g = { two: true, ids: [a.id, b.id], d: Math.max(10, dist(a, b)), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, o };
    } else if (list.length === 1) {
      this.g = { two: false, id: list[0].id, x: list[0].x, y: list[0].y, o };
    } else this.g = null;
  }
  snap() {
    if (!hasUpg('art2')) return;
    const o = this.job.ov, { cw } = this.R();
    if (Math.hypot(o.dx, o.dy) < cw * 0.05) { o.dx = 0; o.dy = 0; }
    if (Math.abs(o.s - 1) < 0.04) o.s = 1;
    if (Math.abs(o.a) < 0.05) o.a = 0;
  }
  nudge(ds, da) {
    const o = this.job.ov;
    o.s = clamp(o.s + ds, 0.4, 2);
    o.a += da;
    this.snap();
  }
  wheel(e) {
    if (this.step !== 'center') return;
    if (e.shiftKey) this.nudge(0, e.deltaY * -0.002);
    else this.nudge(e.deltaY * -0.0015, 0);
  }

  // ---- Step 2: emboss ---------------------------------------------------------
  rub(d) {
    const j = this.job;
    if (j.tear) return;
    const { cw } = this.R();
    j.fill += (d / (cw * 10)) * 100;
    this.rubAcc += d;
    if (this.rubAcc > 45) { this.rubAcc = 0; sfx.rub(); }
    if (j.fill > 100) {
      j.fill = 100;
      j.tear = true;
      addHeat(15);
      sfx.rip();
      haptic([60, 30, 60], 'bad');
      toast('RIIIP! Over-rubbed — visible card stock tear. +15% heat', 'bad');
      this.api.refresh();
    }
  }
  textureScore() {
    const { fill, tear } = this.job;
    let s;
    if (tear) s = 25;
    else if (fill < 75) s = (fill / 75) * 85;
    else if (fill <= 92) s = 100 - Math.abs(fill - 84) * 1.2;
    else s = 90 - (fill - 92) * 5;
    if (hasUpg('equip4')) s += 15;
    return Math.round(clamp(s, 0, 100));
  }

  // ---- Step 3: aging -------------------------------------------------------------
  edgePoint(i) {
    const { cx, cy, cw, ch } = this.R();
    const per = 2 * (cw + ch);
    let u = ((i + 0.5) / NEDGE) * per;
    const x0 = cx - cw / 2, y0 = cy - ch / 2;
    if (u < cw) return { x: x0 + u, y: y0, side: 't' };
    u -= cw;
    if (u < ch) return { x: x0 + cw, y: y0 + u, side: 'r' };
    u -= ch;
    if (u < cw) return { x: x0 + cw - u, y: y0 + ch, side: 'b' };
    u -= cw;
    return { x: x0, y: y0 + ch - u, side: 'l' };
  }
  wearTarget() { return WEAR[SETS[this.job.tpl.set].wear]; }
  wearPct() { return Math.round(this.job.wear.reduce((a, b) => a + b, 0) / NEDGE); }
  age(x, y, d) {
    const R = this.R().cw * 0.16;
    let touched = false;
    for (let i = 0; i < NEDGE; i++) {
      const pt = this.edgePoint(i);
      const dd = Math.hypot(pt.x - x, pt.y - y);
      if (dd < R) { this.job.wear[i] = Math.min(100, this.job.wear[i] + d * 0.55 * (1 - dd / R)); touched = true; }
    }
    if (touched) { this.rubAcc += d; if (this.rubAcc > 60) { this.rubAcc = 0; sfx.rub(); } }
  }

  finish() {
    const j = this.job;
    const target = this.wearTarget().target;
    const wear = this.wearPct();
    const agingFactor = clamp(1 - Math.max(0, Math.abs(wear - target) - 8) / 80, 0.6, 1);
    const art = artSkill();
    const base = forgeGrade(j.align, j.texture, art);
    const grade = Math.round(clamp(base * agingFactor, 0, 100));
    const slab = hasUpg('art4') && grade >= 90;
    const f = {
      id: uid(), set: j.tpl.set, art: j.tpl.art, secret: !!j.tpl.secret,
      name: slab ? `${j.tpl.name} [GSA 10]` : j.tpl.name,
      value: j.tpl.value * (slab ? 2 : 1), grade, slab,
    };
    S.forgeries.push(f);
    j.result = { ...f, base: Math.round(base), agingFactor, wear, target, art };
    changed();
    if (grade >= 90) { sfx.success(); haptic(30); }
    else if (grade >= 65) sfx.cash();
    else { sfx.fail(); haptic([60, 30, 60], 'bad'); }
    this.go('result');
  }

  // ---- Input ----------------------------------------------------------------------
  down(p, list) {
    if (!this.job) return;
    if (this.step === 'center') this.beginGesture(list);
    else this.cursor = { id: p.id, x: p.x, y: p.y };
  }
  move(p, list) {
    if (!this.job) return;
    if (this.step === 'center' && this.g) {
      const g = this.g, o = this.job.ov;
      if (g.two) {
        const a = list.find(q => q.id === g.ids[0]), b = list.find(q => q.id === g.ids[1]);
        if (!a || !b) return;
        let da = Math.atan2(b.y - a.y, b.x - a.x) - g.ang;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        o.s = clamp((g.o.s * dist(a, b)) / g.d, 0.4, 2);
        o.a = g.o.a + da;
        o.dx = g.o.dx + ((a.x + b.x) / 2 - g.mx);
        o.dy = g.o.dy + ((a.y + b.y) / 2 - g.my);
      } else if (p.id === g.id) {
        o.dx = g.o.dx + (p.x - g.x);
        o.dy = g.o.dy + (p.y - g.y);
      }
      return;
    }
    const d = Math.hypot(p.dx, p.dy);
    this.cursor = { id: p.id, x: p.x, y: p.y };
    if (this.step === 'emboss') {
      const { cx, cy, cw, ch } = this.R();
      if (Math.abs(p.x - cx) < cw / 2 && Math.abs(p.y - cy) < ch / 2) this.rub(d);
    } else if (this.step === 'age') this.age(p.x, p.y, d);
  }
  up(p, list) {
    if (this.step === 'center' && this.job) { this.snap(); this.beginGesture(list); }
    if (this.cursor?.id === p.id) this.cursor = null;
  }

  // ---- Rendering --------------------------------------------------------------------
  render(ctx, W, H, t) {
    bench(ctx, W, H);
    const { cx, cy, cw, ch } = this.R();
    const j = this.job;

    if (this.step === 'select' || !j) {
      const tp = this.tpl();
      drawCard(ctx, cx, cy, cw, ch, tp, { glow: tp.secret ? '#ff3dff' : '#ffd23d' });
      text(ctx, `${tp.name} · street value ${money(tp.value)}`, W / 2, H * 0.08, { size: 14, weight: 800, color: '#ffd23d' });
      text(ctx, `Era wear: ${WEAR[SETS[tp.set].wear].label} (${SETS[tp.set].year}) · Art Skill ${artSkill()}`, W / 2, H * 0.84, { size: 12, color: '#c8cede', weight: 600 });
      return;
    }

    if (this.step === 'center') {
      drawCard(ctx, cx, cy, cw, ch, j.tpl, { blank: true });
      ctx.strokeStyle = '#3dffb0'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, cw * 0.05); ctx.stroke();
      ctx.setLineDash([]);
      const o = j.ov;
      ctx.save();
      ctx.translate(cx + o.dx, cy + o.dy);
      ctx.rotate(o.a);
      ctx.scale(o.s, o.s);
      drawCard(ctx, 0, 0, cw, ch, j.tpl, { alpha: 0.55, tint: '#ffd23d' });
      ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 2 / o.s;
      rr(ctx, -cw / 2, -ch / 2, cw, ch, cw * 0.05); ctx.stroke();
      if (hasUpg('art2')) {
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(0, -ch / 2); ctx.lineTo(0, ch / 2); ctx.moveTo(-cw / 2, 0); ctx.lineTo(cw / 2, 0); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      if (hasUpg('art2')) {
        ctx.strokeStyle = 'rgba(61,255,176,.5)'; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(cx, cy - ch / 2 - 10); ctx.lineTo(cx, cy + ch / 2 + 10); ctx.moveTo(cx - cw / 2 - 10, cy); ctx.lineTo(cx + cw / 2 + 10, cy); ctx.stroke();
        ctx.setLineDash([]);
      }
      const acc = this.accuracy();
      text(ctx, `ALIGNMENT ${acc}%`, W / 2, H * 0.07, { size: 18, weight: 800, color: acc >= 90 ? '#3dffb0' : acc >= 65 ? '#ffd23d' : '#ff3d6e' });
      return;
    }

    if (this.step === 'emboss') {
      drawCard(ctx, cx, cy, cw, ch, j.tpl);
      const n = Math.floor((j.fill / 100) * j.dots.length);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < n; i++) {
        const [u, v] = j.dots[i];
        ctx.fillRect(cx - cw / 2 + u * cw, cy - ch / 2 + v * ch, 1.6, 1.6);
      }
      const sh = ctx.createLinearGradient(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2);
      sh.addColorStop(0, 'rgba(255,255,255,0)');
      sh.addColorStop(0.5 + 0.3 * Math.sin(t / 600), `rgba(255,255,255,${j.fill / 400})`);
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh;
      rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, cw * 0.05); ctx.fill();
      if (j.tear) {
        ctx.strokeStyle = '#ff3d6e'; ctx.lineWidth = 3;
        ctx.beginPath();
        let x = cx + cw * 0.1, y = cy - ch / 2;
        ctx.moveTo(x, y);
        for (let i = 0; i < 8; i++) { x += cw * 0.05 * (i % 2 ? -1 : 1.4); y += ch * 0.06; ctx.lineTo(x, y); }
        ctx.stroke();
        text(ctx, 'TORN', cx, cy, { size: 30, weight: 900, color: '#ff3d6e' });
      }
      // density bar
      const bx = Math.min(W - 26, cx + cw / 2 + 14), by = cy - ch / 2, bh = ch;
      ctx.fillStyle = '#2a3140'; rr(ctx, bx, by, 14, bh, 7); ctx.fill();
      ctx.fillStyle = 'rgba(61,255,176,.35)'; ctx.fillRect(bx, by + bh * (1 - 0.92), 14, bh * 0.17);
      ctx.fillStyle = 'rgba(255,61,110,.35)'; ctx.fillRect(bx, by, 14, bh * 0.08);
      ctx.fillStyle = j.tear ? '#ff3d6e' : j.fill >= 75 && j.fill <= 92 ? '#3dffb0' : '#ffd23d';
      ctx.fillRect(bx + 3, by + bh * (1 - j.fill / 100), 8, bh * (j.fill / 100));
      text(ctx, `EMBOSS DENSITY ${Math.round(j.fill)}% · TEXTURE ${this.textureScore()}%`, W / 2, H * 0.07, { size: 15, weight: 800, color: '#ffd23d' });
      if (this.cursor) { ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('👍', this.cursor.x, this.cursor.y - 26); }
      return;
    }

    if (this.step === 'age') {
      drawCard(ctx, cx, cy, cw, ch, j.tpl);
      const seg = (2 * (cw + ch)) / NEDGE;
      for (let i = 0; i < NEDGE; i++) {
        const w = j.wear[i];
        if (w <= 0) continue;
        const pt = this.edgePoint(i);
        const th = 2 + w / 9; // whitening creeps inward as wear builds
        ctx.fillStyle = `rgba(250,246,234,${Math.min(0.95, 0.25 + w / 110)})`;
        if (pt.side === 't') ctx.fillRect(pt.x - seg / 2, pt.y, seg + 0.5, th);
        else if (pt.side === 'b') ctx.fillRect(pt.x - seg / 2, pt.y - th, seg + 0.5, th);
        else if (pt.side === 'l') ctx.fillRect(pt.x, pt.y - seg / 2, th, seg + 0.5);
        else ctx.fillRect(pt.x - th, pt.y - seg / 2, th, seg + 0.5);
      }
      const wear = this.wearPct(), tg = this.wearTarget();
      const ok = Math.abs(wear - tg.target) <= 8;
      const mx = cx - cw / 2, mw = cw, my = Math.min(H - 30, cy + ch / 2 + 16);
      ctx.fillStyle = '#2a3140'; rr(ctx, mx, my, mw, 10, 5); ctx.fill();
      ctx.fillStyle = 'rgba(61,255,176,.45)'; ctx.fillRect(mx + mw * ((tg.target - 8) / 100), my, mw * 0.16, 10);
      ctx.fillStyle = ok ? '#3dffb0' : '#ffd23d'; ctx.fillRect(mx + mw * (wear / 100) - 2, my - 5, 4, 20);
      text(ctx, `WEAR ${wear}% · TARGET ${tg.label.toUpperCase()} (${SETS[j.tpl.set].year})`, W / 2, H * 0.07, { size: 14, weight: 800, color: ok ? '#3dffb0' : '#ffd23d' });
      if (this.cursor) {
        ctx.fillStyle = 'rgba(255,210,61,.25)';
        ctx.beginPath(); ctx.arc(this.cursor.x, this.cursor.y, cw * 0.16, 0, 7); ctx.fill();
        ctx.font = '26px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧽', this.cursor.x, this.cursor.y);
      }
      return;
    }

    if (this.step === 'result') {
      const r = j.result;
      const col = r.grade >= 90 ? '#3dffb0' : r.grade >= 65 ? '#ffd23d' : '#ff3d6e';
      drawCard(ctx, cx, cy - ch * 0.04, cw * 0.8, ch * 0.8, { ...j.tpl, name: r.name }, { glow: col });
      if (r.slab) {
        ctx.strokeStyle = 'rgba(200,220,255,.8)'; ctx.lineWidth = 3;
        rr(ctx, cx - cw * 0.45, cy - ch * 0.5, cw * 0.9, ch * 0.92, 10); ctx.stroke();
      }
      text(ctx, `QUALITY GRADE ${r.grade}%`, W / 2, H * 0.06, { size: 20, weight: 900, color: col });
      text(ctx, `Align ${j.align} ×0.40 + Texture ${j.texture} ×0.35 + Art ${r.art} ×0.25 = ${r.base}%` + (r.agingFactor < 1 ? ` · aging ×${r.agingFactor.toFixed(2)}` : ''), W / 2, H * 0.115, { size: 10, color: '#c8cede', weight: 600 });
      const verdict = r.grade >= 90 ? ['Passes elite collector', '& grading house inspection.']
        : r.grade >= 65 ? ['Fools casual buyers & parents.', 'Collectors may get suspicious.']
        : ['Immediate failure. Selling this', 'triggers chargebacks & +25% heat.'];
      verdict.forEach((v, i) => text(ctx, v, W / 2, H * 0.8 + i * 17, { size: 13, color: col, weight: 700 }));
    }
  }

  controls(a) {
    if (this.step === 'select' || !this.job) {
      const n = this.templates().length;
      this.tpl();
      return `<div class="ctrl-row">
        <button class="btn small" data-a="${a(() => { this.ti--; this.api.refresh(); })}">◀</button>
        <span class="muted small center grow">${this.ti + 1}/${n} · 📄 ${S.blanks} blanks</span>
        <button class="btn small" data-a="${a(() => { this.ti++; this.api.refresh(); })}">▶</button>
        <button class="btn mint" ${S.blanks ? '' : 'disabled'} data-a="${a(() => this.start())}">Start forgery</button></div>`;
    }
    if (this.step === 'center') {
      return `<div class="ctrl-row">
        <button class="btn small" aria-label="Shrink" data-a="${a(() => this.nudge(-0.01, 0))}">－</button>
        <button class="btn small" aria-label="Grow" data-a="${a(() => this.nudge(0.01, 0))}">＋</button>
        <button class="btn small" aria-label="Rotate left" data-a="${a(() => this.nudge(0, -0.01))}">⟲</button>
        <button class="btn small" aria-label="Rotate right" data-a="${a(() => this.nudge(0, 0.01))}">⟳</button>
        <button class="btn mint grow" data-a="${a(() => { this.job.align = this.accuracy(); this.go('emboss'); })}">Lock foil ✓</button></div>`;
    }
    if (this.step === 'emboss') {
      return `<div class="ctrl-row"><span class="muted small grow">Target: 75–92% density.</span>
        <button class="btn mint" data-a="${a(() => { this.job.texture = this.textureScore(); this.go('age'); })}">Finish emboss ✓</button></div>`;
    }
    if (this.step === 'age') {
      return `<div class="ctrl-row"><span class="muted small grow">Sponge the edges only.</span>
        <button class="btn mint" data-a="${a(() => this.finish())}">Finish aging ✓</button></div>`;
    }
    return `<div class="ctrl-row"><span class="muted small grow">🖨️ ${S.forgeries.length} forgeries in stock.</span>
      <button class="btn mint" data-a="${a(() => { this.job = null; this.go('select'); })}">Forge another</button></div>`;
  }
}

