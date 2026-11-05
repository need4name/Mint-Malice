// 🗣️ Gaslighting duel: three quick-fire accusations, a timer per round, a suspicion meter.
// Contradicting an earlier answer makes it worse. Finish below the line to keep the sale.
import { play, shuffle } from './overlay.js';
import { esc } from '../ui.js';
import { sfx } from '../audio.js';

// s: change to suspicion. tag/conflicts: contradicting a story you already told costs extra.
const BANK = {
  reseal: [
    { q: 'The seal is all crinkled. Was this opened?', a: [
      { t: 'Factory crimps vary between print runs.', s: -22, tag: 'factory' },
      { t: 'The delivery van must have crushed it.', s: -10, tag: 'transit' },
      { t: 'I opened it to check for damage.', s: 30, tag: 'opened' }] },
    { q: 'It feels lighter than my other packs.', a: [
      { t: 'Packs vary by a gram. It’s printed on the box.', s: -20, tag: 'factory' },
      { t: 'Humidity. Cardboard dries out.', s: -8 },
      { t: 'Feels fine to me.', s: 6 }] },
    { q: 'Why does it smell like glue?', a: [
      { t: 'New stock. Fresh off the pallet.', s: -18, tag: 'factory', conflicts: ['transit'] },
      { t: 'We had the shelves varnished.', s: -12, tag: 'instore' },
      { t: 'What glue? There’s no glue.', s: 15 }] },
    { q: 'Did you weigh these before selling them?', a: [
      { t: 'Never. That would be unethical.', s: -15, conflicts: ['opened'] },
      { t: 'Only to check stock levels.', s: 8 },
      { t: 'Everyone weighs packs, mate.', s: 25 }] },
  ],
  forgery: [
    { q: 'The holo pattern looks… printed.', a: [
      { t: 'It’s a known Misprint Error. Ultra rare.', s: -22, tag: 'misprint' },
      { t: 'That’s the lighting in here.', s: -8, tag: 'light' },
      { t: 'All holos look like that now.', s: 14 }] },
    { q: 'The font on the name looks off.', a: [
      { t: 'Early print run. They fixed it later.', s: -20, tag: 'early', conflicts: ['reprint'] },
      { t: 'You’re thinking of the reprint.', s: -12, tag: 'reprint', conflicts: ['early'] },
      { t: 'Fonts don’t matter, it’s cardboard.', s: 20 }] },
    { q: 'Can I see it under a UV light?', a: [
      { t: 'Sure, but UV damages vintage ink.', s: -18 },
      { t: 'Our UV lamp is broken.', s: 10, conflicts: ['light'] },
      { t: 'Why? Don’t you trust me?', s: 22 }] },
    { q: 'The back is a slightly different blue.', a: [
      { t: 'Sun fading. It sat in a window for years.', s: -16, conflicts: ['early'] },
      { t: 'Misprints have colour shifts too.', s: -14, conflicts: ['light'], tag: 'misprint' },
      { t: 'Colour-blind, are we?', s: 25 }] },
  ],
  trim: [
    { q: 'This card looks a bit… small.', a: [
      { t: 'Cards from that print run were cut tight.', s: -20, tag: 'factory' },
      { t: 'It’s the sleeve. Optical illusion.', s: -8 },
      { t: 'I may have tidied the edges.', s: 30, tag: 'cut' }] },
    { q: 'The edges are suspiciously sharp.', a: [
      { t: 'It was pulled fresh and sleeved instantly.', s: -18, conflicts: ['cut'] },
      { t: 'I keep it in a climate-controlled safe.', s: -10 },
      { t: 'Sharp edges are a good thing, mate.', s: 15 }] },
    { q: 'Can I measure it with my calipers?', a: [
      { t: 'Of course. Factory tolerance is ±1mm.', s: -16, tag: 'factory' },
      { t: 'Calipers scratch the surface.', s: 4 },
      { t: 'Nobody carries calipers. Who are you?', s: 22 }] },
  ],
  mystery: [
    { q: 'This is just bulk commons!', a: [
      { t: 'Curated commons. Hand-picked for playability.', s: -18 },
      { t: 'The rare is hidden in the bottom layer.', s: -10, tag: 'hidden' },
      { t: 'It says mystery, not good.', s: 22 }] },
    { q: 'Why on earth was this $60?', a: [
      { t: 'Limited stock. We only made five.', s: -16, tag: 'limited' },
      { t: 'Inflation, sadly.', s: -6 },
      { t: 'Because you paid it.', s: 30 }] },
    { q: 'I didn’t find any rare in here.', a: [
      { t: 'Let me look… must be the box I kept back.', s: -12, conflicts: ['hidden'] },
      { t: 'Some boxes are rare-free. That’s the thrill.', s: -15 },
      { t: 'You must have dropped it.', s: 18 }] },
  ],
};
const PRO = { t: 'Look, I’ve run this shop 20 years. Want a free sleeve?', s: -30 };

// Resolves 'saved', 'failed' or 'refund'.
export function duel({ name, kind, start = 55, pro = false }) {
  const rounds = shuffle(BANK[kind] || BANK.reseal).slice(0, 3);
  return play({ title: '🗣️ Talk your way out', sub: `${esc(name)} is suspicious. Answer fast and keep your story straight.`, canvas: false }, (g, done) => {
    let sus = start, round = 0, deadline = 0, over = false;
    const told = new Set();
    const LIMIT = 5;

    const finish = () => done(sus < 45 ? 'saved' : 'failed');
    const answer = a => {
      let delta = a.s;
      if (a.conflicts?.some(c => told.has(c))) { delta += 30; flash('“That’s not what you said before!”'); }
      if (a.tag) told.add(a.tag);
      sus = Math.max(0, Math.min(100, sus + delta));
      if (delta < 0) sfx.success(); else sfx.fail();
      next();
    };
    const flash = msg => { const f = g.dom.querySelector('.duel-flash'); if (f) { f.textContent = msg; f.classList.add('on'); } };
    const next = () => {
      round++;
      if (round > rounds.length || sus >= 100) { over = true; setTimeout(finish, 900); draw(true); return; }
      deadline = performance.now() + LIMIT * 1000;
      draw();
    };
    const draw = (end = false) => {
      const r = rounds[round - 1];
      const answers = end ? [] : shuffle(pro ? [...r.a, PRO] : r.a);
      g.dom.innerHTML = `<div class="duel">
        <div class="meter"><span>Suspicion</span><div class="bar"><i style="width:${sus}%"></i><b style="left:45%"></b></div><em>${Math.round(sus)}%</em></div>
        ${end ? `<p class="duel-q">${sus < 45 ? '😮‍💨 They buy it.' : '😤 They’re not having it.'}</p>`
          : `<p class="duel-round">Round ${round}/${rounds.length}</p><p class="duel-q">“${esc(r.q)}”</p>
            <div class="timer"><i></i></div>
            <div class="duel-a">${answers.map((a, i) => `<button class="btn" data-i="${i}">“${esc(a.t)}”</button>`).join('')}</div>`}
        <p class="duel-flash"></p></div>`;
      g.dom.querySelectorAll('.duel-a button').forEach(b => b.addEventListener('click', () => { sfx.tap(); answer(answers[+b.dataset.i]); }));
    };
    g.buttons([{ label: 'Apologise & refund', kind: 'ghost', onClick: () => done('refund') }]);
    next();
    g.loop(() => {
      if (over) return;
      const left = (deadline - performance.now()) / 1000;
      const bar = g.dom.querySelector('.timer i');
      if (bar) bar.style.width = `${Math.max(0, left / LIMIT) * 100}%`;
      if (left <= 0) { flash('Too slow…'); sus = Math.min(100, sus + 20); sfx.fail(); next(); }
    });
  });
}
