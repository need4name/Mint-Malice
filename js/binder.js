// 💎 Binder: your singles and forgeries. Trim centering, or send cards off for grading.
// Grades come back after a few days; a slab multiplies value. Graders catch trims and fakes.
import { S, changed, spend, addHeat, uid, worstShare, roll, clamp, hasUpg, worth, pick } from './state.js';
import { RARITY } from './data.js';
import { trimCard, UNDERSIZED } from './games/trim.js';
import { toast, modal, money, esc } from './ui.js';
import { sfx } from './audio.js';

const TIERS = {
  economy: { label: 'Economy', cost: 15, days: 3 },
  express: { label: 'Express', cost: 45, days: 1 },
};

const centering = c => (c.lr == null ? '' : `${Math.max(c.lr, 100 - c.lr)}/${Math.min(c.lr, 100 - c.lr)}`);

export function binderHtml(a) {
  const rows = [];
  for (const c of S.singles) {
    rows.push(`<li><div class="grow"><b>${esc(c.name)}</b><small>${RARITY[c.rarity]?.label || 'Holo'} · ${c.gsa ? (c.gsa === 'A' ? 'GSA Altered' : `GSA ${c.gsa}`) : `centering ${centering(c)}`}${c.trimmed ? ` · trimmed ${c.trimmed}mm${c.trimmed > UNDERSIZED ? ' (undersized!)' : ''}` : ''} · ${money(worth(c))}</small></div>
      ${c.gsa ? '' : `<button class="btn small" data-a="${a(() => trim(c))}">✂️ Trim</button><button class="btn small" data-a="${a(() => submit(c, 'single'))}">🏅 Grade</button>`}</li>`);
  }
  for (const f of S.forgeries) {
    rows.push(`<li class="fake"><div class="grow"><b>${esc(f.name)}</b><small>forgery · grade ${f.grade}% · ${money(worth(f))}</small></div>
      ${f.gsa || f.slab ? '' : `<button class="btn small" data-a="${a(() => submit(f, 'forgery'))}">🏅 Sneak in</button>`}</li>`);
  }
  const away = S.grading.map(g => `<li><span>🏅 ${esc(g.card.name)}</span><i>${g.back <= S.day + 1 ? 'tomorrow' : `day ${g.back}`}</i></li>`).join('');
  if (!rows.length && !away) return '';
  return `<h3>💎 Binder</h3>
    ${rows.length ? `<ul class="binder">${rows.join('')}</ul>` : ''}
    ${away ? `<h3>🏅 At the grader</h3><ul class="queue incoming">${away}</ul>` : ''}`;
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
