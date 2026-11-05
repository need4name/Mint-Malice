// Mutable game state, persistence, and the small event bus every hub listens to.
import { SETS, SET_ORDER, PACKS_PER_BOX, LEVELS, ART_BONUS, RARITY } from './data.js';

const KEY = 'mint-malice-save-v1';

const listeners = {};
export const bus = {
  on(ev, fn) { (listeners[ev] ||= []).push(fn); },
  emit(ev, data) { (listeners[ev] || []).forEach(fn => fn(data)); },
};

let seq = 0;
export const uid = () => Date.now().toString(36) + (seq++).toString(36);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const roll = p => Math.random() < p;
export function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const blankDay = () => ({ revenue: 0, spent: 0, heat: 0, served: 0, scams: 0 });

function fresh() {
  return {
    v: 1, day: 1, cash: 500, heat: 0, level: 1, lifetime: 0,
    packs: [], singles: [], forgeries: [], commons: 24, blanks: 3,
    upgrades: {}, lawyer: false, fallGuyUsed: false,
    scams: 0, locked: 0, queue: null,
    today: blankDay(), totals: { revenue: 0, scams: 0, caught: 0, days: 0 },
    muted: false, over: false,
    tut: null, // tutorial progress: { step, active, done }
    market: { choke: 1, yuno: 1, tragic: 1 }, // daily price multiplier per set
    deliveries: [], // { id, arrive (day), label, kind: box|commons|blanks|single|fake, set, qty, stripped, card }
    web: { lots: [], listings: [], rating: 100, streamed: false, day: 0 },
    news: [], // overnight headlines for the morning report
    grading: [], // { card, kind: single|forgery, back (day), tier }
    returns: [], // ScamBay returns to inspect: { card, refund, fake, day }
    daily: { day: 0, review: false, bribe: false }, // once-a-day Underground services
  };
}

export let S = fresh();

export function newGame() {
  S = fresh();
  addBox('choke');
  return S;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.v === 1) { S = Object.assign(fresh(), data); return true; }
    }
  } catch (e) { /* private mode or corrupt save: start fresh */ }
  newGame();
  return false;
}

let saveTimer = 0;
export function save(now = false) {
  clearTimeout(saveTimer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } };
  if (now) write(); else saveTimer = setTimeout(write, 200);
}
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

export function changed() { save(); bus.emit('change'); }

// ---- Packs ----------------------------------------------------------------
export function makePack(set, hit = Math.random() < SETS[set].hitRate) {
  const { light, heavy } = SETS[set].weights;
  return {
    id: uid(), set, hit,
    w: (hit ? heavy : light) + gauss() * 0.012,
    reading: null, sorted: 'none', opened: false, resealed: false, crimp: null, short: false,
  };
}
export function addBox(set, opts = {}) {
  for (let i = 0; i < PACKS_PER_BOX; i++) S.packs.push(makePack(set, opts.stripped ? false : undefined));
}
// ---- Cards & market --------------------------------------------------------
const weightedPick = (items, weight) => {
  let r = Math.random() * items.reduce((t, x) => t + weight(x), 0);
  for (const x of items) { r -= weight(x); if (r <= 0) return x; }
  return items[0];
};

// A random chase card from a set: rarity tier first, then card, then a possible variant.
export function rollCard(set, rarity = null) {
  const def = SETS[set];
  const tier = rarity || weightedPick(Object.keys(RARITY), k => RARITY[k].odds);
  const pool = def.cards.filter(c => c.rarity === tier);
  const base = weightedPick(pool, c => 1 / c.value);
  const variant = def.variants.find(v => Math.random() < v.odds) || null;
  const off = () => Math.round(clamp(50 + (Math.random() < 0.5 ? -1 : 1) * Math.abs(gauss()) * 8, 30, 70));
  return {
    id: uid(), set, art: base.art, rarity: tier,
    name: variant ? `${base.name} (${variant.name})` : base.name,
    value: Math.round(base.value * (variant ? variant.mult : 1)),
    lr: off(), tb: off(), // centering: left and top border share, 50 = perfect
  };
}

// Centering: the worse axis decides. Raw cards are priced by centering; graded slabs by grade.
export const worstShare = c => Math.max(c.lr, 100 - c.lr, c.tb, 100 - c.tb);
export function centerMult(c) {
  if (c.lr == null) return 1;
  const w = worstShare(c);
  return w <= 55 ? 1.15 : w <= 60 ? 1 : w <= 70 ? 0.85 : 0.7;
}
const GRADE_MULT = { 10: 3, 9: 1.8, 8: 1.2, 7: 1, 6: 0.9, 5: 0.8 };
export const gradeMult = c => (c.gsa === 'A' ? 0.5 : c.gsa ? GRADE_MULT[c.gsa] || 0.8 : centerMult(c));

// What a card fetches today: its base value moved by the set's market.
export const worth = card => Math.round(card.value * (S.market?.[card.set] ?? 1) * gradeMult(card));

export function driftMarket() {
  const moves = [];
  for (const set of SET_ORDER) {
    const before = S.market[set] ?? 1;
    let m = before * (1 + gauss() * 0.06);
    if (Math.random() < 0.08) m *= Math.random() < 0.5 ? 0.75 : 1.35; // hype spike or crash
    S.market[set] = Math.round(clamp(m, 0.6, 1.6) * 100) / 100;
    const pct = Math.round((S.market[set] / before - 1) * 100);
    if (Math.abs(pct) >= 10) moves.push({ set, pct });
  }
  return moves;
}

// ---- Deliveries -----------------------------------------------------------------
export function order(item) {
  S.deliveries.push({ id: uid(), ...item });
}

// Unpack everything due today; returns labels for the morning report.
export function receiveDeliveries() {
  const due = S.deliveries.filter(d => d.arrive <= S.day);
  S.deliveries = S.deliveries.filter(d => d.arrive > S.day);
  for (const d of due) {
    if (d.kind === 'box') for (let i = 0; i < (d.qty || 1); i++) addBox(d.set, { stripped: d.stripped });
    if (d.kind === 'commons') S.commons += d.qty;
    if (d.kind === 'blanks') S.blanks += d.qty;
    if (d.kind === 'single') S.singles.push(d.card);
    if (d.kind === 'fake') S.forgeries.push(d.card);
  }
  return due;
}

// sealed (unweighed) | dud | heavy | open (awaiting crimp) | reseal
export function packCat(p) {
  if (p.resealed) return 'reseal';
  if (p.opened) return 'open';
  return p.sorted === 'none' ? 'sealed' : p.sorted;
}
export const packsOf = (set, cat) => S.packs.filter(p => p.set === set && packCat(p) === cat);
export function removePacks(list) {
  const ids = new Set(list.map(p => p.id));
  S.packs = S.packs.filter(p => !ids.has(p.id));
}

// ---- Derived ---------------------------------------------------------------
export const heatTier = (h = S.heat) => (h <= 25 ? 1 : h <= 50 ? 2 : h <= 80 ? 3 : 4);
export const hasUpg = id => !!S.upgrades[id];
export function artSkill() {
  let s = 30;
  for (const [id, bonus] of Object.entries(ART_BONUS)) if (hasUpg(id)) s += bonus;
  return Math.min(100, s);
}
export const unlockedSets = () => SET_ORDER.filter(s => SETS[s].unlock <= S.level);

// ---- Money & Heat ----------------------------------------------------------
export function earn(n, { online = false } = {}) {
  n = Math.round(n);
  if (online && heatTier() >= 2) {
    // Suspicious tier: ScamBay chargeback holds lock 20% of revenue.
    const lock = Math.round(n * 0.2);
    S.locked += lock;
    n -= lock;
  }
  S.cash += n;
  S.lifetime += n;
  S.today.revenue += n;
  S.totals.revenue += n;
  const lvl = LEVELS.filter(x => S.lifetime >= x).length;
  if (lvl > S.level) { S.level = lvl; bus.emit('levelup', lvl); }
  changed();
  return n;
}

export function spend(n) {
  n = Math.round(n);
  if (S.cash < n) return false;
  S.cash -= n;
  S.today.spent += n;
  changed();
  return true;
}

export function addHeat(n) {
  const before = heatTier();
  S.heat = clamp(Math.round(S.heat + n), 0, 100);
  S.today.heat += n;
  const after = heatTier();
  changed();
  bus.emit('heat', { n, before, after });
  if (S.heat >= 100) bus.emit('raid', { immediate: true });
}
