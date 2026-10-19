// Boot, navigation hubs, HUD, day cycle, heat escalation and raids.
import { S, bus, load, newGame, wipe, save, changed, heatTier, hasUpg, blankDay } from './state.js';
import { SETS, SET_ORDER } from './data.js';
import { $, toast, modal, haptic, money } from './ui.js';
import { sfx, unlockAudio, setMuted } from './audio.js';
import { initShop, showShop, genCustomers } from './shop.js';
import { initBench, showBench, hideBench, selectStation } from './bench.js';
import { initWeb, showWeb, newDayListings } from './scambay.js';
import { initTree, showTree } from './tree.js';
import { initTutorial, intro, help, tutorialPending, resumeTutorial } from './tutorial.js';

const HUBS = {
  shop: { show: showShop },
  bench: { show: showBench, hide: hideBench },
  web: { show: showWeb },
  tree: { show: showTree },
};
let current = 'shop';

const TIER_INFO = {
  1: { name: 'SAFE ZONE', msg: '' },
  2: { name: 'SUSPICIOUS', msg: 'ScamBay holds 20% of revenue · refund demands at the counter' },
  3: { name: 'SEVERE THREAT', msg: 'Streamer exposé live · foot traffic −50% · heat won’t cool without PR bribes' },
  4: { name: 'CRITICAL RAID', msg: 'Trading Standards will raid at closing unless you cool off or lawyer up' },
};

function go(name, force = false) {
  if (name === current && !force) return;
  HUBS[current].hide?.();
  current = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view === name ? 'page' : 'false'));
  HUBS[name].show();
  bus.emit('nav', name);
}

function hud() {
  const tier = heatTier();
  $('#hud-level').textContent = S.level;
  $('#hud-cash').textContent = money(S.cash);
  $('#hud-heat').textContent = `${S.heat}%`;
  $('#hud-day').textContent = `Day ${S.day}`;
  $('#heatbar i').style.width = `${S.heat}%`;
  document.body.dataset.tier = tier;
  const banner = $('#banner');
  banner.hidden = tier === 1;
  banner.innerHTML = tier === 1 ? '' : `<b>${TIER_INFO[tier].name}</b> · ${TIER_INFO[tier].msg}`;
}

function onHeat({ n, before, after }) {
  const el = $('#hud-heat-wrap');
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth;
  el.classList.add(n > 0 ? 'flash-up' : 'flash-down');
  if (after > before) {
    haptic([40, 30, 40], 'bad');
    if (after === 3) toast('📹 A streamer’s exposé dropped! Foot traffic halved. Buy PR bribes in the Underground.', 'bad', 4000);
    if (after === 4) { sfx.alarm(); toast('🚨 Trading Standards are circling. Raid at closing time!', 'bad', 4000); }
  }
}

async function onLevel(lvl) {
  sfx.success();
  const sets = SET_ORDER.filter(s => SETS[s].unlock === lvl).map(s => SETS[s]);
  await modal({
    title: `⭐ STORE LEVEL ${lvl}!`,
    body: `<p>Word of your “amazing pull rates” is spreading.</p>
      ${sets.map(s => `<p>🆕 <b>${s.name}</b> unlocked — ${s.blurb}</p>`).join('')}
      <p class="muted">New upgrade tiers available in the Underground. More collectors and streamers visit.</p>`,
    buttons: [{ label: 'Let’s go', value: true, kind: 'mint' }],
  });
}

let raiding = false;
async function raid() {
  if (raiding || S.over) return;
  raiding = true;
  sfx.alarm();
  haptic([200, 100, 200, 100, 200], 'bad');
  const title = '🚨 TRADING STANDARDS RAID';
  if (S.lawyer) {
    S.lawyer = false;
    S.heat = 45;
    changed();
    await modal({ title, body: '<p>Officers storm the backroom… then your lawyer, Paul Goodmann, waves a warrant typo in their faces.</p><p><b>Charges dropped.</b> Heat reset to 45%. The retainer is spent.</p>', cls: 'bad' });
  } else if (hasUpg('hustle4') && !S.fallGuyUsed) {
    S.fallGuyUsed = true;
    S.heat = 40;
    S.forgeries = [];
    changed();
    await modal({ title, body: '<p>“It was all Kevin!” Your rogue stockroom employee is led away in cuffs, clutching the forgery kit.</p><p>All forgeries confiscated. Heat reset to 40%. Kevin will not be doing that again.</p>', cls: 'bad' });
  } else {
    const fine = Math.max(1500, Math.round(S.cash * 0.5));
    const seized = S.forgeries.length + S.packs.filter(p => p.resealed).length;
    S.forgeries = [];
    S.packs = S.packs.filter(p => !p.resealed);
    if (S.cash >= fine) {
      S.cash -= fine;
      S.heat = 60;
      changed();
      await modal({ title, body: `<p>Officers seize ${seized} counterfeit items and slap you with a <b>${money(fine)}</b> fine.</p><p>Heat drops to 60%. They’ll be back.</p>`, cls: 'bad' });
    } else {
      raiding = false;
      await gameOver(`Trading Standards fined you ${money(fine)} and you couldn’t pay. The shop is boarded up.`);
      return;
    }
  }
  raiding = false;
}

async function gameOver(reason) {
  S.over = true;
  save(true);
  sfx.fail();
  await modal({
    title: '💀 GAME OVER',
    body: `<p>${reason}</p>
      <ul class="stats"><li><span>Days in business</span><b>${S.day}</b></li><li><span>Store level</span><b>${S.level}</b></li>
      <li><span>Lifetime revenue</span><b>${money(S.totals.revenue)}</b></li><li><span>Scams pulled</span><b>${S.totals.scams}</b></li><li><span>Times caught</span><b>${S.totals.caught}</b></li></ul>`,
    buttons: [{ label: 'Open a new shop', value: true, kind: 'mint' }],
    cls: 'bad',
  });
  restart();
}

function restart() {
  wipe();
  newGame();
  setMuted(S.muted);
  S.queue = genCustomers();
  newDayListings();
  changed();
  go('shop', true);
  intro();
}

async function endDay() {
  if (S.over || raiding) return;
  if (S.queue.length) {
    const ok = await modal({
      title: 'Close early?',
      body: `<p>${S.queue.length} customer${S.queue.length > 1 ? 's are' : ' is'} still waiting. They’ll leave grumbling.</p>`,
      buttons: [{ label: 'Close shop', value: true, kind: 'danger' }, { label: 'Keep serving', value: false, kind: 'ghost' }],
    });
    if (!ok) return;
  }
  const t = S.today;
  const rent = 40 * S.level;
  S.cash -= rent;
  const tierBefore = heatTier();
  const cool = Math.min(S.heat, tierBefore >= 3 ? 0 : hasUpg('hustle2') ? 8 : 4);
  S.heat -= cool;
  let released = 0;
  if (heatTier() === 1 && S.locked > 0) { released = S.locked; S.cash += released; S.lifetime += released; S.locked = 0; }
  changed();

  if (S.heat > 80) await raid();
  if (S.over) return;

  const broke = S.cash < 0 && !S.packs.length && !S.singles.length && !S.forgeries.length;
  if (broke) { await gameOver('You’re in debt with nothing left to sell. The landlord changes the locks.'); return; }

  await modal({
    title: `🌙 Day ${S.day} closed`,
    body: `<ul class="stats">
      <li><span>Revenue</span><b class="good">${money(t.revenue)}</b></li>
      <li><span>Spent (stock, upgrades, bribes)</span><b>${money(t.spent)}</b></li>
      <li><span>Rent</span><b class="bad">−${money(rent)}</b></li>
      <li><span>Customers served</span><b>${t.served}</b></li>
      <li><span>Scams pulled</span><b>${t.scams}</b></li>
      <li><span>Heat today</span><b class="${t.heat > 0 ? 'bad' : 'good'}">${t.heat > 0 ? '+' : ''}${Math.round(t.heat)}%</b></li>
      <li><span>Overnight cooling</span>${cool ? `<b class="good">−${cool}%</b>` : tierBefore >= 3 ? '<b class="bad">none at Severe — buy PR</b>' : '<b>—</b>'}</li>
      ${released ? `<li><span>ScamBay released held funds</span><b class="good">${money(released)}</b></li>` : ''}
      <li><span>Cash</span><b class="${S.cash < 0 ? 'bad' : ''}">${money(S.cash)}</b></li></ul>`,
    buttons: [{ label: `Open Day ${S.day + 1} ☀️`, value: true, kind: 'mint' }],
  });

  S.day++;
  S.totals.days++;
  S.today = blankDay();
  S.queue = genCustomers();
  newDayListings();
  changed();
  go('shop', true);
}

function boot() {
  load();
  setMuted(S.muted);
  if (!S.queue) S.queue = genCustomers();

  initShop($('#view-shop'));
  initBench($('#view-bench'));
  initWeb($('#view-web'));
  initTree($('#view-tree'));
  initTutorial({ navigate: (view, station) => { go(view); if (station) selectStation(station); } });

  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => { sfx.tap(); go(b.dataset.view); }));
  bus.on('change', hud);
  bus.on('heat', onHeat);
  bus.on('levelup', onLevel);
  bus.on('raid', raid);
  bus.on('endday', endDay);
  bus.on('newgame', restart);
  $('#hud-help').addEventListener('click', () => { sfx.tap(); help(); });

  // Safari: block pinch-zoom of the page itself (canvas handles its own pinch).
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  // Unlock Web Audio on the first real gesture (and resume after backgrounding).
  ['touchend', 'mousedown', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

  hud();
  go('shop', true);
  save();

  const splash = $('#splash');
  splash.addEventListener('click', () => {
    unlockAudio();
    sfx.cash();
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 400);
    if (S.over) gameOver('Your last shop was shut down.');
    else if (tutorialPending()) intro();
    else resumeTutorial();
  }, { once: true });
}

boot();
