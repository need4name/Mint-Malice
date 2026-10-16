// Mutable game state, persistence, and the small event bus every hub listens to.
import { SETS, SET_ORDER, HEAVY, LIGHT, PACKS_PER_BOX, HIT_RATE, LEVELS, ART_BONUS } from './data.js';

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
export function makePack(set, hit = Math.random() < HIT_RATE) {
  return {
    id: uid(), set, hit,
    w: (hit ? HEAVY : LIGHT) + gauss() * 0.012,
    reading: null, sorted: 'none', opened: false, resealed: false, crimp: null, short: false,
  };
}
export function addBox(set, opts = {}) {
  for (let i = 0; i < PACKS_PER_BOX; i++) S.packs.push(makePack(set, opts.stripped ? false : undefined));
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
