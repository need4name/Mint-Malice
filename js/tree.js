// 🌳 Underground Tree: upgrade branches, PR cover-ups, corrupt lawyer, settings.
import { S, bus, changed, spend, addHeat, hasUpg, heatTier } from './state.js';
import { UPGRADES } from './data.js';
import { toast, modal, money, esc, actions, bindActions } from './ui.js';
import { sfx, setMuted } from './audio.js';

let root;
let tab = 'equip';

export function initTree(el) {
  root = el;
  bus.on('change', () => { if (root.classList.contains('active')) render(); });
}
export const showTree = () => render();

export const prCost = () => 250 + 150 * S.level;
export const lawyerCost = () => 1200 + 400 * S.level;

async function buy(node) {
  const ok = await modal({
    title: `Unlock ${node.name}?`,
    body: `<p>${esc(node.desc)}</p><p class="big-num">${money(node.cost)}</p>`,
    buttons: [{ label: 'Confirm purchase', value: true, kind: 'mint' }, { label: 'Cancel', value: false, kind: 'ghost' }],
  });
  if (!ok) return;
  if (!spend(node.cost)) { toast('Not enough cash!', 'bad'); return; }
  S.upgrades[node.id] = true;
  if (node.id === 'hustle4') S.fallGuyUsed = false;
  sfx.success();
  toast(`Unlocked: ${node.name}`, 'good');
  changed();
}

function branchHtml(b, a) {
  return `<div class="tree">${b.tiers.map((n, i) => {
    const owned = hasUpg(n.id);
    const prev = i === 0 || hasUpg(b.tiers[i - 1].id);
    const lvlOk = S.level >= n.lvl;
    const avail = !owned && prev && lvlOk;
    const state = owned ? 'owned' : avail ? 'avail' : 'locked';
    const why = owned ? '✓ Owned' : !prev ? 'Requires previous tier' : !lvlOk ? `Store Level ${n.lvl}` : money(n.cost);
    const extra = n.id === 'hustle4' && owned ? (S.fallGuyUsed ? ' · Kevin already took the fall' : ' · Kevin is ready') : '';
    return `<button class="node ${state}" ${avail ? '' : 'disabled'} data-a="${a(() => buy(n))}">
      <span class="tier">T${i + 1}</span>
      <span class="grow"><b>${esc(n.name)}</b><small>${esc(n.desc)}${extra}</small></span>
      <span class="cost">${why}</span>
    </button>`;
  }).join('')}</div>`;
}

function servicesHtml(a) {
  const tier = heatTier();
  return `<div class="card">
      <h4>📰 PR Cover-up</h4>
      <p class="muted small">Bribe a local blogger & bury the reviews. −20% heat.${tier >= 3 ? ' <b class="bad">Severe tier: heat won’t cool overnight without this.</b>' : ''}</p>
      <button class="btn" ${S.heat > 0 ? '' : 'disabled'} data-a="${a(async () => {
        if (!spend(prCost())) return toast('Not enough cash!', 'bad');
        addHeat(-20);
        sfx.success();
        toast('Story buried. -20% heat', 'good');
      })}">Pay ${money(prCost())}</button>
    </div>
    <div class="card">
      <h4>⚖️ Corrupt Lawyer Retainer</h4>
      <p class="muted small">“Paul Goodmann” makes one Trading Standards raid go away on a technicality.</p>
      ${S.lawyer ? '<p class="good">✓ On retainer</p>' : `<button class="btn" data-a="${a(() => {
        if (!spend(lawyerCost())) return toast('Not enough cash!', 'bad');
        S.lawyer = true;
        changed();
        sfx.success();
        toast('Lawyer retained. Better call Paul.', 'good');
      })}">Retain ${money(lawyerCost())}</button>`}
    </div>`;
}

function settingsHtml(a) {
  return `<div class="card">
      <h4>🔊 Sound</h4>
      <button class="btn" data-a="${a(() => { S.muted = !S.muted; setMuted(S.muted); changed(); })}">${S.muted ? 'Unmute' : 'Mute'}</button>
    </div>
    <div class="card">
      <h4>📖 How to scam</h4>
      <ol class="howto">
        <li><b>Bench → Weigh:</b> drag packs onto the scale. Heavy (≈21.45g) hide foil hits.</li>
        <li><b>Crack:</b> swipe across a heavy pack’s crimp, pocket the hit.</li>
        <li><b>Crimp:</b> drag the iron along the seam at a steady speed to reseal.</li>
        <li><b>Forge:</b> align foil, emboss, age the edges. Grade ≥ 90% fools the pros.</li>
        <li><b>Shop / ScamBay:</b> sell to the right mark. Kids never check; streamers always do.</li>
        <li>Watch the 🔥 Heat. Above 80% Trading Standards raid you at closing.</li>
      </ol>
    </div>
    <div class="card">
      <h4>🗑️ Burn the evidence</h4>
      <button class="btn danger" data-a="${a(async () => {
        const ok = await modal({ title: 'Start a new game?', body: '<p>Your shop, stock and upgrades will be wiped.</p>', buttons: [{ label: 'Wipe everything', value: true, kind: 'danger' }, { label: 'Cancel', value: false, kind: 'ghost' }] });
        if (ok) bus.emit('newgame');
      })}">New game</button>
    </div>
    <p class="muted center small">Stats: ${S.totals.days} days · ${money(S.totals.revenue)} revenue · ${S.totals.scams} scams · caught ${S.totals.caught}×</p>`;
}

function render() {
  const { A, a } = actions();
  const t = (id, label) => `<button class="${tab === id ? 'on' : ''}" data-a="${a(() => { tab = id; render(); })}">${label}</button>`;
  const b = UPGRADES.find(u => u.branch === tab);
  const body = b ? branchHtml(b, a) : tab === 'services' ? servicesHtml(a) : settingsHtml(a);
  root.innerHTML = `<div class="hub-head"><h2>🌳 Underground</h2><span class="sub">${money(S.cash)} to spend</span></div>
    <div class="seg">${UPGRADES.map(u => t(u.branch, `${u.icon} ${u.tab}`)).join('')}${t('services', '🕴️ Fixers')}${t('settings', '⚙️')}</div>
    ${b ? `<h3>${b.icon} ${b.name}</h3>` : ''}
    ${body}`;
  bindActions(root, A);
}
