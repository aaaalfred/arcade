/* Lógica pura de Number Match (sin DOM). Navegador y Node.
 * Estado: { cells:[0..9] (0 = vacía, fila mayor = 9 columnas), adds:int } */
(function (root) {
  "use strict";
  const W = 9;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tablero inicial: n números formados por parejas compatibles (igual o suma 10), mezcladas.
  function generate(seed, n) {
    const rnd = mulberry32(seed), v = [];
    n = n - (n % 2);
    for (let k = 0; k < n / 2; k++) {
      const a = 1 + Math.floor(rnd() * 9);
      v.push(a, rnd() < 0.5 ? a : 10 - a);
    }
    for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = v[i]; v[i] = v[j]; v[j] = t; }
    return v;
  }
  function newState(level) { return { cells: generate(level.seed, level.n), adds: level.adds }; }
  function clone(s) { return { cells: s.cells.slice(), adds: s.adds }; }

  const compatible = (a, b) => a === b || a + b === 10;

  // Primera celda ocupada desde i en dirección (dr,dc) o -1; dirección 'lin' = orden de lectura
  function nextAlive(cells, i, dr, dc) {
    const n = cells.length;
    if (dr === 0 && dc === 1) { // lectura lineal (incluye salto de fila)
      for (let j = i + 1; j < n; j++) if (cells[j]) return j;
      return -1;
    }
    let r = Math.floor(i / W) + dr, c = (i % W) + dc;
    while (r >= 0 && c >= 0 && c < W && r * W + c < n) {
      const j = r * W + c;
      if (cells[j]) return j;
      r += dr; c += dc;
    }
    return -1;
  }
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  // ¿Se pueden emparejar i y j (i != j)? Camino libre en fila/lectura, columna o diagonal.
  function canMatch(cells, i, j) {
    if (i === j || !cells[i] || !cells[j] || !compatible(cells[i], cells[j])) return false;
    if (i > j) { const t = i; i = j; j = t; }
    for (const [dr, dc] of DIRS) if (nextAlive(cells, i, dr, dc) === j) return true;
    return false;
  }

  function findPairs(cells) {
    const out = [];
    for (let i = 0; i < cells.length; i++) {
      if (!cells[i]) continue;
      for (const [dr, dc] of DIRS) {
        const j = nextAlive(cells, i, dr, dc);
        if (j >= 0 && compatible(cells[i], cells[j])) out.push([i, j]);
      }
    }
    return out;
  }

  // Quita filas completamente vacías
  function compact(cells) {
    const out = [];
    for (let r = 0; r * W < cells.length; r++) {
      const row = cells.slice(r * W, r * W + W);
      if (row.some((x) => x)) for (const x of row) out.push(x);
    }
    return out;
  }
  // Un trozo final incompleto se mantiene tal cual (las celdas faltantes se leen como vacías)

  function applyMatch(s, i, j) {
    s.cells[i] = 0; s.cells[j] = 0;
    s.cells = compact(s.cells);
  }

  // Añadir: copia los números restantes (en orden) al final del tablero
  function canAdd(s) { return s.adds > 0 && s.cells.some((x) => x); }
  function applyAdd(s) {
    const rest = s.cells.filter((x) => x);
    s.cells = s.cells.concat(rest);
    s.adds--;
  }

  const isWon = (s) => !s.cells.some((x) => x);
  const isStuck = (s) => !isWon(s) && s.adds <= 0 && findPairs(s.cells).length === 0;

  // Solver DFS con memoria y límite de nodos. Devuelve {ok, moves, nodes}.
  function solve(state, opts) {
    opts = opts || {};
    const limit = opts.limit || 200000, rnd = mulberry32(opts.seed || 1);
    const seen = new Set(); let nodes = 0;
    function rec(s, depth) {
      if (isWon(s)) return [];
      if (++nodes > limit) return null;
      const k = s.adds + ":" + s.cells.join("");
      if (seen.has(k)) return null; seen.add(k);
      let pairs = findPairs(s.cells);
      // dedupe + orden: prioriza parejas que vacían más y pequeñas en índice, con ruido
      pairs.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]) + (rnd() - 0.5) * 6);
      for (const [i, j] of pairs) {
        const t = clone(s); applyMatch(t, i, j);
        const r = rec(t, depth + 1);
        if (r) { r.unshift([i, j]); return r; }
        if (nodes > limit) return null;
      }
      if (canAdd(s)) {
        const t = clone(s); applyAdd(t);
        const r = rec(t, depth + 1);
        if (r) { r.unshift("add"); return r; }
      }
      return null;
    }
    const sol = rec(clone(state), 0);
    return { ok: !!sol, moves: sol, nodes };
  }

  // Replay: aplica una solución y devuelve true si limpia el tablero (valida el solver)
  function replay(state, moves) {
    const s = clone(state);
    for (const m of moves) {
      if (m === "add") { if (!canAdd(s)) return false; applyAdd(s); }
      else { if (!canMatch(s.cells, m[0], m[1])) return false; applyMatch(s, m[0], m[1]); }
    }
    return isWon(s);
  }

  root.Logic = { W, generate, newState, clone, canMatch, findPairs, compact, applyMatch, canAdd, applyAdd, isWon, isStuck, solve, replay, compatible, mulberry32 };
  if (typeof module !== "undefined") module.exports = root.Logic;
})(typeof window !== "undefined" ? window : globalThis);
