// Guided first-play tutorial: a coach strip under the HUD walks the player through
// one full scam loop (sell → weigh → crack → crimp → resell), advancing on real game events.
import { S, bus, changed, packCat, addBox, uid, heatTier } from './state.js';
import { HEAVY, LEVELS } from './data.js';
import { $, modal, money } from './ui.js';
import { sfx } from './audio.js';

let view = 'shop';
let base = null; // counters snapshotted when the current step starts
let goTo = () => {};

const count = {
  served: () => S.today.served,
  readings: () => S.packs.filter(p => p.reading != null).length,
  sorted: () => S.packs.filter(p => p.sorted !== 'none').length,
  opened: () => S.packs.filter(p => p.opened).length + S.singles.length,
  resealed: () => S.packs.filter(p => p.resealed).length,
  scams: () => S.totals.scams + S.totals.caught,
  day: () => S.day,
};
const snapshot = () => Object.fromEntries(Object.entries(count).map(([k, f]) => [k, f()]));

function frontCustomer(want) {
  if (want === 'honest' && !S.packs.some(p => p.set === 'choke' && packCat(p) === 'sealed')) addBox('choke');
  const c = S.queue[0];
  if (c && c.kind === 'buy' && c.arch === 'timmy' && c.want === 'pack' && c.qty === 1 && c.tut === want) return;
  const set = want === 'reseal' ? (S.packs.find(p => p.resealed)?.set || 'choke') : 'choke';
  S.queue.unshift({ id: uid(), kind: 'buy', arch: 'timmy', set, name: want === 'reseal' ? 'Tiny Tim' : 'Little Tyler', want: 'pack', qty: 1, tut: want });
}

// The first pack in the tray is always a heavy one, so the player gets a hit.
function ensurePacks() {
  let sealed = S.packs.filter(p => packCat(p) === 'sealed');
  if (sealed.length < 2) { addBox('choke'); sealed = S.packs.filter(p => packCat(p) === 'sealed'); }
  const first = sealed[0];
  first.hit = true;
  first.w = HEAVY;
  first.reading = null;
  first.tut = true; // reads exactly heavy on the scale, no noise
  if (S.commons < 1) S.commons = 5;
}

const STEPS = [
  {
    title: 'Serve your first customer',
    text: 'Customers queue at the counter. Each offer shows the price you get and the risk of being caught. Tap the offer marked <b>No risk</b> to sell honestly.',
    view: 'shop', target: '.offer', offer: 'No risk',
    setup: () => frontCustomer('honest'),
    done: b => count.served() > b.served,
  },
  {
    title: 'Head to the backroom',
    text: 'Honest sales barely cover rent. The real money is hidden inside the packs. Tap <b>🧪 BENCH</b>.',
    target: '#tabs [data-view=bench]',
    done: () => view === 'bench',
  },
  {
    title: 'Weigh a pack',
    text: 'Packs with a valuable foil card weigh more. <b>Drag the first pack</b> from the tray at the bottom onto the scale.',
    view: 'bench', station: 'weigh', target: '#bench-tabs [data-st=weigh]',
    setup: ensurePacks,
    done: b => count.readings() > b.readings,
  },
  {
    title: 'Sort it',
    text: `Around <b>${HEAVY}g = heavy</b> (has a hit). Around <b>20.9g = dud</b>. This one reads heavy, so <b>drag it into the 💎 HEAVY bin</b>.`,
    view: 'bench', station: 'weigh',
    done: b => count.sorted() > b.sorted,
  },
  {
    title: 'Crack it open',
    text: 'Tap <b>✂️ Crack</b>, then <b>swipe sideways across the top</b> of the pack to tear it open. You keep the valuable card.',
    view: 'bench', target: '#bench-tabs [data-st=crack]',
    done: b => count.opened() > b.opened,
  },
  {
    title: 'Reseal the evidence',
    text: 'Now make the pack look untouched. Tap <b>🔥 Crimp</b> and <b>drag the iron along the seam</b> at a steady pace, about 1–2 seconds end to end. Too fast leaves it loose, too slow burns it.',
    view: 'bench', target: '#bench-tabs [data-st=crimp]',
    done: b => count.resealed() > b.resealed,
  },
  {
    title: 'Sell the dud',
    text: 'Back to <b>🏪 SHOP</b>. A kid wants a pack. Offer them your <b>Resealed pack</b>. Kids almost never notice.',
    target: () => (view === 'shop' ? '.offer' : '#tabs [data-view=shop]'), offer: 'Resealed',
    setup: () => frontCustomer('reseal'),
    done: b => count.scams() > b.scams,
  },
  {
    title: 'Watch your Heat',
    text: 'That was your first scam. Each time someone catches you, <b>🔥 Heat</b> rises (top right). Heat cools a little each night. <b>At 100% you’re raided</b> and can lose everything.',
    target: '#hud-heat-wrap', button: 'Got it',
  },
  {
    title: 'Grow the shop',
    text: `The card you pulled is worth money. Sell it to a collector here or list it on <b>📱 WEB</b>. Spend profits in <b>🌳 TREE</b> on upgrades. Later, try forging fake cards on the Bench.`,
    button: 'Got it',
  },
  {
    title: 'End the day',
    text: 'When the queue is empty (or you’re done), tap <b>Close Shop</b> to end the day. Rent is due every night.',
    view: 'shop', target: '.thumb-bar .btn',
    done: b => count.day() > b.day,
  },
];

// ---- Rendering ---------------------------------------------------------------
function strip() { return $('#coach'); }

function clearGlow() { document.querySelectorAll('.tut-glow').forEach(el => el.classList.remove('tut-glow')); }

function glow() {
  clearGlow();
  const st = STEPS[S.tut?.step];
  if (!S.tut?.active || !st?.target) return;
  const sel = typeof st.target === 'function' ? st.target() : st.target;
  let els = [...document.querySelectorAll(sel)];
  if (sel === '.offer' && st.offer) els = els.filter(o => o.textContent.includes(st.offer)).slice(0, 1);
  els.forEach(el => el.classList.add('tut-glow'));
}

function render() {
  const el = strip();
  if (!el) return;
  const st = STEPS[S.tut.step];
  if (S.tut.done || !S.tut.active || !st) {
    el.hidden = true;
    clearGlow();
    window.dispatchEvent(new Event('resize'));
    return;
  }
  const wrongView = st.view && st.view !== view;
  el.hidden = false;
  el.innerHTML = `<div class="coach-head"><span class="coach-step">Tutorial ${S.tut.step + 1}/${STEPS.length}</span>
      <b>${st.title}</b><button class="coach-skip" type="button">Skip</button></div>
    <p>${st.text}</p>
    ${wrongView ? `<button class="btn small coach-go" type="button">Take me there</button>` : ''}
    ${st.button ? `<button class="btn small mint coach-next" type="button">${st.button}</button>` : ''}`;
  el.querySelector('.coach-skip').onclick = skip;
  el.querySelector('.coach-next')?.addEventListener('click', () => { sfx.tap(); advance(); });
  el.querySelector('.coach-go')?.addEventListener('click', () => { sfx.tap(); goTo(st.view, st.station); });
  // a target in the step text may need a moment to exist after a hub re-render
  requestAnimationFrame(glow);
  window.dispatchEvent(new Event('resize'));
}

// ---- Flow ------------------------------------------------------------------------
function enter() {
  const st = STEPS[S.tut.step];
  st?.setup?.();
  base = snapshot();
  changed();
  render();
}

function advance() {
  sfx.success();
  S.tut.step++;
  if (S.tut.step >= STEPS.length) { finish(); return; }
  enter();
}

function check() {
  if (!S.tut?.active || S.tut.done) return;
  const st = STEPS[S.tut.step];
  if (!st) return;
  if (!base) base = snapshot();
  if (st.done && st.done(base)) { advance(); return; }
  render();
}

async function finish() {
  S.tut.done = true;
  S.tut.active = false;
  changed();
  render();
  await modal({
    title: '🎓 You know the hustle',
    body: `<p>Your goal: grow from <b>Store Level 1 to 5</b> by earning revenue. Each level unlocks new card sets and upgrades.</p>
      <p>The faster you scam, the faster you grow, but the hotter it gets. Keep 🔥 Heat under 100%.</p>
      <p class="muted">Replay the tutorial anytime from the <b>?</b> button.</p>`,
    buttons: [{ label: 'Let’s make some money', value: true, kind: 'mint' }],
  });
}

async function skip() {
  sfx.tap();
  S.tut.active = false;
  S.tut.done = true;
  changed();
  render();
}

export function startTutorial() {
  S.tut = { step: 0, active: true, done: false };
  enter();
}

// The "point of the game" briefing shown to new players.
export async function intro() {
  const go = await modal({
    title: 'Welcome to Mint & Malice',
    body: `<p>You run a struggling trading-card shop with <b>$500</b>. Sealed booster packs sometimes hide a valuable foil card.</p>
      <p><b>The scam:</b> find those packs, steal the card, reseal the pack and sell it anyway.</p>
      <p><b>The goal:</b> earn enough to grow your store from <b>Level 1 to Level 5</b>, without letting 🔥 Heat reach 100%.</p>`,
    buttons: [
      { label: 'Show me how (2 min)', value: true, kind: 'mint' },
      { label: 'I’ll figure it out', value: false, kind: 'ghost' },
    ],
  });
  if (go) startTutorial();
  else { S.tut = { step: 0, active: false, done: true }; changed(); }
}

// Quick reference behind the HUD "?" button.
export async function help() {
  const next = LEVELS[S.level];
  const v = await modal({
    title: 'How to play',
    body: `<p><b>Goal:</b> reach Store Level 5 by earning revenue${next ? ` (next level at ${money(next)} lifetime, you have ${money(S.lifetime)})` : ''}. Don’t let 🔥 Heat hit 100%.</p>
      <ol class="howto">
        <li><b>🧪 Bench → Weigh:</b> drag packs onto the scale. ~${HEAVY}g = heavy (hit inside).</li>
        <li><b>Crack:</b> swipe across a heavy pack’s top to steal the card.</li>
        <li><b>Crimp:</b> drag the iron along the seam steadily to reseal it.</li>
        <li><b>🏪 Shop:</b> sell resealed packs to kids, stolen cards to collectors.</li>
        <li><b>📱 Web:</b> buy cheap boxes and sell anything online.</li>
        <li><b>🌳 Tree:</b> buy upgrades; pay for PR when Heat gets high.</li>
        <li><b>Forge:</b> fake rare cards. Grade 90%+ fools everyone.</li>
      </ol>
      <p class="muted">Heat now: ${S.heat}% (${['', 'safe', 'suspicious', 'severe', 'critical'][heatTier()]}).</p>`,
    buttons: [
      { label: 'Replay tutorial', value: 'tut', kind: 'ghost' },
      { label: 'Close', value: false, kind: 'mint' },
    ],
  });
  if (v === 'tut') startTutorial();
}

export function initTutorial({ navigate }) {
  goTo = navigate;
  bus.on('change', check);
  bus.on('nav', name => { view = name; check(); });
}

export const tutorialPending = () => !S.tut || (!S.tut.done && !S.tut.active);
export const resumeTutorial = () => { if (S.tut?.active && !S.tut.done) enter(); };
