// 📱 ScamBay: wholesale auctions with instant tap bidding, online listings, fake live-stream breaks.
import {
  S, bus, changed, earn, spend, addHeat, heatTier, packsOf, removePacks, addBox,
  uid, pick, rand, roll, clamp, unlockedSets,
} from './state.js';
import { SETS } from './data.js';
import { toast, modal, haptic, money, esc, actions, bindActions } from './ui.js';
import { sfx } from './audio.js';
import { resealRisk, forgeryRisk, comboRisk, riskLabel, riskClass, pickHit } from './rules.js';

const SELLERS = ['✓ 100%_Legit_Cards', 'grandpas_attic_finds', 'NotResealed99', 'xX_sealed_Xx', 'trust_me_bro_tcg', 'estate_sale_steve'];
const VIEWERS = ['ripz4days', 'holo_hank', 'mintyfresh', 'packgoblin', 'lurker42', 'chase_card_chad', 'salty_sam', 'bigspender'];

let root;
let tab = 'feed';
let listings = [];
let pending = [];
let streaming = false;

const isVisible = () => root.classList.contains('active');
const step = l => Math.max(2, Math.round(l.value * 0.05));

export function initWeb(el) {
  root = el;
  newDayListings();
  setInterval(tick, 500);
  bus.on('change', () => { if (isVisible()) render(); });
}
export const showWeb = () => render();

function genListing() {
  const set = pick(unlockedSets());
  const v = SETS[set].boxCost;
  return {
    id: uid(), set, value: v,
    bid: Math.round(v * rand(0.3, 0.55)),
    bin: Math.round(v * rand(0.9, 1.2)),
    mine: false, done: false,
    endAt: Date.now() + rand(30, 70) * 1000,
    seller: pick(SELLERS),
    scam: roll(0.18), // someone else already searched this box…
    watchers: Math.floor(rand(2, 40)),
  };
}

export function newDayListings() {
  listings = listings.filter(l => l.mine && !l.done);
  while (listings.length < 4) listings.push(genListing());
}

function win(l, price) {
  if (!spend(price)) {
    addHeat(3);
    toast('Won the auction but couldn’t pay. Non-paying bidder strike! +3% heat', 'bad');
    return;
  }
  addBox(l.set, { stripped: l.scam });
  sfx.cash();
  toast(`Won a ${SETS[l.set].name} box for ${money(price)}! 10 packs added.`, 'good');
  changed();
}

function tick() {
  const now = Date.now();
  let dirty = false;
  for (const l of listings) {
    if (l.done) continue;
    if (l.mine) {
      if (Math.random() < 0.16 * clamp(1 - l.bid / (l.value * 1.3), 0, 1)) {
        l.bid += step(l);
        l.mine = false;
        dirty = true;
        if (isVisible()) { haptic(15); toast(`Outbid on the ${SETS[l.set].short} box!`, 'bad', 1500); }
      }
    } else if (Math.random() < 0.05 && l.bid < l.value * 0.85) {
      l.bid += step(l);
      dirty = true;
    }
    if (now >= l.endAt) {
      l.done = true;
      dirty = true;
      if (l.mine) win(l, l.bid);
    }
  }
  if (dirty) {
    listings = listings.filter(l => !l.done);
    while (listings.length < 3) listings.push(genListing());
  }
  for (const p of pending) if (now >= p.at) resolveSale(p);
  if (pending.some(p => p.resolved)) { pending = pending.filter(p => !p.resolved); dirty = true; }
  if (!isVisible()) return;
  if (dirty) render();
  else root.querySelectorAll('[data-end]').forEach(el => { el.textContent = `${Math.max(0, Math.ceil((+el.dataset.end - now) / 1000))}s`; });
}

function bid(l) {
  const nb = l.bid + step(l);
  if (nb > S.cash) { toast('Not enough cash to cover that bid.', 'bad'); return; }
  l.bid = nb;
  l.mine = true;
  if (l.endAt - Date.now() < 5000) l.endAt += 5000; // anti-snipe extension
  haptic(10);
  render();
}

function buyNow(l) {
  if (S.cash < l.bin) { toast('Not enough cash!', 'bad'); return; }
  l.done = true;
  listings = listings.filter(x => x !== l);
  listings.push(genListing());
  win(l, l.bin);
}

// ---- Selling ----------------------------------------------------------------
function list(kind, item, price, risk, heat) {
  if (kind === 'single') S.singles = S.singles.filter(x => x.id !== item.id);
  if (kind === 'forgery') S.forgeries = S.forgeries.filter(x => x.id !== item.id);
  if (kind === 'pack') removePacks([item]);
  pending.push({ id: uid(), kind, name: kind === 'pack' ? `${SETS[item.set].name} pack` : item.name, price, risk, heat, at: Date.now() + rand(2000, 4000), grade: item.grade });
  changed();
}

function resolveSale(p) {
  p.resolved = true;
  if (p.kind === 'forgery' && p.grade < 65) {
    S.totals.caught++;
    addHeat(25);
    sfx.fail();
    toast(`"${p.name}" — obvious fake. Instant chargeback! +25% heat`, 'bad');
    return;
  }
  if (p.risk > 0 && roll(p.risk)) {
    S.totals.caught++;
    addHeat(p.heat);
    sfx.fail();
    haptic([50, 30, 50], 'bad');
    toast(`Chargeback! Buyer flagged "${p.name}" as ${p.kind === 'pack' ? 'resealed' : 'counterfeit'}. +${p.heat}% heat`, 'bad');
    return;
  }
  if (p.kind !== 'single') { S.scams++; S.today.scams++; S.totals.scams++; }
  const got = earn(p.price, { online: true });
  sfx.cash();
  toast(`ScamBay sale: "${p.name}" sold for ${money(got)}${heatTier() >= 2 ? ' (20% held by ScamBay)' : ''}`, 'good');
}

// ---- Live breaks -------------------------------------------------------------
async function goLive(set, spiked) {
  if (streaming) return;
  const order = spiked ? ['reseal', 'dud', 'sealed', 'heavy'] : ['heavy', 'sealed', 'dud'];
  const chosen = order.flatMap(c => packsOf(set, c)).slice(0, 10);
  if (chosen.length < 5) { toast('Need at least 5 packs of one set to go live.', 'bad'); return; }
  streaming = true;
  removePacks(chosen);
  changed();
  const price = SETS[set].packPrice * 1.6;
  const reseals = chosen.filter(p => p.resealed);
  const hits = chosen.filter(p => !p.opened && p.hit);
  let risk = comboRisk(reseals.map(p => resealRisk(0.3, p.crimp, p.short)));
  if (!hits.length && chosen.length >= 6) risk = comboRisk([risk, 0.25]);
  const busted = roll(risk);

  const body = document.createElement('div');
  body.className = 'stream';
  body.innerHTML = `<div class="stream-top"><span class="live">● LIVE</span><span class="viewers">👀 ${Math.floor(rand(80, 400))}</span></div><div class="chat"></div>`;
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
    if (!p.opened && p.hit) { say(pick(VIEWERS), `HOLY ${pickHit(set).name.toUpperCase()}!!! 🔥🔥`, 'hot'); sfx.success(); }
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
  if (busted) {
    const got = earn(chosen.length * price * 0.4, { online: true });
    addHeat(30);
    toast(`VIRAL EXPOSÉ: "Local shop sells RESEALED packs" — 2.1M views. Refunds left you ${money(got)}. +30% heat`, 'bad', 4000);
  } else {
    const got = earn(chosen.length * price, { online: true });
    if (reseals.length) { S.scams++; S.today.scams++; S.totals.scams++; }
    if (hits.length >= 2) addHeat(-4);
    toast(`Stream earned ${money(got)}${hits.length >= 2 ? ' · hype! -4% heat' : ''}`, 'good');
  }
}

// ---- Rendering ---------------------------------------------------------------
function feedHtml(a) {
  const now = Date.now();
  return listings.map(l => {
    const set = SETS[l.set];
    return `<div class="post">
      <div class="post-head"><span class="pfp">${set.mascot}</span><div><b>${esc(l.seller)}</b><small>${l.watchers} watching · ends in <span data-end="${l.endAt}">${Math.ceil((l.endAt - now) / 1000)}s</span></small></div></div>
      <p>SEALED ${set.name.toUpperCase()} BOOSTER BOX 🔥 10 packs, never searched!!! (trust)</p>
      <div class="post-foot">
        <div class="bid ${l.mine ? 'mine' : ''}">${money(l.bid)}<small>${l.mine ? 'you’re winning' : 'current bid'}</small></div>
        <button class="btn small" data-a="${a(() => bid(l))}">Bid +${money(step(l))}</button>
        <button class="btn small ghost" data-a="${a(() => buyNow(l))}">Buy now ${money(l.bin)}</button>
      </div>
    </div>`;
  }).join('');
}

function sellHtml(a) {
  const rows = [];
  for (const s of S.singles) {
    const price = s.value * 0.92;
    rows.push(row(s.name, 'genuine single · after fees', price, 0, a(() => list('single', s, price, 0, 0))));
  }
  for (const f of S.forgeries) {
    const price = f.value * 0.95;
    const risk = forgeryRisk(0.35, f.grade);
    rows.push(row(f.name, `forgery · grade ${f.grade}%`, price, risk, a(() => list('forgery', f, price, risk, 15)), true));
  }
  for (const set of Object.keys(SETS)) {
    const res = packsOf(set, 'reseal').sort((x, y) => y.crimp - x.crimp);
    if (res.length) {
      const p = res[0];
      const price = SETS[set].packPrice * 1.3;
      const risk = resealRisk(0.12, p.crimp, p.short);
      rows.push(row(`${SETS[set].name} pack ×${res.length}`, `resealed · best crimp ${p.crimp}%`, price, risk, a(() => list('pack', p, price, risk, 6)), true));
    }
    const duds = packsOf(set, 'dud');
    if (duds.length) {
      const price = SETS[set].packPrice * 1.2;
      rows.push(row(`${SETS[set].name} pack ×${duds.length}`, 'weighed dud · "factory sealed"', price, 0, a(() => list('pack', duds[0], price, 0, 0))));
    }
  }
  const pend = pending.map(p => `<li>⏳ <b>${esc(p.name)}</b> — bidding… ${money(p.price)}</li>`).join('');
  return `${pend ? `<ul class="pending">${pend}</ul>` : ''}
    ${heatTier() >= 2 ? `<p class="warn">⚠️ Account under review: ScamBay holds 20% of sale revenue (${money(S.locked)} held).</p>` : ''}
    ${rows.length ? rows.join('') : '<div class="card empty"><p>Nothing to list.</p><p class="muted">Pull hits, reseal packs or forge cards on the Bench.</p></div>'}`;
}

function row(name, sub, price, risk, act, scam = false) {
  return `<div class="listing ${scam ? 'scam' : ''}"><div class="grow"><b>${esc(name)}</b><small>${esc(sub)}</small></div>
    <span class="or r-${riskClass(risk)}">${riskLabel(risk)}</span>
    <button class="btn small" data-a="${act}">List ${money(price)}</button></div>`;
}

function liveHtml(a) {
  const sets = Object.keys(SETS).filter(s => ['sealed', 'dud', 'heavy', 'reseal'].some(c => packsOf(s, c).length));
  if (!sets.length) return '<div class="card empty"><p>No packs to break.</p><p class="muted">Buy boxes from the feed or the Supplier.</p></div>';
  return `<p class="muted small">Rip up to 10 packs live. Viewers pay a 60% hype premium — but streamers spot crinkly seals.</p>` + sets.map(s => {
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
  const body = tab === 'feed' ? feedHtml(a) : tab === 'sell' ? sellHtml(a) : liveHtml(a);
  root.innerHTML = `<div class="app-chrome">
      <div class="app-title"><span>Scam<b>Bay</b></span><small>${heatTier() >= 2 ? '⚠️ under review' : '✓ trusted seller'}</small></div>
      <div class="seg">${t('feed', '🛒 Wholesale')}${t('sell', '🏷️ My listings')}${t('live', '🔴 Live break')}</div>
    </div>
    <div class="feed">${body}</div>`;
  bindActions(root, A);
}
