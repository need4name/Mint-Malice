// Normalises touchstart/touchmove/touchend (plus mouse for desktop testing) into
// pointer records in canvas-local CSS pixels. Each record carries x, y, dx, dy, dt.
export function attachInput(el, h) {
  const pts = new Map();
  const list = () => [...pts.values()];
  const rel = (cx, cy) => {
    const r = el.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  };

  function start(id, cx, cy) {
    const p = { id, ...rel(cx, cy), dx: 0, dy: 0, dt: 0, t: performance.now() };
    pts.set(id, p);
    h.down?.(p, list());
  }
  function move(id, cx, cy) {
    const p = pts.get(id);
    if (!p) return;
    const q = rel(cx, cy);
    const t = performance.now();
    p.dx = q.x - p.x; p.dy = q.y - p.y; p.dt = t - p.t;
    p.x = q.x; p.y = q.y; p.t = t;
    h.move?.(p, list());
  }
  function end(id) {
    const p = pts.get(id);
    if (!p) return;
    pts.delete(id);
    h.up?.(p, list());
  }

  const o = { passive: false };
  el.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) start(t.identifier, t.clientX, t.clientY); }, o);
  el.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) move(t.identifier, t.clientX, t.clientY); }, o);
  const te = e => { e.preventDefault(); for (const t of e.changedTouches) end(t.identifier); };
  el.addEventListener('touchend', te, o);
  el.addEventListener('touchcancel', te, o);

  let mouse = false;
  el.addEventListener('mousedown', e => { mouse = true; start('m', e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => { if (mouse) move('m', e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => { if (mouse) { mouse = false; end('m'); } });
  el.addEventListener('wheel', e => { if (h.wheel) { e.preventDefault(); h.wheel(e); } }, o);

  return { reset: () => pts.clear() };
}
