// 💎 Binder: your singles and forgeries. Trim centering, or send cards off for grading.
// Grades come back after a few days; a slab multiplies value. Graders catch trims and fakes.
import { S, bus, changed, spend, addHeat, uid, worstShare, roll, clamp, hasUpg, worth, pick, cardDef, variantOf } from './state.js';
import { RARITY, SETS, SET_ORDER } from './data.js';
import { cardImage } from './cardface.js';
import { trimCard, UNDERSIZED } from './games/trim.js';
import { toast, modal, money, esc } from './ui.js';
import { sfx } from './audio.js';

const TIERS = {
  economy: { label: 'Economy', cost: 15, days: 3 },
  express: { label: 'Express', cost: 45, days: 1 },
};

const centering = c => (c.lr == null ? '' : `${Math.max(c.lr, 100 - c.lr)}/${Math.min(c.lr, 100 - c.lr)}`);

const thumb = (c, a) => `<button class="thumb-btn" aria-label="View ${esc(c.name)}" data-a="${a(() => view(c))}"><img class="thumb" src="${cardImage(c, 44)}" alt=""></button>`;

export function binderHtml(a) {
  markDex();
  const rows = [];
  for (const c of S.singles) {
    rows.push(`<li>${thumb(c, a)}<div class="grow"><b>${esc(c.name)}</b><small>${RARITY[c.rarity]?.label || 'Holo'} · ${c.gsa ? (c.gsa === 'A' ? 'GSA Altered' : `GSA ${c.gsa}`) : `centering ${centering(c)}`}${c.trimmed ? ` · trimmed ${c.trimmed}mm${c.trimmed > UNDERSIZED ? ' (undersized!)' : ''}` : ''} · ${money(worth(c))}</small></div>
      ${c.gsa ? '' : `<button class="btn small" data-a="${a(() => trim(c))}">✂️ Trim</button><button class="btn small" data-a="${a(() => submit(c, 'single'))}">🏅 Grade</button>`}</li>`);
  }
  for (const f of S.forgeries) {
    rows.push(`<li class="fake">${thumb(f, a)}<div class="grow"><b>${esc(f.name)}</b><small>forgery · grade ${f.grade}% · ${money(worth(f))}</small></div>
      ${f.gsa || f.slab ? '' : `<button class="btn small" data-a="${a(() => submit(f, 'forgery'))}">🏅 Sneak in</button>`}</li>`);
  }
  const away = S.grading.map(g => `<li><span>🏅 ${esc(g.card.name)}</span><i>${g.back <= S.day + 1 ? 'tomorrow' : `day ${g.back}`}</i></li>`).join('');
  const total = SET_ORDER.reduce((t, s) => t + SETS[s].cards.length, 0);
  return `<div class="binder-head"><h3>💎 Binder</h3><button class="btn small" data-a="${a(cardIndex)}">📖 Card index ${Object.keys(S.dex).length}/${total}</button></div>
    ${rows.length ? `<ul class="binder">${rows.join('')}</ul>` : '<p class="muted small">No cards yet. Crack heavy packs on the Bench to pull some.</p>'}
    ${away ? `<h3>🏅 At the grader</h3><ul class="queue incoming">${away}</ul>` : ''}`;
}

// Mark every card you hold as collected in the index.
function markDex() {
  for (const c of S.singles) {
    const def = cardDef(c);
    if (def) S.dex[`${c.set}:${def.name}`] = true;
  }
}
export function trackDex() { bus.on('change', markDex); markDex(); }

// A big view of one card.
function view(c) {
  const def = cardDef(c);
  const v = variantOf(c);
  const body = document.createElement('div');
  body.className = 'card-view';
  body.innerHTML = `<img src="${cardImage(c, 260)}" alt="${esc(c.name)}">
    <ul class="stats">
      <li><span>Set</span><b>${esc(SETS[c.set].name)}</b></li>
      <li><span>Rarity</span><b>${RARITY[c.rarity]?.label || 'Common'}${v ? ` · ${esc(v)}` : ''}</b></li>
      ${c.grade ? `<li><span>Forgery grade</span><b class="bad">${c.grade}%</b></li>` : ''}
      ${c.lr != null && !c.gsa ? `<li><span>Centering</span><b>${centering(c)}</b></li>` : ''}
      <li><span>Worth today</span><b class="good">${money(worth(c))}</b></li>
    </ul>`;
  if (!def) body.querySelector('ul').insertAdjacentHTML('beforeend', '<li><span>Note</span><b>Retired card</b></li>');
  modal({ title: c.name, body, buttons: [{ label: 'Close', value: true }] });
}

// Every card in every set; ones you've never owned show as card backs.
function cardIndex() {
  const body = document.createElement('div');
  body.className = 'dex';
  let cur = SET_ORDER[0];
  const draw = () => {
    const set = SETS[cur];
    const got = set.cards.filter(c => S.dex[`${cur}:${c.name}`]).length;
    body.innerHTML = `<div class="seg wrap">${SET_ORDER.map(id => `<button class="${id === cur ? 'on' : ''}" data-set="${id}">${SETS[id].short}</button>`).join('')}</div>
      <p class="muted small">${esc(set.name)} (${set.year}) · ${got}/${set.cards.length} collected${set.unlock > S.level ? ` · stocked from Store Level ${set.unlock}` : ''}</p>
      <div class="dex-grid">${set.cards.map(d => {
        const own = S.dex[`${cur}:${d.name}`];
        const card = { set: cur, base: d.name, name: d.name, rarity: d.rarity };
        return `<figure class="${own ? '' : 'unknown'}"><img src="${cardImage(card, 72, { unknown: !own })}" alt=""><figcaption>${own ? esc(d.name) : '???'}</figcaption></figure>`;
      }).join('')}</div>`;
    body.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => { sfx.tap(); cur = b.dataset.set; draw(); }));
  };
  draw();
  modal({ title: '📖 Card index', body, buttons: [{ label: 'Close', value: true }] });
}

async function trim(card) {
  if (card.lr == null) { card.lr = 58; card.tb = 54; }
  const r = await trimCard(card);
  if (!r) return;
  Object.assign(card, r);
  changed();
  toast(`Centering now ${centering(card)}. Worth ${money(worth(card))}.${card.trimmed > UNDERSIZED ? ' It’s undersized: experts will measure it.' : ''}`, card.trimmed > UNDERSIZED ? 'bad' : 'good');
}

async function submit(card, kind) {
  const tier = await modal({
    title: kind === 'forgery' ? '🏅 Sneak a fake into a submission?' : '🏅 Send for grading',
    body: kind === 'forgery'
      ? `<p>Hide <b>${esc(card.name)}</b> (grade ${card.grade}%) among real cards. If it passes, it comes back in an official slab and sells like the real thing. If not, it’s confiscated and reported.</p>`
      : `<p>A slab’s grade multiplies <b>${esc(card.name)}</b>’s value: GSA 10 is worth 3×. Good centering grades higher. Trimmed cards may come back “Altered”.</p>`,
    buttons: [
      ...Object.entries(TIERS).map(([k, t]) => ({ label: `${t.label} · ${money(t.cost)} · back in ${t.days} day${t.days > 1 ? 's' : ''}`, value: k, kind: 'mint' })),
      { label: 'Cancel', value: null, kind: 'ghost' },
    ],
  });
  if (!tier) return;
  if (!spend(TIERS[tier].cost)) { toast('Not enough cash!', 'bad'); return; }
  if (kind === 'single') S.singles = S.singles.filter(x => x.id !== card.id);
  else S.forgeries = S.forgeries.filter(x => x.id !== card.id);
  S.grading.push({ id: uid(), card, kind, tier, back: S.day + TIERS[tier].days });
  sfx.cash();
  toast(`Sent off. Back in ${TIERS[tier].days} day${TIERS[tier].days > 1 ? 's' : ''}.`, 'info');
  changed();
}

// Overnight: returns report lines for submissions that are back.
export function receiveGrading() {
  const due = S.grading.filter(g => g.back <= S.day);
  S.grading = S.grading.filter(g => g.back > S.day);
  const lines = [];
  for (const { card, kind } of due) {
    if (kind === 'single') {
      if (card.trimmed && roll(card.trimmed > UNDERSIZED ? 0.85 : 0.35)) {
        card.gsa = 'A';
        card.name = `${card.name} [GSA Altered]`;
        lines.push({ bad: true, text: `${card.name}: the grader measured it. Altered, worth half.` });
      } else {
        const worst = card.lr == null ? 57 : worstShare(card);
        const grade = clamp(Math.round(10 - Math.max(0, worst - 52) / 3.5 - (roll(0.15) ? 1 : 0)), 5, 10);
        card.gsa = grade;
        card.name = `${card.name} [GSA ${grade}]`;
        lines.push({ good: grade >= 9, text: `${card.name} came back a GSA ${grade}. Now worth ${money(worth(card))}.` });
      }
      S.singles.push(card);
    } else {
      const pass = (card.grade >= 90 ? 0.6 : card.grade >= 80 ? 0.3 : 0.06) + (hasUpg('hustle3') ? 0.2 : 0);
      if (roll(pass)) {
        card.gsa = pick([8, 9, 9, 10]);
        card.slab = true;
        card.name = `${card.name} [GSA ${card.gsa}]`;
        S.forgeries.push(card);
        lines.push({ good: true, text: `Your fake ${card.name} passed! Official slab, worth ${money(worth(card))}.` });
      } else {
        addHeat(10);
        lines.push({ bad: true, text: `The grader caught your fake ${card.name}. Confiscated and reported. +10% heat.` });
      }
    }
  }
  return lines;
}
