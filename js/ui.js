// DOM helpers: toasts, modals, haptics with visual/auditory fallback.
import { sfx } from './audio.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Render helper: `const A = []; const a = fn => (A.push(fn), A.length - 1);`
// then `<button data-a="${a(() => ...)}">` and bindActions(root, A).
export function actions() {
  const A = [];
  const a = fn => (A.push(fn), A.length - 1);
  return { A, a };
}
export function bindActions(root, A) {
  root.querySelectorAll('[data-a]').forEach(el => {
    el.onclick = e => { if (el.disabled) return; sfx.tap(); A[+el.dataset.a](e); };
  });
}

export function toast(msg, kind = 'info', ms = 2600) {
  const box = document.getElementById('toasts');
  if (!box) return;
  // Sit just below the HUD and any banner or tutorial strip, so toasts never hide them.
  const strips = ['hud', 'banner', 'coach'].map(id => document.getElementById(id)).filter(el => el && !el.hidden);
  if (strips.length) box.style.top = `${Math.max(...strips.map(el => el.getBoundingClientRect().bottom)) + 8}px`;
  while (box.children.length >= 3) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

export function modal({ title, body = '', buttons = [{ label: 'OK', value: true }], cls = '' }) {
  return new Promise(resolve => {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true"><h3></h3><div class="modal-body"></div><div class="modal-btns"></div></div>`;
    wrap.querySelector('h3').textContent = title;
    const b = wrap.querySelector('.modal-body');
    if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
    const row = wrap.querySelector('.modal-btns');
    for (const btn of buttons) {
      const el = document.createElement('button');
      el.className = `btn ${btn.kind || ''}`;
      el.innerHTML = btn.label;
      el.disabled = !!btn.disabled;
      el.onclick = () => { sfx.tap(); wrap.remove(); resolve(btn.value); };
      row.appendChild(el);
    }
    root.appendChild(wrap);
  });
}

// navigator.vibrate is missing on iOS Safari, so always pair it with a screen pulse
// and fall back to a low audio thump.
export function haptic(pattern = 20, kind = '') {
  let buzzed = false;
  try { if (navigator.vibrate) buzzed = navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
  if (!buzzed && kind) sfx.thump();
  const p = document.getElementById('pulse');
  if (!p) return;
  p.className = '';
  void p.offsetWidth;
  p.className = `on ${kind}`;
}
