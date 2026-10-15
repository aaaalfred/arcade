/* Lógica pura de Tornillos de Madera (sin DOM). Funciona en navegador y en Node.
 *
 * Nivel: { id, slots, reserve, queue:[color...], plates:[{pts:[[x,y]..], layer}], screws:[{p,x,y,c}] }
 *  - Una placa con capa mayor tapa a las de capa menor. Un tornillo solo se puede quitar si
 *    ningún polígono de una placa viva de capa superior contiene su centro.
 *  - Cajas: cada caja tiene color y capacidad BOX_CAP. Hay `slots` cajas activas a la vez; al llenarse
 *    entra la siguiente de la cola. Un tornillo va a su caja activa si existe y hay hueco; si no, a la
 *    reserva (limitada a `reserve`). Al entrar una caja nueva, absorbe los tornillos de la reserva de su color.
 *  - Victoria: no quedan placas. Derrota: reserva llena y ningún tornillo libre cabe en una caja activa. */
(function (root) {
  "use strict";
  const BOX_CAP = 3;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pointInPoly(x, y, pts) {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  }

  function newState(lv) {
    const plateLeft = lv.plates.map(() => 0);
    lv.screws.forEach((s) => plateLeft[s.p]++);
    const st = { removed: lv.screws.map(() => false), plateLeft, boxes: [], queue: lv.queue.slice(), reserve: [], R: lv.reserve, slots: lv.slots };
    refill(st);
    return st;
  }
  function clone(st) {
    return { removed: st.removed.slice(), plateLeft: st.plateLeft.slice(), boxes: st.boxes.map((b) => ({ color: b.color, n: b.n })), queue: st.queue.slice(), reserve: st.reserve.slice(), R: st.R, slots: st.slots };
  }

  // Completa las cajas activas desde la cola y absorbe la reserva. Devuelve true si algo cambió.
  function refill(st) {
    let changed = true;
    while (changed) {
      changed = false;
      st.boxes = st.boxes.filter((b) => b.n < BOX_CAP);
      while (st.boxes.length < st.slots && st.queue.length) { st.boxes.push({ color: st.queue.shift(), n: 0 }); changed = true; }
      for (const b of st.boxes) {
        for (let i = 0; i < st.reserve.length && b.n < BOX_CAP;) {
          if (st.reserve[i] === b.color) { st.reserve.splice(i, 1); b.n++; changed = true; } else i++;
        }
      }
    }
  }

  function covered(lv, st, sid) {
    const s = lv.screws[sid], myLayer = lv.plates[s.p].layer;
    for (let i = 0; i < lv.plates.length; i++) {
      if (st.plateLeft[i] <= 0 || lv.plates[i].layer <= myLayer) continue;
      if (pointInPoly(s.x, s.y, lv.plates[i].pts)) return true;
    }
    return false;
  }
  function boxFor(st, color) {
    for (let i = 0; i < st.boxes.length; i++) if (st.boxes[i].color === color && st.boxes[i].n < BOX_CAP) return i;
    return -1;
  }
  // Motivo por el que no se puede: null si se puede
  function blockReason(lv, st, sid) {
    if (st.removed[sid]) return "gone";
    if (covered(lv, st, sid)) return "covered";
    if (boxFor(st, lv.screws[sid].c) < 0 && st.reserve.length >= st.R) return "full";
    return null;
  }
  function legalMoves(lv, st) {
    const out = [];
    for (let i = 0; i < lv.screws.length; i++) if (!blockReason(lv, st, i)) out.push(i);
    return out;
  }
  function freeScrews(lv, st) {
    const out = [];
    for (let i = 0; i < lv.screws.length; i++) if (!st.removed[i] && !covered(lv, st, i)) out.push(i);
    return out;
  }
  function won(st) { return st.plateLeft.every((n) => n <= 0) && st.boxes.length === 0 && st.queue.length === 0; }
  function lost(lv, st) { return !won(st) && legalMoves(lv, st).length === 0; }

  // Aplica el movimiento (muta st). Devuelve info para animar.
  function apply(lv, st, sid) {
    const s = lv.screws[sid], ev = { sid, to: null, box: -1, boxColor: s.c, fallen: [], completed: [] };
    st.removed[sid] = true;
    const bi = boxFor(st, s.c);
    if (bi >= 0) { st.boxes[bi].n++; ev.to = "box"; ev.box = bi; } else { st.reserve.push(s.c); ev.to = "reserve"; ev.slot = st.reserve.length - 1; }
    if (--st.plateLeft[s.p] === 0) ev.fallen.push(s.p);
    const before = st.boxes.filter((b) => b.n >= BOX_CAP).map((b) => b.color);
    ev.completed = before;
    refill(st);
    return ev;
  }

  /* ---------- Solucionador (DFS con memoización) ---------- */
  function key(st) {
    return st.removed.map((r) => (r ? 1 : 0)).join("") + "|" + st.boxes.map((b) => b.color + b.n).join(",") + "|" + st.reserve.slice().sort().join("");
  }
  function solve(lv, st0, opts) {
    opts = opts || {};
    const cap = opts.cap || 300000, seen = new Set(), path = [];
    let nodes = 0;
    const base = clone(st0);
    if (opts.R !== undefined) base.R = opts.R;
    function dfs(st) {
      if (won(st)) return true;
      if (++nodes > cap) return false;
      const k = key(st); if (seen.has(k)) return false; seen.add(k);
      const moves = legalMoves(lv, st);
      // preferir lo que entra en caja; luego lo que libera placas / descubre tornillos
      const sc = (sid) => {
        const bi = boxFor(st, lv.screws[sid].c);
        return (bi >= 0 ? 100 + st.boxes[bi].n * 10 : 0) + (st.plateLeft[lv.screws[sid].p] === 1 ? 5 : 0);
      };
      moves.sort((a, b) => sc(b) - sc(a));
      for (const m of moves) {
        const n = clone(st); apply(lv, n, m); path.push(m);
        if (dfs(n)) return true;
        path.pop();
      }
      return false;
    }
    const ok = dfs(base);
    return ok ? path.slice() : null;
  }
  // Reserva mínima con la que el nivel tiene solución
  function minReserve(lv, maxR, cap) {
    const st = newState(lv);
    for (let R = 0; R <= (maxR === undefined ? 6 : maxR); R++) if (solve(lv, st, { R, cap })) return R;
    return -1;
  }

  /* ---------- Generador ---------- */
  function rectPts(cx, cy, len, th, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), hl = len / 2, ht = th / 2;
    return [[-hl, -ht], [hl, -ht], [hl, ht], [-hl, ht]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  }
  function generate(spec, seed) {
    const rnd = mulberry32(seed), R = (a, b) => a + rnd() * (b - a);
    const W = 100, H = 150, plates = [], screws = [];
    const tooClose = (x, y) => screws.some((s) => Math.hypot(s.x - x, s.y - y) < 12);
    for (let i = 0; i < spec.plates; i++) {
      let placed = false;
      for (let t = 0; t < 400 && !placed; t++) {
        const r = rnd();
        let pts, sp;
        const cx = R(18, 82), cy = R(22, 128), ang = R(0, Math.PI);
        if (r < 0.62) { const len = R(40, 68), th = R(15, 21); pts = rectPts(cx, cy, len, th, ang); const e = len / 2 - 7; sp = [[-e, 0], [e, 0]]; if (len > 56 && rnd() < 0.5) sp.push([0, 0]); }
        else if (r < 0.82) { const sz = R(26, 36); pts = rectPts(cx, cy, sz, sz, ang); const e = sz / 2 - 7; sp = [[-e, -e], [e, e]]; }
        else { const rr = R(18, 24); pts = [0, 1, 2].map((k) => [cx + rr * Math.cos(ang + k * 2.0944), cy + rr * Math.sin(ang + k * 2.0944)]); sp = pts.map((p) => [(cx - p[0]) * 0.38 + p[0] - cx, (cy - p[1]) * 0.38 + p[1] - cy]).slice(0, rnd() < 0.5 ? 3 : 2); }
        if (pts.some((p) => p[0] < 3 || p[0] > W - 3 || p[1] < 3 || p[1] > H - 3)) continue;
        const c = Math.cos(ang), s = Math.sin(ang);
        const pos = r < 0.82 ? sp.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]) : sp.map(([x, y]) => [cx + x, cy + y]);
        const mine = [];
        let bad = false;
        for (const [x, y] of pos) { if (tooClose(x, y) || mine.some((m) => Math.hypot(m[0] - x, m[1] - y) < 12)) { bad = true; break; } mine.push([x, y]); }
        if (bad) continue;
        if (i > 0) { // debe tapar al menos un tornillo existente (dificultad); y no a todos los de otra placa siempre
          const cov = screws.filter((s2) => pointInPoly(s2.x, s2.y, pts)).length;
          if (cov < 1 || cov > spec.maxCover) continue;
        }
        plates.push({ pts: pts.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]), layer: i });
        mine.forEach(([x, y]) => screws.push({ p: i, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, c: 0 }));
        placed = true;
      }
      if (!placed) return null;
    }
    // ajustar a múltiplo de BOX_CAP añadiendo tornillos en el centro
    for (let i = plates.length - 1; i >= 0 && screws.length % BOX_CAP; i--) {
      const pts = plates[i].pts, cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      if (!tooClose(cx, cy)) screws.push({ p: i, x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10, c: 0 });
    }
    if (screws.length % BOX_CAP) return null;
    const nb = screws.length / BOX_CAP, nc = Math.min(spec.colors, nb);
    const queue = [];
    for (let i = 0; i < nb; i++) queue.push(i % nc);
    for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
    const cols = [];
    queue.forEach((c) => { for (let k = 0; k < BOX_CAP; k++) cols.push(c); });
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
    screws.forEach((s, i) => (s.c = cols[i]));
    return { plates, screws, queue, slots: spec.slots, reserve: 6 };
  }

  const api = { BOX_CAP, mulberry32, pointInPoly, newState, clone, covered, boxFor, blockReason, legalMoves, freeScrews, won, lost, apply, solve, minReserve, generate };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Logic = api;
})(typeof window !== "undefined" ? window : globalThis);
