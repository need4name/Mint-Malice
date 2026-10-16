// Tiny Web Audio synth. Safari keeps the context suspended until a user gesture,
// so unlockAudio() is called from the first touchend/click.
let ctx = null;
let muted = false;

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  // Playing a silent buffer inside the gesture fully unlocks iOS WebKit.
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}
export const setMuted = m => { muted = m; };
export const audioReady = () => !!ctx && ctx.state === 'running';

function tone(freq, dur = 0.1, type = 'square', vol = 0.06, slide = 0, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur = 0.1, vol = 0.05, freq = 2000) {
  if (!ctx || muted) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

export const sfx = {
  tap: () => tone(700, 0.04, 'square', 0.03),
  cash: () => { tone(988, 0.08, 'square', 0.05); tone(1318, 0.14, 'square', 0.05, 0, 0.08); },
  success: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.07, 0, i * 0.07)),
  fail: () => { tone(260, 0.3, 'sawtooth', 0.07, -160); tone(180, 0.35, 'sawtooth', 0.05, -80, 0.1); },
  scale: () => tone(440, 0.06, 'sine', 0.06),
  sizzle: () => noise(0.06, 0.05, 3200),
  rip: () => noise(0.28, 0.14, 1400),
  rub: () => noise(0.04, 0.03, 700),
  thump: () => tone(70, 0.12, 'sine', 0.2, -30),
  alarm: () => { for (let i = 0; i < 4; i++) { tone(880, 0.18, 'square', 0.05, 0, i * 0.4); tone(660, 0.18, 'square', 0.05, 0, i * 0.4 + 0.2); } },
};
