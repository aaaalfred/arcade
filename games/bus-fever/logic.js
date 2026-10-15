/* Lógica pura de Bus Fever (versión propia). Sin DOM. */
(function (root) {
  "use strict";
  const CAP = 3; // asientos por autobús

  function cellsOf(b) {
    const out = [];
    for (let k = 0; k < b.len; k++) out.push(b.o === "H" ? [b.r, b.c + k] : [b.r + k, b.c]);
    return out;
  }
  function occupancy(lv, alive) {
    const g = Array.from({ length: lv.h }, () => Array(lv.w).fill(-1));
    lv.buses.forEach((b, i) => { if (alive[i]) cellsOf(b).forEach(([r, c]) => { g[r][c] = i; }); });
    return g;
  }
  // ¿Puede el autobús i salir en línea recta hacia su dirección?
  function isFree(lv, alive, i, occ) {
    occ = occ || occupancy(lv, alive);
    const b = lv.buses[i], cs = cellsOf(b);
    if (b.o === "H") {
      if (b.d > 0) { const r = b.r; for (let c = b.c + b.len; c < lv.w; c++) if (occ[r][c] !== -1) return false; }
      else { const r = b.r; for (let c = b.c - 1; c >= 0; c--) if (occ[r][c] !== -1) return false; }
    } else {
      if (b.d > 0) { for (let r = b.r + b.len; r < lv.h; r++) if (occ[r][b.c] !== -1) return false; }
      else { for (let r = b.r - 1; r >= 0; r--) if (occ[r][b.c] !== -1) return false; }
    }
    return cs.length > 0;
  }
  function init(lv) {
    return { alive: lv.buses.map(() => true), bays: Array(lv.bays).fill(null), qi: 0 };
  }
  function clone(s) {
    return { alive: s.alive.slice(), bays: s.bays.map((x) => x && { b: x.b, color: x.color, n: x.n }), qi: s.qi };
  }
  function boardAll(lv, s) {
    let moved = true;
    while (moved && s.qi < lv.queue.length) {
      moved = false;
      const col = lv.queue[s.qi];
      for (let k = 0; k < s.bays.length; k++) {
        const x = s.bays[k];
        if (x && x.color === col && x.n < CAP) {
          x.n++; s.qi++; moved = true;
          if (x.n >= CAP) s.bays[k] = null; // autobús lleno: sale
          break;
        }
      }
    }
  }
  function freeBay(s) { return s.bays.indexOf(null); }
  function canTap(lv, s, i) { return s.alive[i] && freeBay(s) !== -1 && isFree(lv, s.alive, i); }
  function tap(lv, s, i) {
    if (!canTap(lv, s, i)) return null;
    const n = clone(s);
    n.alive[i] = false;
    n.bays[freeBay(n)] = { b: i, color: lv.buses[i].color, n: 0 };
    boardAll(lv, n);
    return n;
  }
  function moves(lv, s) {
    const occ = occupancy(lv, s.alive), out = [];
    if (freeBay(s) === -1) return out;
    for (let i = 0; i < lv.buses.length; i++) if (s.alive[i] && isFree(lv, s.alive, i, occ)) out.push(i);
    return out;
  }
  function status(lv, s) {
    if (s.qi >= lv.queue.length) return "win";
    return moves(lv, s).length ? "play" : "lose";
  }
  function key(s) {
    return s.alive.map((a) => a ? 1 : 0).join("") + "|" + s.qi + "|" +
      s.bays.filter(Boolean).map((x) => x.color + ":" + x.n).sort().join(",");
  }
  // Búsqueda en profundidad con memoria: devuelve lista de toques ganadora o null.
  function solve(lv, s0, limit) {
    s0 = s0 || init(lv); limit = limit || 300000;
    const dead = new Set(); let nodes = 0;
    function rec(s) {
      const st = status(lv, s);
      if (st === "win") return [];
      if (st === "lose") return null;
      const k = key(s); if (dead.has(k)) return null;
      if (++nodes > limit) return null;
      const front = lv.queue[s.qi];
      const ms = moves(lv, s).sort((a, b) => (lv.buses[b].color === front) - (lv.buses[a].color === front));
      for (const m of ms) {
        const r = rec(tap(lv, s, m));
        if (r) return [m].concat(r);
      }
      dead.add(k); return null;
    }
    return rec(s0);
  }
  // Proporción de partidas aleatorias ganadas (mide dificultad)
  function randomWinRate(lv, rng, n) {
    let w = 0;
    for (let t = 0; t < n; t++) {
      let s = init(lv);
      for (;;) {
        const st = status(lv, s);
        if (st === "win") { w++; break; }
        if (st === "lose") break;
        const ms = moves(lv, s); s = tap(lv, s, ms[Math.floor(rng() * ms.length)]);
      }
    }
    return w / n;
  }
  const api = { CAP, cellsOf, occupancy, isFree, init, clone, canTap, tap, moves, status, solve, randomWinRate, key };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Logic = api;
})(typeof window !== "undefined" ? window : globalThis);
