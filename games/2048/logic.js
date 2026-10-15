/* Lógica pura de 2048 (sin DOM). Celdas: 0 = vacía, -1 = bloqueada, n>0 = ficha.
   Direcciones: 0 arriba, 1 derecha, 2 abajo, 3 izquierda. */
(function (root) {
  "use strict";

  // Desliza una línea hacia el índice 0. Los bloqueos (-1) dividen la línea en tramos.
  // Cada ficha se fusiona como mucho una vez por movimiento.
  function slideLine(line) {
    const out = line.slice(), trace = [];
    let score = 0, moved = false, i = 0;
    while (i < line.length) {
      if (line[i] === -1) { i++; continue; }
      let j = i;
      while (j < line.length && line[j] !== -1) j++;
      // tramo [i, j)
      let w = i, lastVal = 0, lastIdx = -1, canMerge = false;
      for (let k = i; k < j; k++) {
        out[k] = 0;
      }
      for (let k = i; k < j; k++) {
        const v = line[k];
        if (!v) continue;
        if (canMerge && lastVal === v) {
          out[lastIdx] = v * 2; score += v * 2; canMerge = false;
          trace.push({ from: k, to: lastIdx, merge: true });
          moved = true;
        } else {
          out[w] = v; lastVal = v; lastIdx = w; canMerge = true;
          trace.push({ from: k, to: w, merge: false });
          if (w !== k) moved = true;
          w++;
        }
      }
      i = j;
    }
    return { line: out, score: score, moved: moved, trace: trace };
  }

  // Índices de celdas de cada línea, ordenados desde la pared hacia donde se desliza.
  function lines(w, h, dir) {
    const res = [];
    if (dir === 3 || dir === 1) {
      for (let r = 0; r < h; r++) {
        const l = [];
        for (let c = 0; c < w; c++) l.push(r * w + (dir === 3 ? c : w - 1 - c));
        res.push(l);
      }
    } else {
      for (let c = 0; c < w; c++) {
        const l = [];
        for (let r = 0; r < h; r++) l.push((dir === 0 ? r : h - 1 - r) * w + c);
        res.push(l);
      }
    }
    return res;
  }

  function move(cells, w, h, dir) {
    const next = cells.slice(), trace = [];
    let score = 0, moved = false;
    lines(w, h, dir).forEach(function (idxs) {
      const r = slideLine(idxs.map(function (i) { return cells[i]; }));
      idxs.forEach(function (ci, k) { next[ci] = r.line[k]; });
      r.trace.forEach(function (t) { trace.push({ from: idxs[t.from], to: idxs[t.to], merge: t.merge }); });
      score += r.score; if (r.moved) moved = true;
    });
    return { cells: next, score: score, moved: moved, trace: trace };
  }

  function emptyCells(cells) {
    const e = [];
    cells.forEach(function (v, i) { if (v === 0) e.push(i); });
    return e;
  }

  // 2 con 90 %, 4 con 10 %. rng() devuelve [0,1).
  function spawn(cells, rng) {
    rng = rng || Math.random;
    const e = emptyCells(cells);
    if (!e.length) return null;
    const idx = e[Math.floor(rng() * e.length)];
    const v = rng() < 0.9 ? 2 : 4;
    cells[idx] = v;
    return { idx: idx, v: v };
  }

  function canMove(cells, w, h) {
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const v = cells[r * w + c];
      if (v === -1) continue;
      if (v === 0) return true;
      if (c + 1 < w && cells[r * w + c + 1] === v) return true;
      if (r + 1 < h && cells[(r + 1) * w + c] === v) return true;
    }
    return false;
  }

  function maxTile(cells) { return cells.reduce(function (m, v) { return v > m ? v : m; }, 0); }

  function newGame(w, h, blocks, rng) {
    const cells = new Array(w * h).fill(0);
    (blocks || []).forEach(function (i) { cells[i] = -1; });
    spawn(cells, rng); spawn(cells, rng);
    return cells;
  }

  const Logic = { slideLine: slideLine, move: move, spawn: spawn, canMove: canMove, maxTile: maxTile, newGame: newGame, emptyCells: emptyCells };
  if (typeof module !== "undefined" && module.exports) module.exports = Logic;
  root.Logic = Logic;
})(typeof window !== "undefined" ? window : globalThis);
