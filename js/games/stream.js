// 🔴 Stream patter: chat scrolls while packs are ripped live. Tap ❤️ on hype to keep viewers
// happy, answer questions, and delete suspicious comments before they spread.
import { play } from './overlay.js';
import { esc } from '../ui.js';
import { sfx } from '../audio.js';
import { pick, rollCard } from '../state.js';

const VIEWERS = ['ripz4days', 'holo_hank', 'mintyfresh', 'packgoblin', 'lurker42', 'chase_card_chad', 'salty_sam', 'bigspender', 'grail_gal', 'sleeve_steve'];
const HYPE = ['LET’S GOOO', 'rip it!!', 'W break', 'next pack next pack', '🔥🔥🔥', 'god pack incoming'];
const QS = ['what set is this?', 'how much per pack?', 'do you ship to Ireland?', 'is this 1st edition?', 'shop open tomorrow?'];
const SUS = ['that seal looks crimped 👀', 'why is that pack so flat?', 'RESEALED?? clipping this', 'the wrapper is wrinkled lol', 'bro these are searched'];

// Resolves { hype 0–100, exposure 0–100, busted }.
export function streamBreak({ set, packs, susRate }) {
  return play({ title: '🔴 LIVE on ScamBay', sub: 'Tap ❤️ on hype, 💬 to answer questions, 🗑️ to delete suspicious comments before they catch on.', canvas: false }, (g, done) => {
    let hype = 40, exposure = 0, i = 0, nextPack = 1200, nextMsg = 400, viewers = 60 + Math.floor(Math.random() * 80);
    const t0 = performance.now();
    const msgs = [];
    g.dom.innerHTML = `<div class="stream-game">
      <div class="stream-top"><span class="live">● LIVE</span><span class="viewers"></span></div>
      <div class="meters"><div><small>Hype</small><div class="bar"><i class="hype"></i></div></div><div><small>Exposure</small><div class="bar bad"><i class="expo"></i></div></div></div>
      <div class="ripping"></div>
      <div class="chat2"></div></div>`;
    const chat = g.dom.querySelector('.chat2');

    const add = (kind, who, txt) => {
      const m = { kind, born: performance.now(), done: false };
      const el = document.createElement('div');
      el.className = `cmsg ${kind}`;
      const act = kind === 'hype' ? '❤️' : kind === 'q' ? '💬' : kind === 'sus' ? '🗑️' : '';
      el.innerHTML = `<span><b>${esc(who)}</b> ${esc(txt)}</span>${act ? `<button type="button">${act}</button>` : ''}`;
      el.querySelector('button')?.addEventListener('click', () => {
        if (m.done) return;
        m.done = true;
        el.classList.add('handled');
        if (kind === 'hype') { hype = Math.min(100, hype + 6); sfx.tap(); }
        if (kind === 'q') { hype = Math.min(100, hype + 3); viewers += 5; sfx.tap(); }
        if (kind === 'sus') { el.querySelector('span').textContent = 'message deleted'; sfx.scale(); }
      });
      m.el = el;
      chat.prepend(el);
      msgs.push(m);
      while (chat.children.length > 9) chat.lastChild.remove();
    };
    g.buttons([{ label: 'End stream early', kind: 'ghost', onClick: () => finish() }]);
    const finish = () => done({ hype, exposure, busted: exposure >= 100, viewers });

    g.loop(() => {
      const now = performance.now(), el = now - t0;
      if (el > nextPack && i < packs.length) {
        const p = packs[i++];
        const hit = !p.opened && p.hit;
        g.dom.querySelector('.ripping').innerHTML = hit
          ? `<b class="good">Pack ${i}/${packs.length}: ${esc(rollCard(set).name)}!! 💎</b>`
          : `Pack ${i}/${packs.length}: commons`;
        if (hit) { hype = Math.min(100, hype + 15); sfx.success(); add('hype', pick(VIEWERS), 'NO WAYYYY 🔥🔥'); }
        nextPack = el + 1500;
      }
      if (i >= packs.length && el > nextPack) { finish(); return; }
      if (el > nextMsg) {
        const r = Math.random();
        if (r < susRate) add('sus', pick(VIEWERS), pick(SUS));
        else if (r < susRate + 0.25) add('q', pick(VIEWERS), pick(QS));
        else add('hype', pick(VIEWERS), pick(HYPE));
        nextMsg = el + 550 + Math.random() * 450;
      }
      for (const m of msgs) {
        if (m.done) continue;
        const age = now - m.born;
        if (m.kind === 'sus' && age > 2600) { m.done = true; exposure += 22; m.el.classList.add('spread'); sfx.fail(); }
        if (m.kind !== 'sus' && age > 3500) { m.done = true; if (m.kind === 'hype') hype = Math.max(0, hype - 2); }
      }
      hype = Math.max(0, hype - 0.02);
      if (exposure >= 100) { finish(); return; }
      g.dom.querySelector('.viewers').textContent = `👀 ${viewers}`;
      g.dom.querySelector('.hype').style.width = `${hype}%`;
      g.dom.querySelector('.expo').style.width = `${Math.min(100, exposure)}%`;
    });
  });
}
