/* Sudoku: solver con contador de soluciones, generador con solución única y utilidades. */
(function (root) {
  "use strict";
  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const r = (i / 9) | 0, c = i % 9, s = new Set();
    for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); }
    const br = r - r % 3, bc = c - c % 3;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s.add((br + a) * 9 + bc + b);
    s.delete(i); PEERS.push([...s]);
  }
  const box = (i) => ((((i / 9) | 0) / 3) | 0) * 3 + (((i % 9) / 3) | 0);

  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const popcnt = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

  /* Cuenta soluciones (hasta `limit`). Si `out` es array, guarda la primera solución. */
  function countSolutions(g, limit, out) {
    const a = Array.from(g), rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) if (a[i]) {
      const b = 1 << a[i], r = (i / 9) | 0, c = i % 9, x = box(i);
      if ((rows[r] | cols[c] | boxes[x]) & b) return 0;
      rows[r] |= b; cols[c] |= b; boxes[x] |= b;
    }
    let count = 0;
    function rec() {
      let best = -1, bm = 0, bn = 10;
      for (let i = 0; i < 81; i++) if (!a[i]) {
        const m = 0x3FE & ~(rows[(i / 9) | 0] | cols[i % 9] | boxes[box(i)]), n = popcnt(m);
        if (n < bn) { bn = n; best = i; bm = m; if (n <= 1) break; }
      }
      if (best < 0) { count++; if (out && count === 1) out[0] = a.slice(); return count >= limit; }
      if (bn === 0) return false;
      const r = (best / 9) | 0, c = best % 9, x = box(best);
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d; if (!(bm & b)) continue;
        a[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
        const stop = rec();
        a[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b;
        if (stop) return true;
      }
      return false;
    }
    rec();
    return count;
  }
  function solve(g) { const o = []; return countSolutions(g, 1, o) ? o[0] : null; }

  function shuffle(arr, rnd) { for (let i = arr.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  function fullGrid(rnd) {
    const a = new Array(81).fill(0), rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
    function rec(i) {
      if (i === 81) return true;
      const r = (i / 9) | 0, c = i % 9, x = box(i);
      for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd)) {
        const b = 1 << d; if ((rows[r] | cols[c] | boxes[x]) & b) continue;
        a[i] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b;
        if (rec(i + 1)) return true;
        a[i] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b;
      }
      return false;
    }
    rec(0); return a;
  }

  /* Quita celdas una a una manteniendo solución única hasta llegar a `clues` pistas (o no poder más). */
  function generate(clues, seed) {
    const rnd = mulberry32(seed == null ? (Math.random() * 4294967296) >>> 0 : seed);
    let best = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const sol = fullGrid(rnd), p = sol.slice(); let n = 81;
      for (const i of shuffle([...Array(81).keys()], rnd)) {
        if (n <= clues) break;
        const v = p[i]; p[i] = 0;
        if (countSolutions(p, 2) !== 1) p[i] = v; else n--;
      }
      if (!best || n < best.n) best = { puzzle: p.slice(), solution: sol, n };
      if (n <= clues) break;
    }
    return { puzzle: best.puzzle.join(""), solution: best.solution.join(""), clues: best.n };
  }

  const LEVELS = {
    easy: { name: "Fácil", clues: 44 }, medium: { name: "Medio", clues: 36 }, hard: { name: "Difícil", clues: 31 },
    expert: { name: "Experto", clues: 27 }, master: { name: "Maestro", clues: 24 }
  };
  const parse = (s) => Array.from(s, Number);
  function candidates(vals, i) { let m = 0x3FE; for (const p of PEERS[i]) if (vals[p]) m &= ~(1 << vals[p]); return m; }

  const api = { PEERS, box, mulberry32, countSolutions, solve, generate, LEVELS, parse, candidates };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SudokuLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
