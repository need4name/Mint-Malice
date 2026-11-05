// ✍️ Shill reviews: build a fake 5-star review from word tiles. Over-the-top praise reads
// as fake; specific, slightly imperfect details read as real.
import { play, shuffle } from './overlay.js';
import { esc } from '../ui.js';
import { sfx } from '../audio.js';

// k: natural (+), hype (−), flaw (one helps), detail (+)
const TILES = [
  { t: 'Friendly staff', k: 'natural' }, { t: 'fair prices.', k: 'natural' }, { t: 'My son', k: 'detail' },
  { t: 'loved his packs.', k: 'natural' }, { t: 'Will be back.', k: 'natural' }, { t: 'Quick service,', k: 'natural' },
  { t: 'a bit cramped', k: 'flaw' }, { t: 'parking is awful', k: 'flaw' }, { t: 'but', k: 'glue' }, { t: 'and', k: 'glue' },
  { t: 'pulled a Yellow Rat!', k: 'detail' }, { t: 'on a Tuesday', k: 'detail' },
  { t: 'BEST SHOP EVER!!!', k: 'hype' }, { t: 'AMAZING', k: 'hype' }, { t: '10/10 life-changing', k: 'hype' }, { t: 'TOTALLY LEGIT', k: 'hype' },
];
const PRO = [{ t: 'Owner remembered my name.', k: 'detail' }, { t: 'Honest about card condition.', k: 'natural' }];

export function scoreReview(words) {
  const n = words.length;
  if (n < 3) return 0;
  const c = k => words.filter(w => w.k === k).length;
  let s = 0.25 + c('natural') * 0.12 + Math.min(2, c('detail')) * 0.12 + (c('flaw') === 1 ? 0.18 : c('flaw') > 1 ? -0.1 : 0) - c('hype') * 0.25;
  if (n > 10) s -= (n - 10) * 0.06;
  if (n >= 5 && n <= 9) s += 0.1;
  return Math.max(0, Math.min(1, s));
}

// Resolves a score 0–1 (or null if abandoned).
export function writeReview({ pro = false } = {}) {
  const bank = shuffle(pro ? [...TILES, ...PRO] : TILES);
  return play({ title: '✍️ Write a shill review', sub: 'Tap tiles to build a 5-star review. Gushing reads fake; specific details and one small complaint read real.', canvas: false }, (g, done) => {
    const words = [];
    const render = () => {
      g.dom.innerHTML = `<div class="review">
        <div class="review-card"><div class="stars-5">★★★★★</div><p>${words.length ? words.map((w, i) => `<button class="placed" data-i="${i}">${esc(w.t)}</button>`).join(' ') : '<span class="muted">Your review…</span>'}</p></div>
        <div class="tiles">${bank.map((w, i) => `<button class="tile" data-b="${i}" ${words.includes(w) ? 'disabled' : ''}>${esc(w.t)}</button>`).join('')}</div></div>`;
      g.dom.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', () => { sfx.tap(); words.push(bank[+b.dataset.b]); render(); }));
      g.dom.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { sfx.tap(); words.splice(+b.dataset.i, 1); render(); }));
    };
    render();
    g.buttons([
      { label: 'Post review', kind: 'mint', onClick: () => done(scoreReview(words)) },
      { label: 'Not today', kind: 'ghost', onClick: () => done(null) },
    ]);
  });
}
