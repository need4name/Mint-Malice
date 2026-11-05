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
import { toast, haptic, money, esc, actions, bindActions } from './ui.js';
import { sfx } from './audio.js';
import { resealRisk, forgeryRisk, comboRisk, riskLabel, riskClass, trimRisk } from './rules.js';
import { stagePhoto } from './games/photo.js';
import { cardImage } from './cardface.js';
import { snipe } from './games/snipe.js';
import { streamBreak } from './games/stream.js';
import { inspectReturn } from './games/inspect.js';

const SELLERS = ['grandpas_attic_finds', 'NotResealed99', 'xX_sealed_Xx', 'trust_me_bro_tcg', 'estate_sale_steve',
  'mintcondition_mo', 'card_kingdom_uk', 'lowballer_lou', 'fastship_frank', 'vintage_vault', 'flip_city', 'dad_cleared_loft'];

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
  lot.live = roll(0.3); // ends live: won by sniping, not by max bid
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
const photoOf = li => li.photo ?? 0.5;
const sellChance = li => clamp(clamp(1.6 - li.ask / marketValue(li), 0.05, 0.95) * Math.pow(W().rating / 100, 1.5) * (heatTier() >= 2 ? 0.85 : 1) * (0.75 + 0.5 * photoOf(li)), 0.02, 0.97);

function scamRisk(li) {
  let r = 0;
  if (li.kind === 'forgery') r = forgeryRisk(0.35, li.item.grade, li.item.slab);
  if (li.kind === 'single') r = trimRisk(0.35, li.item);
  if (li.kind === 'pack' && li.item.resealed) r = resealRisk(0.12, li.item.crimp, li.item.short);
  return clamp(r * (1.3 - 0.6 * photoOf(li)), 0, 0.97); // a clever photo hides flaws
}

async function list(kind, item, tier) {
  if (W().listings.length >= slots()) { toast(`All ${slots()} listing slots are full. Higher store levels add slots.`, 'bad'); return; }
  // cards get a staged photo; packs just get a snap
  const photo = kind === 'pack' ? 0.5 : await stagePhoto(item, kind === 'forgery');
  if (kind === 'single') S.singles = S.singles.filter(x => x.id !== item.id);
  if (kind === 'forgery') S.forgeries = S.forgeries.filter(x => x.id !== item.id);
  if (kind === 'pack') removePacks([item]);
  const li = { id: uid(), kind, item, tier, days: 0, photo };
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
      // some buyers try a return scam: they send back a different card
      if (li.kind === 'single' && roll(0.15)) S.returns.push({ id: uid(), card: li.item, refund: got, fake: roll(0.6), day: S.day + 1 });
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
async function goLiveAuction(l) {
  const r = await snipe({ title: lotLabel(l), price: l.price, rival: l.rival, step: inc(l) });
  W().lots = W().lots.filter(x => x !== l);
  if (r.won) {
    if (spend(r.price)) { ship(l, r.price); toast(`Sniped ${lotLabel(l)} for ${money(r.price)}! Ships in 1–2 days.`, 'good'); }
    else toast('You won but can’t pay. The seller relists it.', 'bad');
  } else toast(`Lost ${lotLabel(l)} at ${money(r.price)}.`, 'bad');
  changed();
}

// Morning: inspect returned cards. Returns report lines.
export async function handleReturns() {
  const due = S.returns.filter(r => r.day <= S.day);
  S.returns = S.returns.filter(r => r.day > S.day);
  const lines = [];
  for (const r of due) {
    const verdict = await inspectReturn(r.card, r.fake);
    if (verdict === 'accept') {
      S.cash -= r.refund;
      if (r.fake) { S.forgeries.push({ ...r.card, id: uid(), grade: 35, name: `${r.card.name} (swapped fake)` }); lines.push({ bad: true, text: `You accepted a swapped fake for ${r.card.name}. Refunded ${money(r.refund)}.` }); }
      else { S.singles.push(r.card); lines.push({ text: `${r.card.name} returned. Refunded ${money(r.refund)}.` }); }
    } else if (r.fake) {
      lines.push({ good: true, text: `Return scam blocked on ${r.card.name}. You keep the money.` });
    } else {
      S.cash -= r.refund;
      S.singles.push(r.card);
      W().rating = Math.max(0, W().rating - 6);
      lines.push({ bad: true, text: `You rejected a genuine return of ${r.card.name}. ScamBay sided with the buyer: refunded, rating −6%.` });
    }
  }
  if (due.length) changed();
  return lines;
}

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
  // chat suspicion scales with how risky the packs really are
  const susRate = clamp(0.04 + risk * 0.35, 0.04, 0.4);
  const res = await streamBreak({ set, packs: chosen, susRate });
  streaming = false;
  const audience = clamp(res.viewers / 120, 0.5, 1.5) * (0.8 + res.hype / 100 * 0.6);
  if (res.busted) {
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
      <div class="post-head"><span class="pfp">${l.kind === 'single' ? `<img class="thumb" src="${cardImage(l.card, 40)}" alt="">` : l.kind === 'box' ? set.mascot : l.kind === 'commons' ? '🃏' : '📄'}</span>
        <div class="grow"><b>${esc(l.seller.name)}</b><small>${stars(l.seller.stars)} (${l.seller.feedback}) · ${l.live ? '🔴 ends live, join any time today' : 'closes tonight'}</small></div></div>
      <p>${esc(l.title)}</p>
      <small>${ref} · ${status}</small>
      <div class="post-foot">
        <div class="bid ${winning(l) ? 'mine' : ''}">${money(l.price)}<small>current bid</small></div>
        ${l.live ? `<button class="btn small danger" data-a="${a(() => goLiveAuction(l))}">🔴 Join live ending</button>` : `<button class="btn small" data-a="${a(() => bid(l, next))}">Bid ${money(next)}</button>
        <button class="btn small" data-a="${a(() => bid(l, Math.round(next * 1.25)))}">Max ${money(Math.round(next * 1.25))}</button>`}
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
  for (const s of S.singles) add('single', s, s.name, `${RARITY[s.rarity]?.label || 'Holo'} · ${s.trimmed ? 'trimmed' : 'genuine'}`, trimRisk(0.35, s));
  for (const f of S.forgeries) add('forgery', f, f.name, `forgery · grade ${f.grade}%${f.slab ? ' · slabbed' : ''}`, forgeryRisk(0.35, f.grade, f.slab));
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
