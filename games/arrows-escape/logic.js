/* Arrows Escape: como flechas-10 + obstáculos fijos (lv.obstacles) que bloquean para siempre el trayecto.
 * Lógica pura del puzzle de flechas (sin DOM). Funciona en navegador y en Node.
 *
 * Un nivel: { id, w, h, arrows: [ [[r,c], [r,c], ...], ... ] }
 * Cada flecha es una serpiente que ocupa celdas contiguas (de cola a cabeza). La cabeza apunta
 * en la dirección del último tramo. Al tocarla, sale en línea recta por esa dirección; solo puede
 * salir si ninguna otra flecha ocupa las celdas entre su cabeza y el borde del tablero. */
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

  // Dirección de la cabeza [dr, dc]
  function headDir(cells) {
    const a = cells[cells.length - 2], b = cells[cells.length - 1];
    return [b[0] - a[0], b[1] - a[1]];
  }

  // Celdas entre la cabeza (excluida) y el borde del tablero
  function rayCells(lv, cells) {
    const [dr, dc] = headDir(cells), h = cells[cells.length - 1], out = [];
    let r = h[0] + dr, c = h[1] + dc;
    while (r >= 0 && c >= 0 && r < lv.h && c < lv.w) { out.push([r, c]); r += dr; c += dc; }
    return out;
  }

  // Mapa celda -> índice de flecha, para las flechas aún en el tablero (alive[i] true)
  function occupancy(lv, alive) {
    const occ = new Map();
    lv.arrows.forEach((cells, i) => { if (alive[i]) cells.forEach(([r, c]) => occ.set(key(r, c), i)); });
    return occ;
  }

  // Índice de la flecha que bloquea a la flecha i, o -1 si puede salir
  // -2 = bloque fijo (obstáculo permanente)
  function obsSet(lv) {
    if (!lv._obs) lv._obs = new Set((lv.obstacles || []).map(([r, c]) => key(r, c)));
    return lv._obs;
  }
  function blocker(lv, i, occ) {
    const ob = obsSet(lv);
    for (const [r, c] of rayCells(lv, lv.arrows[i])) {
      if (ob.has(key(r, c))) return -2;
      const o = occ.get(key(r, c));
      if (o !== undefined && o !== i) return o;
    }
    return -1;
  }

  function freeArrows(lv, alive) {
    const occ = occupancy(lv, alive);
    return lv.arrows.map((_, i) => i).filter((i) => alive[i] && blocker(lv, i, occ) === -1);
  }

  // Retirar flechas libres nunca bloquea a otras, así que el avance voraz decide si hay solución.
  function solvable(lv) {
    const alive = lv.arrows.map(() => true);
    for (;;) {
      const free = freeArrows(lv, alive);
      if (!free.length) break;
      free.forEach((i) => { alive[i] = false; });
    }
    return alive.every((a) => !a);
  }

  // Número de rondas voraces necesarias (profundidad de las dependencias).
  function depth(lv) {
    const alive = lv.arrows.map(() => true);
    let d = 0;
    for (;;) {
      const free = freeArrows(lv, alive);
      if (!free.length) break;
      free.forEach((i) => { alive[i] = false; });
      d++;
    }
    return d;
  }

  // Generador: coloca flechas una a una; la flecha nueva nunca apunta hacia flechas ya colocadas,
  // así que retirarlas en orden inverso siempre es posible (solución garantizada).
  function generate(w, h, opt, seed) {
    const rng = mulberry32(seed), occ = new Map(), arrows = [];
    const D = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const lv = { w, h, arrows, obstacles: [] };
    const nObs = Math.floor(w * h * (opt.obs || 0));
    for (let k = 0; k < nObs; k++) {
      const r = Math.floor(rng() * h), c = Math.floor(rng() * w);
      if (!occ.has(key(r, c))) { occ.set(key(r, c), -1); lv.obstacles.push([r, c]); }
    }
    for (let attempt = 0; attempt < opt.attempts; attempt++) {
      const sr = Math.floor(rng() * h), sc = Math.floor(rng() * w);
      if (occ.has(key(sr, sc))) continue;
      const target = 2 + Math.floor(rng() * (opt.maxLen - 1));
      const cells = [[sr, sc]], used = new Set([key(sr, sc)]);
      let last = null;
      while (cells.length < target) {
        const [r, c] = cells[cells.length - 1];
        const opts = D.filter(([dr, dc]) => {
          const nr = r + dr, nc = c + dc;
          return nr >= 0 && nc >= 0 && nr < h && nc < w && !occ.has(key(nr, nc)) && !used.has(key(nr, nc));
        });
        if (!opts.length) break;
        // sesgo a seguir recto para que las serpientes no sean puro zigzag
        let pick;
        if (last && rng() < opt.straight) pick = opts.find(([dr, dc]) => dr === last[0] && dc === last[1]);
        if (!pick) pick = opts[Math.floor(rng() * opts.length)];
        cells.push([r + pick[0], c + pick[1]]); used.add(key(r + pick[0], c + pick[1])); last = pick;
      }
      if (cells.length < 2) continue;
      // probar ambos extremos como cabeza
      const cand = rng() < 0.5 ? [cells, cells.slice().reverse()] : [cells.slice().reverse(), cells];
      for (const cs of cand) {
        const ray = rayCells(lv, cs);
        const own = new Set(cs.map(([r, c]) => key(r, c)));
        if (ray.some(([r, c]) => occ.has(key(r, c)) || own.has(key(r, c)))) continue;
        arrows.push(cs); cs.forEach(([r, c]) => occ.set(key(r, c), arrows.length - 1));
        break;
      }
    }
    // El orden de colocación se invierte: así el índice 0 es la última colocada (más "libre").
    arrows.reverse();
    return lv;
  }

  function coverage(lv) { return lv.arrows.reduce((s, a) => s + a.length, 0) / (lv.w * lv.h); }

  root.key = key; root.headDir = headDir; root.rayCells = rayCells; root.occupancy = occupancy;
  root.blocker = blocker; root.freeArrows = freeArrows; root.solvable = solvable; root.depth = depth;
  root.generate = generate; root.coverage = coverage;
})(typeof module !== "undefined" ? module.exports : (window.Logic = {}));
