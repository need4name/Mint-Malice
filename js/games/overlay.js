// Shared full-screen stage for minigames: title, canvas, HUD line, buttons, touch input
// and a frame loop. Each game builds on this and resolves a Promise with its result.
import { attachInput } from '../input.js';
import { sfx } from '../audio.js';

export function overlay({ title, sub = '', canvas = true, height = 0.56, cls = '' }) {
  const el = document.createElement('div');
  el.className = `game-overlay ${cls}`;
  el.innerHTML = `<div class="game-box" role="dialog" aria-modal="true">
      <div class="game-head"><h3></h3><p class="game-sub"></p></div>
      ${canvas ? '<div class="game-stage"><canvas></canvas></div>' : '<div class="game-dom"></div>'}
      <div class="game-hud"></div>
      <div class="game-btns"></div>
    </div>`;
  el.querySelector('h3').textContent = title;
  el.querySelector('.game-sub').innerHTML = sub;
  document.body.appendChild(el);

  const g = {
    el,
    dom: el.querySelector('.game-dom'),
    W: 0, H: 0, ctx: null, closed: false, t0: performance.now(),
    hud(html) { el.querySelector('.game-hud').innerHTML = html; },
    sub(html) { el.querySelector('.game-sub').innerHTML = html; },
    buttons(list) {
      const row = el.querySelector('.game-btns');
      row.innerHTML = '';
      for (const b of list) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn ${b.kind || ''}`;
        btn.innerHTML = b.label;
        btn.disabled = !!b.disabled;
        btn.onclick = () => { if (!g.closed) { sfx.tap(); b.onClick(); } };
        row.appendChild(btn);
      }
    },
    loop(fn) {
      const step = t => {
        if (g.closed) return;
        if (g.ctx) {
          g.ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
          g.ctx.clearRect(0, 0, g.W, g.H);
        }
        fn(g.ctx, t, (t - g.t0) / 1000);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    input(handlers) { if (g.canvas) attachInput(g.canvas, handlers); },
    close() { g.closed = true; el.classList.add('out'); setTimeout(() => el.remove(), 250); },
  };

  if (canvas) {
    const cv = el.querySelector('canvas');
    const W = Math.min(window.innerWidth - 24, 480);
    const H = Math.min(window.innerHeight * height, 460);
    g.dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(W * g.dpr);
    cv.height = Math.round(H * g.dpr);
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
    g.canvas = cv;
    g.ctx = cv.getContext('2d');
    g.W = W;
    g.H = H;
  }
  return g;
}

// Run a game: `setup(g, done)` wires everything; `done(result)` closes the stage and resolves.
export function play(opts, setup) {
  return new Promise(resolve => {
    const g = overlay(opts);
    let finished = false;
    const done = result => {
      if (finished) return;
      finished = true;
      g.close();
      resolve(result);
    };
    setup(g, done);
  });
}

export const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
