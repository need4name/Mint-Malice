// 🏪 Front Counter: customer queue, offers, gaslighting, trade-ins, supplier.
import {
  S, bus, changed, earn, spend, addHeat, heatTier, hasUpg, packsOf, removePacks,
  order, rollCard, worth, uid, pick, roll, rand, unlockedSets,
} from './state.js';
import { SETS, ARCH, SET_ORDER, LEVELS, RARITY } from './data.js';
import { toast, haptic, money, esc, actions, bindActions } from './ui.js';
import { sfx } from './audio.js';
import { resealRisk, forgeryRisk, comboRisk, gaslightChance, riskLabel, riskClass, trimRisk } from './rules.js';
import { haggle, haggleLimit } from './games/haggle.js';
import { kidPick } from './games/kidpick.js';
import { duel } from './games/duel.js';
import { distraction } from './games/distract.js';
import { binderHtml } from './binder.js';
import { swapWheel } from './swap.js';

let root;
let busy = false;

export function initShop(el) {
  root = el;
  bus.on('change', () => { if (root.classList.contains('active')) render(); });
}
export const showShop = () => render();

// ---- Customers -------------------------------------------------------------
function weighted(w) {
  const entries = Object.entries(w);
  let r = Math.random() * entries.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of entries) { r -= v; if (r <= 0) return k; }
  return entries[0][0];
}

function genCustomer() {
  const set = pick(unlockedSets());
  if (heatTier() >= 2 && S.scams > 0 && Math.random() < 0.22) {
    const arch = pick(['parent', 'timmy', 'sweat']);
    return { id: uid(), kind: 'refund', arch, set, name: pick(ARCH[arch].names), amount: Math.round(rand(12, 45) + S.level * 6) };
  }
  const arch = weighted({
    timmy: 4, parent: 3, sweat: 1 + S.level * 0.6,
    streamer: S.level >= 2 ? 0.3 + S.level * 0.35 : 0.15,
  });
  const name = pick(ARCH[arch].names);
  if ((arch === 'sweat' && roll(0.3)) || (arch === 'timmy' && roll(0.15))) {
    return { id: uid(), kind: 'trade', arch, set, name, card: rollCard(set) };
  }
  const want = arch === 'timmy' ? 'pack'
    : arch === 'parent' ? (roll(0.6) ? 'mystery' : 'pack')
    : arch === 'sweat' ? 'single' : 'box';
  const qty = want === 'pack' ? 1 + Math.floor(Math.random() * (arch === 'timmy' ? 3 : 2)) : 1;
  return { id: uid(), kind: 'buy', arch, set, name, want, qty };
}

export function genCustomers() {
  const base = 5 + S.level;
  const n = heatTier() >= 3 ? Math.ceil(base / 2) : base; // exposé halves foot traffic
  return Array.from({ length: n }, genCustomer);
}

function line(c) {
  const set = SETS[c.set].name;
  if (c.kind === 'refund') return `"That pack you sold me was RESEALED! I want my ${money(c.amount)} back!"`;
  if (c.kind === 'trade') return `"Wanna trade in my ${c.card.name}. What'll you give me for it?"`;
  return {
    pack: `"Can I get ${c.qty} ${set} pack${c.qty > 1 ? 's' : ''}?"`,
    mystery: `"Something for a birthday present? One of those mystery boxes?"`,
    single: `"Got any ${set} chase singles? Graded-quality only."`,
    box: `"Need a sealed ${set} box for tonight's stream. Ten packs."`,
  }[c.want];
}

const avg = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

// ---- Sale resolution -------------------------------------------------------
async function caught(c, heat, why, kind = 'reseal') {
  sfx.fail();
  haptic([60, 40, 60], 'bad');
  S.totals.caught++;
  toast(`${c.name} ${why}`, 'bad', 3500);
  const pro = c.arch === 'sweat' || c.arch === 'streamer';
  const res = await duel({ name: c.name, kind, start: pro ? 62 : 52, pro: hasUpg('hustle1') });
  if (res === 'refund') {
    addHeat(Math.round(heat / 2));
    toast(`Refunded. They'll still tell their mates. +${Math.round(heat / 2)}% heat`, 'bad');
    return false;
  }
  if (res === 'saved') {
    addHeat(3);
    sfx.success();
    toast('Gaslit successfully. The sale stands. +3% heat', 'good');
    return true;
  }
  addHeat(heat);
  toast(`${ARCH[c.arch].short} storms out & review-bombs you! +${heat}% heat`, 'bad');
  return false;
}

// Haggling sets a multiplier for the next sale.
let haggleMult = 1;

async function attempt(c, { price, risk, heat, why, scam, onSale, kind }) {
  price *= haggleMult;
  if (risk > 0 && roll(risk)) {
    const saved = await caught(c, heat, why, kind);
    if (!saved) return true;
  }
  onSale();
  if (scam) { S.scams++; S.today.scams++; S.totals.scams++; }
  S.today.served++;
  const got = earn(price);
  sfx.cash();
  haptic(15);
  toast(`Sold for ${money(got)}`, 'good');
  return true;
}

// ---- Offers ----------------------------------------------------------------
// Each offer: { label, sub, price, risk, scam, disabled, run: async () => doneWithCustomer }
function offersFor(c) {
  const set = SETS[c.set];
  const base = ARCH[c.arch].risk;
  const out = [];

  if (c.kind === 'refund') {
    const p = gaslightChance(c.arch, 'factory');
    out.push({ label: 'Pay the refund', price: -c.amount, risk: 0, run: async () => {
      if (!spend(c.amount)) { toast('Not enough cash!', 'bad'); return false; }
      S.scams = Math.max(0, S.scams - 1);
      addHeat(-3);
      toast('Refunded. Crisis contained. -3% heat', 'info');
      return true;
    } });
    out.push({ label: 'Gaslight: "That\'s just factory variance."', price: 0, risk: 1 - p, scam: true, run: async () => {
      if (roll(p)) { sfx.success(); toast('They leave confused. Refund dodged.', 'good'); }
      else { addHeat(10); sfx.fail(); haptic([60, 40, 60], 'bad'); toast('They post the receipt online. +10% heat', 'bad'); }
      return true;
    } });
    out.push({ label: 'Refuse: "No receipt, no refund."', price: 0, risk: 1, riskText: '+8% heat', scam: true, run: async () => {
      addHeat(8);
      toast('They leave a 1-star rant. +8% heat', 'bad');
      return true;
    } });
    return out;
  }

  if (c.kind === 'trade') {
    const fair = Math.round(worth(c.card) * 0.6);
    out.push({ label: `Buy it honestly`, sub: '60% of value', price: -fair, risk: 0, run: async () => {
      if (!spend(fair)) { toast('Not enough cash!', 'bad'); return false; }
      S.singles.push({ id: uid(), ...c.card });
      changed();
      toast(`Bought ${c.card.name}.`, 'info');
      return true;
    } });
    const fakes = [...S.forgeries].sort((a, b) => (a.set === c.set ? -1 : 1) - (b.set === c.set ? -1 : 1) || a.grade - b.grade);
    out.push({
      label: 'Sleight-of-Hand Swap 🤲', sub: fakes.length ? `hand back a replica (${fakes.length} in stock)` : 'need a forgery from the Bench',
      price: worth(c.card), risk: -1, riskText: 'Timing game', scam: true, disabled: !fakes.length,
      run: async () => {
        const bonus = await distraction();
        const arcDeg = 34 + bonus + (hasUpg('hustle1') ? 8 : 0) + (hasUpg('hustle3') ? 8 : 0);
        const ok = await swapWheel({ speed: c.arch === 'sweat' ? 4.4 : 3.2, arcDeg });
        const fake = fakes[0];
        S.forgeries = S.forgeries.filter(f => f.id !== fake.id);
        if (ok) {
          S.singles.push({ id: uid(), ...c.card });
          S.scams++; S.today.scams++; S.totals.scams++;
          changed();
          toast(`Swapped! Genuine ${c.card.name} pocketed (${money(worth(c.card))}).`, 'good');
        } else {
          addHeat(35);
          toast('Caught red-handed! Review bomb incoming. +35% heat', 'bad');
        }
        return true;
      },
    });
    return out;
  }

  if (c.want === 'pack') {
    const cats = [['sealed', 'Sealed (unweighed)'], ['dud', 'Weighed dud 🤫'], ['heavy', 'Heavy pack (has a hit!)'], ['reseal', 'Resealed pack']];
    for (const [cat, label] of cats) {
      const list = packsOf(c.set, cat);
      if (list.length < c.qty) continue;
      if (cat === 'reseal') list.sort((a, b) => b.crimp - a.crimp);
      const chosen = list.slice(0, c.qty);
      const price = set.packPrice * c.qty * (c.arch === 'parent' ? 1.15 : 1);
      const risk = cat === 'reseal' ? comboRisk(chosen.map(p => resealRisk(base, p.crimp, p.short))) : 0;
      const sub = cat === 'reseal' ? `crimp ${Math.round(avg(chosen.map(p => p.crimp)))}%`
        : cat === 'dud' ? 'technically legal' : cat === 'heavy' ? 'giving away a hit' : '';
      out.push({ label: `${c.qty}× ${label}`, sub, price, risk, scam: cat === 'reseal', run: async () => {
        // Kids sometimes insist on picking their own pack, right next to your heavy stock.
        const heavy = packsOf(c.set, 'heavy');
        if (c.arch === 'timmy' && cat !== 'heavy' && heavy.length && !c.tut && roll(0.4)) {
          const res = await kidPick({ set: c.set });
          if (res === 'caught') {
            addHeat(8);
            toast('The kid saw you swap packs and runs to tell their mum. +8% heat', 'bad');
            return true;
          }
          if (res === 'lost') {
            removePacks([heavy[0]]);
            const got = earn(price * haggleMult);
            S.today.served++;
            addHeat(-2);
            toast(`The kid grabbed your heavy pack and pulled a hit! ${money(got)}, free hype. -2% heat`, 'info');
            return true;
          }
          toast('The kid picked a dud. Phew.', 'good');
        }
        return attempt(c, {
          price, risk, heat: c.arch === 'timmy' ? 6 : 10, scam: cat === 'reseal', kind: 'reseal',
          why: 'turns the pack over. "Why is the seal all crinkly?!"',
          onSale: () => {
            removePacks(chosen);
            if (cat === 'heavy') { addHeat(-2); toast('They pulled a holo at the counter! Free hype. -2% heat', 'good'); }
          },
        });
      } });
    }
  }

  if (c.want === 'mystery') {
    const ok = S.commons >= 12;
    const tiers = [
      ['Fair price', 18, 0, false],
      ['Artificial markup', 38, base, true],
      ['"LIMITED STOCK!" pitch', 60, Math.min(0.95, base * 2.5), true],
    ];
    for (const [label, price, risk, scam] of tiers) {
      out.push({ label: `Mystery box · ${label}`, sub: ok ? '12 bulk commons' : 'need 12 bulk commons', price, risk, scam, disabled: !ok, run: () => attempt(c, {
        price, risk, heat: 8, scam, kind: 'mystery',
        why: 'peeks inside. "This is twelve bulk commons. For HOW much?"',
        onSale: () => { S.commons -= 12; },
      }) });
    }
  }

  if (c.want === 'single') {
    const real = S.singles.filter(s => s.set === c.set).sort((a, b) => worth(b) - worth(a)).slice(0, 3);
    for (const s of real) {
      const price = worth(s) * 1.15;
      const risk = trimRisk(base, s);
      out.push({ label: s.name, sub: `${s.gsa ? `GSA ${s.gsa} · ` : ''}${RARITY[s.rarity]?.label || 'Holo'} · ${s.trimmed ? 'trimmed' : 'genuine'}`, price, risk, scam: risk > 0, run: () => attempt(c, {
        price, risk, heat: 12, why: 'pulls out a ruler. "This card has been trimmed!"', scam: risk > 0, kind: 'trim',
        onSale: () => { S.singles = S.singles.filter(x => x.id !== s.id); },
      }) });
    }
    const fakes = S.forgeries.filter(f => f.set === c.set).sort((a, b) => b.grade - a.grade).slice(0, 4);
    for (const f of fakes) {
      const price = worth(f) * 1.15;
      const risk = forgeryRisk(base, f.grade, f.slab);
      out.push({ label: f.name, sub: `forgery · grade ${f.grade}%${f.slab ? ' · slabbed' : ''}`, price, risk, scam: true, run: async () => {
        if (f.grade < 65) {
          S.forgeries = S.forgeries.filter(x => x.id !== f.id);
          S.totals.caught++;
          addHeat(25);
          sfx.fail(); haptic([80, 40, 80], 'bad');
          toast('Obvious fake! Instant chargeback & the card is confiscated. +25% heat', 'bad');
          return true;
        }
        return attempt(c, {
          price, risk, heat: 20, scam: true, kind: 'forgery',
          why: 'squints through a loupe. "The holo pattern is… wrong. Is this fake?"',
          onSale: () => { S.forgeries = S.forgeries.filter(x => x.id !== f.id); },
        });
      } });
    }
  }

  if (c.want === 'box') {
    const price = set.packPrice * 10 * 1.5;
    const pool = cats => cats.flatMap(cat => packsOf(c.set, cat));
    const build = (label, cats, scam) => {
      const chosen = pool(cats).slice(0, 10);
      if (chosen.length < 10) return;
      const reseals = chosen.filter(p => p.resealed);
      const duds = chosen.filter(p => p.resealed || p.sorted === 'dud').length;
      let risk = comboRisk(reseals.map(p => resealRisk(base * 0.35, p.crimp, p.short)));
      if (duds >= 8) risk = comboRisk([risk, 0.3]); // a box with no hits looks searched
      out.push({ label, sub: scam ? `${reseals.length} resealed, ${duds} duds` : 'heavy & unweighed first', price, risk, scam, run: () => attempt(c, {
        price, risk, heat: 30, scam, kind: 'reseal',
        why: 'rips the box live on stream. Chat: "BRO THESE ARE RESEALED 💀" — a YouTube exposé drops.',
        onSale: () => {
          removePacks(chosen);
          const pulled = chosen.filter(p => !p.opened && p.hit).length;
          if (pulled >= 2) { addHeat(-3); toast(`Stream pulled ${pulled} hits! Legit-shop vibes. -3% heat`, 'good'); }
        },
      }) });
    };
    build('Spiked box 😈', ['reseal', 'dud', 'sealed', 'heavy'], true);
    build('Honest box', ['heavy', 'sealed', 'dud'], false);
  }

  return out;
}

async function serve(c, offer, haggling = false) {
  if (busy) return;
  busy = true;
  try {
    haggleMult = 1;
    if (haggling) {
      const limit = haggleLimit(c.arch, hasUpg('hustle1') ? 0.1 : 0);
      const m = await haggle({ name: c.name, emoji: ARCH[c.arch].emoji, price: offer.price, limit });
      if (m === null) {
        S.queue.shift();
        addHeat(1);
        toast(`${c.name} walks out muttering about rip-off merchants.`, 'bad');
        changed();
        return;
      }
      haggleMult = m;
    }
    const done = await offer.run();
    if (done && S.queue[0] === c) S.queue.shift();
    changed();
  } finally {
    haggleMult = 1;
    busy = false;
  }
}

// ---- Rendering ---------------------------------------------------------------
function counterCard(c, a) {
  const arch = ARCH[c.arch];
  const offers = offersFor(c);
  const btns = offers.map(o => {
    const rt = o.riskText || riskLabel(o.risk);
    const rc = o.risk < 0 ? 'mid' : riskClass(o.risk);
    const price = o.price === 0 ? '—' : o.price < 0 ? `pay ${money(-o.price)}` : money(o.price);
    // Positive-price sales (not the swap, not tutorial customers) can be haggled up.
    const canHaggle = o.price > 0 && o.risk >= 0 && !o.disabled && !c.tut;
    return `<div class="offer-row"><button class="offer ${o.scam ? 'scam' : ''}" ${o.disabled ? 'disabled' : ''} data-a="${a(() => serve(c, o))}">
      <span class="ol">${o.label}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>
      <span class="op">${price}</span>
      <span class="or r-${rc}">${rt}</span>
    </button>${canHaggle ? `<button class="haggle" aria-label="Haggle the price" data-a="${a(() => serve(c, o, true))}">🤝</button>` : ''}</div>`;
  }).join('');
  return `<div class="card counter">
    <div class="cust">
      <div class="avatar">${arch.emoji}</div>
      <div><b>${esc(c.name)}</b><div class="tag">${arch.name} · detection ${Math.round(arch.risk * 100)}%</div></div>
    </div>
    <p class="say">${esc(line(c))}</p>
    <div class="offers">${btns || `<p class="muted">You have nothing they want in stock.</p>`}</div>
    <button class="btn ghost small" data-a="${a(() => { S.queue.shift(); changed(); })}">Turn away</button>
  </div>`;
}

function stockHtml() {
  const sets = SET_ORDER.filter(s => SETS[s].unlock <= S.level || S.packs.some(p => p.set === s));
  const cell = (s, cat) => packsOf(s, cat).length;
  const rows = sets.map(s => `<tr><th>${SETS[s].name}</th>
    <td>${cell(s, 'sealed')}</td><td>${cell(s, 'heavy')}</td><td>${cell(s, 'dud')}</td><td>${cell(s, 'open')}</td><td>${cell(s, 'reseal')}</td></tr>`).join('');
  const singlesVal = S.singles.reduce((t, x) => t + worth(x), 0);
  const fakeAvg = S.forgeries.length ? Math.round(avg(S.forgeries.map(f => f.grade))) : 0;
  return `<h3>📦 Stock</h3>
    <div class="card"><table class="stock">
      <thead><tr><th>Packs</th><th>Sealed</th><th>Heavy</th><th>Dud</th><th>Open</th><th>Reseal</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="chips">
        <span class="chip">💎 ${S.singles.length} singles · ${money(singlesVal)}</span>
        <span class="chip">🖨️ ${S.forgeries.length} forgeries${S.forgeries.length ? ` · avg ${fakeAvg}%` : ''}</span>
        <span class="chip">🃏 ${S.commons} bulk commons</span>
        <span class="chip">📄 ${S.blanks} blank cardstock</span>
      </div>
    </div>`;
}

// Distributors allocate a limited number of boxes per day, and orders arrive next morning.
export const allocation = () => 1 + S.level;
const orderedToday = set => S.deliveries.filter(d => d.from === 'supplier' && d.set === set && d.orderedDay === S.day).length;

function supplierHtml(a) {
  const buy = (cost, item, msg) => a(() => {
    if (!spend(cost)) { toast('Not enough cash!', 'bad'); return; }
    order({ ...item, from: 'supplier', orderedDay: S.day, arrive: S.day + 1, paid: cost });
    changed();
    sfx.cash();
    toast(`${msg} Arrives tomorrow morning.`, 'info');
  });
  const boxes = SET_ORDER.map(s => {
    const set = SETS[s];
    if (set.unlock > S.level) return `<button class="sup" disabled><span>🔒 ${set.name} box</span><small>Store Level ${set.unlock}</small></button>`;
    const left = allocation() - orderedToday(s);
    return `<button class="sup" ${left > 0 ? '' : 'disabled'} data-a="${buy(set.boxCost, { kind: 'box', set: s, qty: 1, label: `${set.name} box` }, `${set.name} box ordered.`)}">
      <span>📦 ${set.name} box</span><small>10 packs · ~${Math.round(set.hitRate * 100)}% hit rate · ${left > 0 ? `${left} left in today’s allocation` : 'sold out until tomorrow'}</small><b>${money(set.boxCost)}</b></button>`;
  }).join('');
  return `<h3>🚚 Supplier</h3><div class="card supplier">${boxes}
    <button class="sup" data-a="${buy(10, { kind: 'commons', qty: 50, label: '50 bulk commons' }, '50 bulk commons ordered.')}"><span>🃏 Bulk commons ×50</span><small>mystery box filler & pack weights</small><b>$10</b></button>
    <button class="sup" data-a="${buy(60, { kind: 'blanks', qty: 5, label: '5 blank cardstock' }, '5 sheets of cardstock ordered.')}"><span>📄 Blank cardstock ×5</span><small>for the forgery bench</small><b>$60</b></button>
    <p class="muted small">Orders arrive tomorrow morning. Distributors allocate ${allocation()} box${allocation() > 1 ? 'es' : ''} per set per day.</p>
  </div>`;
}

function incomingHtml() {
  if (!S.deliveries.length) return '';
  const rows = [...S.deliveries].sort((x, y) => x.arrive - y.arrive).map(d => {
    const when = d.arrive <= S.day + 1 ? 'tomorrow' : `day ${d.arrive}`;
    return `<li><span>${d.kind === 'box' ? '📦' : d.kind === 'commons' ? '🃏' : d.kind === 'blanks' ? '📄' : '💎'} ${esc(d.label)}</span><i>${when}</i></li>`;
  }).join('');
  return `<h3>🚚 Incoming</h3><ul class="queue incoming">${rows}</ul>`;
}

// Progress toward the next store level: the game's main objective.
function goalHtml() {
  const next = LEVELS[S.level];
  if (!next) return `<div class="goal"><div class="goal-row"><b>🏆 Max store level reached</b></div></div>`;
  const prev = LEVELS[S.level - 1];
  const pct = Math.max(0, Math.min(100, ((S.lifetime - prev) / (next - prev)) * 100));
  return `<div class="goal"><div class="goal-row"><b>🎯 Goal: Store Level ${S.level + 1}</b><span class="muted">${money(S.lifetime)} / ${money(next)} earned</span></div>
    <div class="goal-bar"><i style="width:${pct}%"></i></div></div>`;
}

function render() {
  const { A, a } = actions();
  const c = S.queue?.[0];
  const rest = (S.queue || []).slice(1);
  let html = `<div class="hub-head"><h2>🏪 Front Counter</h2><span class="sub">Day ${S.day} · ${S.queue.length} waiting</span></div>`;
  html += goalHtml();
  html += c ? counterCard(c, a)
    : `<div class="card empty"><p>🌙 No more customers today.</p><p class="muted">Close up shop to start the next day.</p></div>`;
  if (rest.length) {
    html += `<h3>👥 Queue</h3><ul class="queue">${rest.map(q => `<li><span class="qe">${ARCH[q.arch].emoji}</span><b>${esc(q.name)}</b><i>${
      q.kind === 'refund' ? '😡 refund' : q.kind === 'trade' ? '🔁 trade-in' : { pack: 'packs', mystery: 'mystery box', single: 'singles', box: 'sealed box' }[q.want]
    }</i></li>`).join('')}</ul>`;
  }
  html += incomingHtml();
  html += stockHtml();
  html += binderHtml(a);
  html += supplierHtml(a);
  html += `<div class="thumb-bar"><button class="btn big danger" data-a="${a(() => bus.emit('endday'))}">🔒 Close Shop · End Day ${S.day}</button></div>`;
  root.innerHTML = html;
  bindActions(root, A);
}
