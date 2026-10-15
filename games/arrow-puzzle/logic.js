/* Lógica pura de "Flecha Libre" (sin DOM). Navegador y Node.
 * Nivel: { id, w, h, lives, arrows: [ { cells:[[r,c],...], d:[dr,dc], k } ] }
 * - cells: celdas contiguas de cola a cabeza (puede ser 1 sola celda).
 * - d: dirección de salida (para 2+ celdas coincide con el último tramo).
 * - k: candado; la flecha solo sale cuando ya han salido al menos k flechas (0 = sin candado).
 * Una flecha sale si NO está bloqueada por candado y ninguna otra flecha ocupa su camino hasta el borde. */
(function (root) {
  "use strict";
  const key = (r, c) => r * 1000 + c;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rayCells(lv, a) {
    const [dr, dc] = a.d, h = a.cells[a.cells.length - 1], out = [];
    let r = h[0] + dr, c = h[1] + dc;
    while (r >= 0 && c >= 0 && r < lv.h && c < lv.w) { out.push([r, c]); r += dr; c += dc; }
    return out;
  }
  function occupancy(lv, alive) {
    const occ = new Map();
    lv.arrows.forEach((a, i) => { if (alive[i]) a.cells.forEach(([r, c]) => occ.set(key(r, c), i)); });
    return occ;
  }
  // Índice de la flecha que bloquea a i, o -1
  function blocker(lv, i, occ) {
    for (const [r, c] of rayCells(lv, lv.arrows[i])) {
      const o = occ.get(key(r, c));
      if (o !== undefined && o !== i) return o;
    }
    return -1;
  }
  function removedCount(alive) { return alive.filter((x) => !x).length; }
  function isLocked(lv, i, alive) { return (lv.arrows[i].k || 0) > removedCount(alive); }
  // Resultado de tocar i: {ok:true} | {ok:false, reason:"lock"} | {ok:false, reason:"block", by:j}
  function tryExit(lv, i, alive) {
    if (isLocked(lv, i, alive)) return { ok: false, reason: "lock" };
    const b = blocker(lv, i, occupancy(lv, alive));
    return b === -1 ? { ok: true } : { ok: false, reason: "block", by: b };
  }
  function freeArrows(lv, alive) {
    const occ = occupancy(lv, alive);
    return lv.arrows.map((_, i) => i).filter((i) => alive[i] && !isLocked(lv, i, alive) && blocker(lv, i, occ) === -1);
  }
  // Quitar una flecha libre solo ayuda (libera camino y sube el contador), así que el voraz decide.
  function solvable(lv) {
    const alive = lv.arrows.map(() => true);
    for (;;) {
      const f = freeArrows(lv, alive);
      if (!f.length) break;
      alive[f[0]] = false;
    }
    return alive.every((a) => !a);
  }
  function depth(lv) {
    const alive = lv.arrows.map(() => true); let d = 0;
    for (;;) {
      const f = freeArrows(lv, alive);
      if (!f.length) break;
      f.forEach((i) => { alive[i] = false; }); d++;
    }
    return d;
  }
  function generate(w, h, opt, seed) {
    const rng = mulberry32(seed), occ = new Map(), arrows = [];
    const D = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const lv = { w, h, arrows };
    for (let attempt = 0; attempt < opt.attempts; attempt++) {
      const sr = Math.floor(rng() * h), sc = Math.floor(rng() * w);
      if (occ.has(key(sr, sc))) continue;
      const target = rng() < opt.single ? 1 : 2 + Math.floor(rng() * (opt.maxLen - 1));
      const cells = [[sr, sc]], used = new Set([key(sr, sc)]);
      let last = null;
      while (cells.length < target) {
        const [r, c] = cells[cells.length - 1];
        const opts = D.filter(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return nr >= 0 && nc >= 0 && nr < h && nc < w && !occ.has(key(nr, nc)) && !used.has(key(nr, nc));
        });
        if (!opts.length) break;
        let pick;
        if (last && rng() < opt.straight) pick = opts.find(([dr, dc]) => dr === last[0] && dc === last[1]);
        if (!pick) pick = opts[Math.floor(rng() * opts.length)];
        cells.push([r + pick[0], c + pick[1]]); used.add(key(r + pick[0], c + pick[1])); last = pick;
      }
      let cands;
      if (cells.length === 1) cands = D.map((d) => ({ cells, d }));
      else {
        const rev = cells.slice().reverse();
        const dirOf = (cs) => [cs[cs.length - 1][0] - cs[cs.length - 2][0], cs[cs.length - 1][1] - cs[cs.length - 2][1]];
        cands = [{ cells, d: dirOf(cells) }, { cells: rev, d: dirOf(rev) }];
      }
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
      for (const a of cands) {
        const own = new Set(a.cells.map(([r, c]) => key(r, c)));
        if (rayCells(lv, a).some(([r, c]) => occ.has(key(r, c)) || own.has(key(r, c)))) continue;
        arrows.push({ cells: a.cells, d: a.d, k: 0 }); a.cells.forEach(([r, c]) => occ.set(key(r, c), arrows.length - 1));
        break;
      }
    }
    arrows.reverse();
    // Candados: k entre 1 y la posición en un orden de salida válido (el inverso reordenado ya es válido).
    const n = arrows.length;
    arrows.forEach((a, i) => {
      if (n > 3 && i > 0 && rng() < opt.lockFrac) a.k = 1 + Math.floor(rng() * Math.min(i, Math.ceil(n * 0.7)));
    });
    return lv;
  }
  function coverage(lv) { return lv.arrows.reduce((s, a) => s + a.cells.length, 0) / (lv.w * lv.h); }
  root.key = key; root.rayCells = rayCells; root.occupancy = occupancy; root.blocker = blocker;
  root.isLocked = isLocked; root.tryExit = tryExit; root.freeArrows = freeArrows; root.solvable = solvable;
  root.depth = depth; root.generate = generate; root.coverage = coverage;
})(typeof module !== "undefined" ? module.exports : (window.Logic = {}));
