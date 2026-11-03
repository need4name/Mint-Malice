// 📱 ScamBay. Everything here runs on the day cycle:
// - Wholesale: a fixed batch of lots each morning. You set a max bid (eBay-style proxy
//   bidding against a hidden rival). Lots close overnight and ship in 1–2 days.
//   Low-rated sellers are cheaper, but more likely to ship searched boxes or fake singles.
// - Selling: limited listing slots. Pick a price tier; listings may sell overnight.
//   Buyers who spot a fake file a claim: no money, rating drops, Heat rises.
// - Live break: one stream per day.
import {
  S, bus, changed, earn, spend, addHeat, heatTier, packsOf, removePacks, order, rollCard, worth,
  uid, pick, rand, roll, clamp, unlockedSets,
} from './state.js';
import { SETS, RARITY } from './data.js';
import { toast, modal, haptic, money, esc, actions, bindActions } from './ui.js';
import { sfx } from './audio.js';
import { resealRisk, forgeryRisk, comboRisk, riskLabel, riskClass } from './rules.js';

const SELLERS = ['grandpas_attic_finds', 'NotResealed99', 'xX_sealed_Xx', 'trust_me_bro_tcg', 'estate_sale_steve',
  'mintcondition_mo', 'card_kingdom_uk', 'lowballer_lou', 'fastship_frank', 'vintage_vault', 'flip_city', 'dad_cleared_loft'];
const VIEWERS = ['ripz4days', 'holo_hank', 'mintyfresh', 'packgoblin', 'lurker42', 'chase_card_chad', 'salty_sam', 'bigspender'];

const TIERS = {
  quick: { label: 'Quick sale', mult: 0.8 },
  fair: { label: 'Market', mult: 1.0 },
  greedy: { label: 'Greedy', mult: 1.3 },
};
const FEE = 0.1; // ScamBay final value fee
const EXPIRE_DAYS = 7;

let root;
let tab = 'buy';
let streaming = false;

const W = () => S.web;
const isVisible = () => root.classList.contains('active');
export const slots = () => 2 + S.level;

export function initWeb(el) {
  root = el;
  if (W().day !== S.day) newDayLots();
  bus.on('change', () => { if (isVisible()) render(); });
}
export const showWeb = () => render();

// ---- Wholesale lots ----------------------------------------------------------------
const searchedChance = stars => (stars < 3.6 ? 0.55 : stars < 4.4 ? 0.18 : 0.03);
const fakeChance = stars => (stars < 3.6 ? 0.4 : stars < 4.4 ? 0.12 : 0.02);
const inc = l => Math.max(2, Math.round(l.value * 0.05));

function genLot() {
  const set = pick(unlockedSets());
  const stars = Math.round(rand(2.6, 5) * 10) / 10;
  const seller = { name: pick(SELLERS), stars, feedback: Math.floor(rand(4, 2400)) };
  const r = Math.random();
  let lot;
  if (r < 0.55) {
    const qty = roll(0.25) ? 2 : 1;
    lot = { kind: 'box', set, qty, value: SETS[set].boxCost * qty, searched: roll(searchedChance(stars)),
      title: `SEALED ${SETS[set].name.toUpperCase()} BOOSTER BOX${qty > 1 ? ' ×2' : ''} — never searched!!! (trust)` };
  } else if (r < 0.8) {
    const card = rollCard(set, roll(0.5) ? 'ultra' : roll(0.3) ? 'secret' : 'holo');
    lot = { kind: 'single', set, card, value: worth(card), fake: roll(fakeChance(stars)),
      title: `${card.name} — ${RARITY[card.rarity].label}, pack fresh 💎` };
  } else if (r < 0.92) {
    const qty = pick([100, 200, 300]);
    lot = { kind: 'commons', set, qty, value: Math.round(qty * 0.12), title: `BULK LOT ${qty} commons, no rares sorry` };
  } else {
    const qty = pick([5, 10]);
    lot = { kind: 'blanks', set, qty, value: qty * 11, title: `Art supply clearance: ${qty} sheets premium card stock` };
  }
  // Rivals trust good sellers more and bid higher on their lots.
  const trust = 0.55 + 0.45 * ((stars - 2.6) / 2.4);
  lot.rival = Math.round(lot.value * rand(0.55, 1.1) * trust);
  lot.price = Math.max(1, Math.round(lot.value * rand(0.2, 0.4)));
  lot.bids = Math.floor(rand(0, 9));
  lot.bin = roll(0.4) ? Math.round(lot.value * rand(0.95, 1.25)) : null;
  return { id: uid(), seller, myMax: 0, ...lot };
}

export function newDayLots() {
  W().lots = Array.from({ length: Math.min(7, 3 + S.level) }, genLot);
  W().streamed = false;
  W().day = S.day;
}

const winning = l => l.myMax > 0 && l.myMax > l.rival;

function bid(l, amount) {
  if (amount <= l.price) amount = l.price + inc(l);
  l.myMax = Math.max(l.myMax, amount);
  if (l.myMax > l.rival) {
    l.price = Math.max(l.price, Math.min(l.myMax, l.rival + inc(l)));
    sfx.cash();
    toast(`You’re the high bidder at ${money(l.price)}. Lot closes tonight.`, 'good');
  } else {
    l.price = Math.min(l.rival, l.myMax + inc(l));
    sfx.fail();
    haptic(15);
    toast('Outbid instantly. Someone has a higher max bid.', 'bad');
  }
  l.bids++;
  changed();
}

function buyNow(l) {
  if (!spend(l.bin)) { toast('Not enough cash!', 'bad'); return; }
  ship(l, l.bin);
  W().lots = W().lots.filter(x => x !== l);
  sfx.cash();
  toast(`Bought! Ships in 1–2 days.`, 'good');
  changed();
}

function ship(l, paid) {
  const arrive = S.day + (roll(0.5) ? 1 : 2);
  const base = { arrive, label: lotLabel(l), paid };
  if (l.kind === 'box') order({ ...base, kind: 'box', set: l.set, qty: l.qty, stripped: l.searched });
  if (l.kind === 'commons') order({ ...base, kind: 'commons', qty: l.qty });
  if (l.kind === 'blanks') order({ ...base, kind: 'blanks', qty: l.qty });
  if (l.kind === 'single') {
    if (l.fake) order({ ...base, kind: 'fake', card: { ...l.card, id: uid(), grade: Math.round(rand(55, 78)), slab: false } });
    else order({ ...base, kind: 'single', card: { ...l.card, id: uid() } });
  }
}

function lotLabel(l) {
  if (l.kind === 'box') return `${SETS[l.set].name} box${l.qty > 1 ? ' ×2' : ''}`;
  if (l.kind === 'single') return l.card.name;
  if (l.kind === 'commons') return `${l.qty} bulk commons`;
  return `${l.qty} blank cardstock`;
}

// ---- Selling ------------------------------------------------------------------------
function marketValue(li) {
  if (li.kind === 'pack') return SETS[li.item.set].packPrice * 1.25;
  return worth(li.item);
}
const sellChance = li => clamp(1.6 - li.ask / marketValue(li), 0.05, 0.95) * Math.pow(W().rating / 100, 1.5) * (heatTier() >= 2 ? 0.85 : 1);

function scamRisk(li) {
  if (li.kind === 'forgery') return forgeryRisk(0.35, li.item.grade);
  if (li.kind === 'pack' && li.item.resealed) return resealRisk(0.12, li.item.crimp, li.item.short);
  return 0;
}

function list(kind, item, tier) {
  if (W().listings.length >= slots()) { toast(`All ${slots()} listing slots are full. Higher store levels add slots.`, 'bad'); return; }
  if (kind === 'single') S.singles = S.singles.filter(x => x.id !== item.id);
  if (kind === 'forgery') S.forgeries = S.forgeries.filter(x => x.id !== item.id);
  if (kind === 'pack') removePacks([item]);
  const li = { id: uid(), kind, item, tier, days: 0 };
  li.ask = Math.max(1, Math.round(marketValue(li) * TIERS[tier].mult));
  W().listings.push(li);
  sfx.tap();
  toast(`Listed for ${money(li.ask)}. Sales happen overnight.`, 'info');
  changed();
}

function unlist(li) {
  W().listings = W().listings.filter(x => x !== li);
  restore(li);
  changed();
}

function restore(li) {
  if (li.kind === 'single') S.singles.push(li.item);
  if (li.kind === 'forgery') S.forgeries.push(li.item);
  if (li.kind === 'pack') S.packs.push(li.item);
}

const itemName = li => (li.kind === 'pack' ? `${SETS[li.item.set].name} pack${li.item.resealed ? ' (resealed)' : ''}` : li.item.name);

// ---- Overnight ----------------------------------------------------------------------
// Called at closing time. Returns report lines for the end-of-day summary.
export function closeDay() {
  const lines = [];
  // Auctions close
  for (const l of W().lots) {
    if (!winning(l)) { if (l.myMax) lines.push({ bad: true, text: `Lost auction: ${lotLabel(l)} (sold for ${money(l.price)})` }); continue; }
    if (spend(l.price)) {
      ship(l, l.price);
      lines.push({ good: true, text: `Won ${lotLabel(l)} for ${money(l.price)}. Ships in 1–2 days.` });
    } else {
      W().rating = Math.max(0, W().rating - 6);
      addHeat(3);
      lines.push({ bad: true, text: `Couldn’t pay for ${lotLabel(l)}. Non-paying bidder strike: rating −6%, heat +3%.` });
    }
  }
  // Listings
  for (const li of [...W().listings]) {
    li.days++;
    if (roll(sellChance(li))) {
      W().listings = W().listings.filter(x => x !== li);
      const name = itemName(li);
      if (roll(scamRisk(li))) {
        const forged = li.kind === 'forgery';
        W().rating = Math.max(0, W().rating - (forged ? 12 : 8));
        S.totals.caught++;
        addHeat(forged ? 15 : 6);
        lines.push({ bad: true, text: `Buyer claim on ${name}: “${forged ? 'counterfeit' : 'resealed'}”. Refunded, rating −${forged ? 12 : 8}%, heat +${forged ? 15 : 6}%.` });
        continue;
      }
      const got = earn(li.ask * (1 - FEE), { online: true });
      W().rating = Math.min(100, W().rating + 1);
      if (scamRisk(li) > 0) { S.scams++; S.today.scams++; S.totals.scams++; }
      lines.push({ good: true, text: `Sold ${name} for ${money(li.ask)} (you got ${money(got)} after fees${heatTier() >= 2 ? ' and holds' : ''}).` });
    } else if (li.days >= EXPIRE_DAYS) {
      W().listings = W().listings.filter(x => x !== li);
      restore(li);
      lines.push({ text: `${itemName(li)} didn’t sell in ${EXPIRE_DAYS} days and came back to stock.` });
    }
  }
  return lines;
}

// ---- Live breaks ------------------------------------------------------------------
async function goLive(set, spiked) {
  if (streaming) return;
  if (W().streamed) { toast('You’ve already streamed today. Come back tomorrow.', 'bad'); return; }
  const cats = spiked ? ['reseal', 'dud', 'sealed', 'heavy'] : ['heavy', 'sealed', 'dud'];
  const chosen = cats.flatMap(c => packsOf(set, c)).slice(0, 10);
  if (chosen.length < 5) { toast('Need at least 5 packs of one set to go live.', 'bad'); return; }
  streaming = true;
  W().streamed = true;
  removePacks(chosen);
  changed();
  const price = SETS[set].packPrice * 1.6;
  const reseals = chosen.filter(p => p.resealed);
  const hits = chosen.filter(p => !p.opened && p.hit);
  let risk = comboRisk(reseals.map(p => resealRisk(0.3, p.crimp, p.short)));
  if (!hits.length && chosen.length >= 6) risk = comboRisk([risk, 0.25]);
  const busted = roll(risk);
  const viewers = Math.floor(rand(40, 120) * S.level * (W().rating / 100));

  const body = document.createElement('div');
  body.className = 'stream';
  body.innerHTML = `<div class="stream-top"><span class="live">● LIVE</span><span class="viewers">👀 ${viewers}</span></div><div class="chat"></div>`;
  const chat = body.querySelector('.chat');
  const say = (who, msg, cls = '') => {
    const el = document.createElement('div');
    el.className = `msg ${cls}`;
    el.innerHTML = `<b>${esc(who)}</b> ${esc(msg)}`;
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  };
  const timers = [];
  chosen.forEach((p, i) => timers.push(setTimeout(() => {
    if (!p.opened && p.hit) { say(pick(VIEWERS), `HOLY ${rollCard(set).name.toUpperCase()}!!! 🔥🔥`, 'hot'); sfx.success(); }
    else say(pick(VIEWERS), pick(['meh', 'next pack', 'rip it faster', 'W break', 'L pack', 'commons again lol', 'nice centering tho']));
  }, 400 + i * 350)));
  timers.push(setTimeout(() => {
    if (busted) {
      say('salty_sam', 'wait… that seal looks crimped 👀', 'bad');
      say('chase_card_chad', 'BRO THESE ARE RESEALED 🚨 clipping this', 'bad');
      sfx.fail();
    } else say('bigspender', 'best break this week 💸', 'hot');
  }, 400 + chosen.length * 350 + 200));

  await modal({ title: `📱 ScamBay Live — ${SETS[set].name} break`, body, buttons: [{ label: 'End stream', value: true }] });
  timers.forEach(clearTimeout);
  streaming = false;
  const audience = clamp(viewers / 150, 0.5, 1.5);
  if (busted) {
    const got = earn(chosen.length * price * 0.4 * audience, { online: true });
    addHeat(30);
    W().rating = Math.max(0, W().rating - 10);
    toast(`VIRAL EXPOSÉ: "Local shop sells RESEALED packs". Refunds left you ${money(got)}. +30% heat`, 'bad', 4000);
  } else {
    const got = earn(chosen.length * price * audience, { online: true });
    if (reseals.length) { S.scams++; S.today.scams++; S.totals.scams++; }
    if (hits.length >= 2) addHeat(-4);
    toast(`Stream earned ${money(got)}${hits.length >= 2 ? ' · hype! -4% heat' : ''}`, 'good');
  }
}

// ---- Rendering ---------------------------------------------------------------------
function stars(n) { return `<span class="stars" title="${n} of 5">★ ${n.toFixed(1)}</span>`; }

function buyHtml(a) {
  const lots = W().lots;
  const due = lots.filter(winning).reduce((t, l) => t + l.price, 0);
  const head = `<p class="muted small">New lots every morning. Set your max bid. Lots close when you end the day and ship in 1–2 days.
    Cheap sellers with low ratings sometimes ship searched boxes or fakes.</p>
    ${due ? `<p class="warn">Winning ${lots.filter(winning).length} lot(s): ${money(due)} due tonight${due > S.cash ? ' (more than your cash!)' : ''}.</p>` : ''}`;
  if (!lots.length) return head + '<div class="card empty"><p>No lots left today.</p><p class="muted">New lots appear tomorrow morning.</p></div>';
  return head + lots.map(l => {
    const set = SETS[l.set];
    const ref = l.kind === 'box' ? `Supplier price ${money(set.boxCost * l.qty)}`
      : l.kind === 'single' ? `Market ~${money(worth(l.card))}` : l.kind === 'commons' ? 'Market ~$0.12 each' : 'Supplier $12/sheet';
    const status = winning(l) ? `<b class="good">Winning · your max ${money(l.myMax)}</b>` : l.myMax ? '<b class="bad">Outbid</b>' : `${l.bids} bids`;
    const next = l.price + inc(l);
    return `<div class="post">
      <div class="post-head"><span class="pfp">${l.kind === 'single' ? l.card.art : l.kind === 'box' ? set.mascot : l.kind === 'commons' ? '🃏' : '📄'}</span>
        <div class="grow"><b>${esc(l.seller.name)}</b><small>${stars(l.seller.stars)} (${l.seller.feedback}) · closes tonight</small></div></div>
      <p>${esc(l.title)}</p>
      <small>${ref} · ${status}</small>
      <div class="post-foot">
        <div class="bid ${winning(l) ? 'mine' : ''}">${money(l.price)}<small>current bid</small></div>
        <button class="btn small" data-a="${a(() => bid(l, next))}">Bid ${money(next)}</button>
        <button class="btn small" data-a="${a(() => bid(l, Math.round(next * 1.25)))}">Max ${money(Math.round(next * 1.25))}</button>
        ${l.bin ? `<button class="btn small ghost" data-a="${a(() => buyNow(l))}">Buy ${money(l.bin)}</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function sellHtml(a) {
  const ls = W().listings;
  const chanceText = p => (p > 0.6 ? 'likely' : p > 0.3 ? 'maybe' : 'unlikely');
  const active = ls.map(li => `<div class="listing"><div class="grow"><b>${esc(itemName(li))}</b>
      <small>${TIERS[li.tier].label} · ${money(li.ask)} · day ${li.days + 1}/${EXPIRE_DAYS} · ${chanceText(sellChance(li))} to sell tonight</small></div>
      <button class="btn small ghost" data-a="${a(() => unlist(li))}">Cancel</button></div>`).join('');

  const rows = [];
  const add = (kind, item, name, sub, risk) => {
    const probe = { kind, item };
    const mv = marketValue(probe);
    const btns = Object.entries(TIERS).map(([k, t]) => `<button class="btn small" data-a="${a(() => list(kind, item, k))}">${t.label.split(' ')[0]} ${money(mv * t.mult)}</button>`).join('');
    rows.push(`<div class="listing col"><div class="row"><div class="grow"><b>${esc(name)}</b><small>${esc(sub)}</small></div>
      <span class="or r-${riskClass(risk)}">${riskLabel(risk)}</span></div><div class="ctrl-row tiers">${btns}</div></div>`);
  };
  for (const s of S.singles) add('single', s, s.name, `${RARITY[s.rarity]?.label || 'Holo'} · genuine`, 0);
  for (const f of S.forgeries) add('forgery', f, f.name, `forgery · grade ${f.grade}%`, forgeryRisk(0.35, f.grade));
  for (const set of Object.keys(SETS)) {
    const res = packsOf(set, 'reseal').sort((x, y) => y.crimp - x.crimp)[0];
    if (res) add('pack', res, `${SETS[set].name} pack`, `resealed · crimp ${res.crimp}% · ${packsOf(set, 'reseal').length} in stock`, resealRisk(0.12, res.crimp, res.short));
    for (const cat of ['dud', 'sealed']) {
      const p = packsOf(set, cat)[0];
      if (p) add('pack', p, `${SETS[set].name} pack`, `${cat === 'dud' ? 'weighed dud' : 'unweighed'} · ${packsOf(set, cat).length} in stock`, 0);
    }
  }
  return `<div class="rating-row"><span>Seller rating <b class="${W().rating >= 90 ? 'good' : W().rating >= 70 ? '' : 'bad'}">${W().rating}%</b></span>
      <span class="muted small">Listings ${ls.length}/${slots()} · 10% fee</span></div>
    ${heatTier() >= 2 ? `<p class="warn">⚠️ Account under review: ScamBay holds 20% of sale revenue (${money(S.locked)} held).</p>` : ''}
    ${active || '<p class="muted small">Nothing listed. Listings sell overnight. Cheaper listings sell faster; a low rating scares buyers off.</p>'}
    <h3>List an item</h3>
    ${ls.length >= slots() ? '<p class="muted small">All slots full. Cancel a listing or wait for sales.</p>'
      : rows.length ? rows.join('') : '<div class="card empty"><p>Nothing to list.</p><p class="muted">Pull hits, reseal packs or forge cards on the Bench.</p></div>'}`;
}

function liveHtml(a) {
  if (W().streamed) return '<div class="card empty"><p>📴 You’ve streamed today.</p><p class="muted">Viewers come back tomorrow.</p></div>';
  const sets = Object.keys(SETS).filter(s => ['sealed', 'dud', 'heavy', 'reseal'].some(c => packsOf(s, c).length));
  if (!sets.length) return '<div class="card empty"><p>No packs to break.</p><p class="muted">Order boxes from the Supplier or win them at auction.</p></div>';
  return `<p class="muted small">One stream a day. Rip up to 10 packs live; viewers pay a 60% hype premium. Streams sell better with a high rating and store level. Viewers spot crinkly seals.</p>` + sets.map(s => {
    const n = ['sealed', 'dud', 'heavy', 'reseal'].reduce((t, c) => t + packsOf(s, c).length, 0);
    const r = packsOf(s, 'reseal').length;
    return `<div class="card live-card"><div><b>${SETS[s].mascot} ${SETS[s].name}</b><small>${n} packs · ${r} resealed</small></div>
      <div class="ctrl-row">
        <button class="btn small" ${n - r >= 5 ? '' : 'disabled'} data-a="${a(() => goLive(s, false))}">Honest break</button>
        <button class="btn small danger" ${n >= 5 ? '' : 'disabled'} data-a="${a(() => goLive(s, true))}">Spiked break 😈</button>
      </div></div>`;
  }).join('');
}

function render() {
  const { A, a } = actions();
  const t = (id, label) => `<button class="${tab === id ? 'on' : ''}" data-a="${a(() => { tab = id; render(); })}">${label}</button>`;
  const body = tab === 'buy' ? buyHtml(a) : tab === 'sell' ? sellHtml(a) : liveHtml(a);
  root.innerHTML = `<div class="app-chrome">
      <div class="app-title"><span>Scam<b>Bay</b></span><small>${W().rating}% positive · ${heatTier() >= 2 ? '⚠️ under review' : '✓ trusted seller'}</small></div>
      <div class="seg">${t('buy', '🛒 Wholesale')}${t('sell', `🏷️ Selling ${W().listings.length}/${slots()}`)}${t('live', '🔴 Live')}</div>
    </div>
    <div class="feed">${body}</div>`;
  bindActions(root, A);
}
