/* Lógica pura de Water Sort (sin DOM). Navegador y Node.
 * Tubo = array de ids de color, de abajo hacia arriba. Capacidad CAP. */
(function (root) {
  "use strict";
  const CAP = 4;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tanda contigua del mismo color en la parte superior
  function topRun(t) {
    if (!t.length) return 0;
    const c = t[t.length - 1]; let n = 0;
    for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
    return n;
  }
  // Cuántas unidades se verterían de a hacia b (0 si el movimiento es inválido)
  function pourAmount(tubes, a, b) {
    if (a === b) return 0;
    const A = tubes[a], B = tubes[b];
    if (!A.length || B.length >= CAP) return 0;
    if (B.length && B[B.length - 1] !== A[A.length - 1]) return 0;
    return Math.min(topRun(A), CAP - B.length);
  }
  function canPour(tubes, a, b) { return pourAmount(tubes, a, b) > 0; }
  function pour(tubes, a, b) {
    const n = pourAmount(tubes, a, b);
    if (!n) return null;
    const out = tubes.map((t) => t.slice());
    const c = out[a][out[a].length - 1];
    for (let i = 0; i < n; i++) { out[a].pop(); out[b].push(c); }
    return out;
  }
  function tubeDone(t) { return t.length === 0 || (t.length === CAP && t.every((x) => x === t[0])); }
  function isSolved(tubes) { return tubes.every(tubeDone); }

  const keyOf = (tubes) => tubes.map((t) => t.join(",")).sort().join("|");
  function heur(tubes) {
    let h = 0;
    for (const t of tubes) {
      if (!t.length) continue;
      let seg = 1; for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) seg++;
      h += seg - (tubeDone(t) ? 0 : 0);
      if (!tubeDone(t) && seg === 1) h += 1; // tubo uniforme incompleto: hay que completarlo
    }
    return h - tubes.filter((t) => t.length).length + 0;
  }

  function moves(tubes) {
    const out = [];
    for (let a = 0; a < tubes.length; a++) {
      const A = tubes[a];
      if (!A.length || tubeDone(A)) continue;
      const uniformA = topRun(A) === A.length;
      for (let b = 0; b < tubes.length; b++) {
        if (!canPour(tubes, a, b)) continue;
        if (uniformA && !tubes[b].length) continue; // inútil: mover tubo uniforme a uno vacío
        out.push([a, b]);
      }
    }
    return out;
  }

  // A* ponderado; devuelve lista de [origen,destino] o null. Longitud ≈ óptima.
  function solve(start, opts) {
    opts = opts || {};
    const W = opts.weight || 1.3, maxNodes = opts.maxNodes || 400000;
    const heap = []; // [f, g, id]
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const nodes = [{ t: start, parent: -1, mv: null, g: 0 }];
    const best = new Map([[keyOf(start), 0]]);
    push([W * heur(start), 0, 0]);
    let expanded = 0;
    while (heap.length && expanded++ < maxNodes) {
      const [, g, id] = pop(); const n = nodes[id];
      if (g > n.g) continue;
      if (isSolved(n.t)) { const path = []; for (let i = id; nodes[i].parent >= 0; i = nodes[i].parent) path.push(nodes[i].mv); return path.reverse(); }
      for (const mv of moves(n.t)) {
        const t2 = pour(n.t, mv[0], mv[1]), k = keyOf(t2), g2 = g + 1;
        if (best.has(k) && best.get(k) <= g2) continue;
        best.set(k, g2); nodes.push({ t: t2, parent: id, mv, g: g2 });
        push([g2 + W * heur(t2), g2, nodes.length - 1]);
      }
    }
    return null;
  }

  function replay(start, path) {
    let t = start;
    for (const [a, b] of path) { t = pour(t, a, b); if (!t) return null; }
    return t;
  }

  // Mezcla aleatoria de nColors*CAP unidades en nColors tubos + nEmpty vacíos; sin tubos ya resueltos.
  function generate(nColors, nEmpty, seed) {
    const rnd = mulberry32(seed);
    for (;;) {
      const bag = []; for (let c = 0; c < nColors; c++) for (let i = 0; i < CAP; i++) bag.push(c);
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      const tubes = [];
      for (let i = 0; i < nColors; i++) tubes.push(bag.slice(i * CAP, (i + 1) * CAP));
      for (let i = 0; i < nEmpty; i++) tubes.push([]);
      if (!tubes.some((t) => t.length && tubeDone(t))) return tubes;
    }
  }

  // Estrellas según movimientos vs referencia (solución aproximada óptima)
  function starsFor(moves, ref) {
    if (moves <= Math.ceil(ref * 1.3) + 1) return 3;
    if (moves <= Math.ceil(ref * 1.9) + 2) return 2;
    return 1;
  }

  const api = { CAP, mulberry32, topRun, pourAmount, canPour, pour, isSolved, tubeDone, moves, solve, replay, generate, starsFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Logic = api;
})(typeof window !== "undefined" ? window : globalThis);
