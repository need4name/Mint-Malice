// Sleight-of-Hand Tap Wheel: a needle spins, tap while it's inside the green arc.
import { sfx } from './audio.js';
import { haptic } from './ui.js';

export function swapWheel({ speed = 3.5, arcDeg = 40 } = {}) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'swap-overlay';
    ov.innerHTML = `<div class="swap-box">
      <h3>🃏 Sleight-of-Hand Swap</h3>
      <p>Tap anywhere when the needle is in the <b class="mint">GREEN ZONE</b></p>
      <canvas></canvas>
      <div class="swap-msg">TAP IN GREEN ZONE</div>
    </div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas');
    const msg = ov.querySelector('.swap-msg');
    const size = Math.min(260, window.innerWidth - 80);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr;
    cv.style.width = cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');

    const TAU = Math.PI * 2;
    const arc = (arcDeg * Math.PI) / 180;
    const start = Math.random() * TAU;
    let ang = start + Math.PI * (0.8 + Math.random() * 0.6);
    let last = performance.now();
    const t0 = last;
    let stopped = false, result = null;

    function draw() {
      const c = size / 2, R = size * 0.42;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.lineWidth = size * 0.09;
      ctx.strokeStyle = '#2a3140';
      ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = result === false ? '#ff3d6e' : '#3dffb0';
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(c, c, R, start, start + arc); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#8a93a6'; ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * R * 0.72, c + Math.sin(a) * R * 0.72);
        ctx.lineTo(c + Math.cos(a) * R * 0.8, c + Math.sin(a) * R * 0.8);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(ang) * R * 1.05, c + Math.sin(ang) * R * 1.05); ctx.stroke();
      ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(c, c, 9, 0, TAU); ctx.fill();
      ctx.font = `${size * 0.16}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🤲', c, c + size * 0.17);
    }
    function frame(t) {
      if (!stopped) ang += (speed * (t - last)) / 1000;
      last = t;
      draw();
      if (ov.isConnected) requestAnimationFrame(frame);
    }
    function tap(e) {
      e.preventDefault();
      if (stopped || performance.now() - t0 < 350) return;
      stopped = true;
      const rel = (((ang - start) % TAU) + TAU) % TAU;
      result = rel <= arc;
      msg.textContent = result ? 'SMOOTH. NOBODY SAW A THING.' : 'FUMBLED! CAUGHT RED-HANDED!';
      msg.className = `swap-msg ${result ? 'good' : 'bad'}`;
      if (result) { sfx.success(); haptic(30); } else { sfx.fail(); haptic([80, 40, 80], 'bad'); }
      setTimeout(() => { ov.remove(); resolve(result); }, 1100);
    }
    ov.addEventListener('touchstart', tap, { passive: false });
    ov.addEventListener('mousedown', tap);
    requestAnimationFrame(frame);
  });
}
