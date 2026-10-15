/* Lógica pura del laberinto (sin DOM). Funciona en navegador y en Node. */
(function (root) {
  "use strict";

  // Codificación interna de aristas:
  // 0 = pared, 1 = abierta, 2 = solo hacia derecha/abajo, 3 = solo hacia izquierda/arriba
  const CODE = { "#": 0, ".": 1, ">": 2, "<": 3 };

  // Convierte los datos de niveles (strings) a la forma numérica que usa el juego.
  function parseLevels(data) {
    return data.map((lv) => ({
      id: lv.id,
      n: lv.n,
      start: lv.start.slice(),
      goal: lv.goal.slice(),
      par: lv.par,
      H: lv.H.map((row) => row.map((ch) => CODE[ch])),
      V: lv.V.map((row) => row.map((ch) => CODE[ch])),
    }));
  }

  // ¿Se puede pasar de (r,c) a (r+dr,c+dc)? Respeta paredes y sentidos únicos.
  function canMove(lv, r, c, dr, dc) {
    const n = lv.n, nr = r + dr, nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= n || nc >= n) return false;
    if (dc === 1) { const e = lv.H[r][c]; return e === 1 || e === 2; }
    if (dc === -1) { const e = lv.H[r][c - 1]; return e === 1 || e === 3; }
    if (dr === 1) { const e = lv.V[r][c]; return e === 1 || e === 2; }
    const e = lv.V[r - 1][c]; return e === 1 || e === 3;
  }

  // Camino más corto desde (fromR,fromC) hasta la meta. Devuelve [[r,c],...] o null.
  // ignoreOneWay=true ignora los sentidos únicos (solo sirve para validar el diseño).
  function solve(lv, fromR, fromC, ignoreOneWay) {
    const n = lv.n, goal = lv.goal;
    const key = (r, c) => r * n + c;
    const prev = new Map([[key(fromR, fromC), null]]);
    const q = [[fromR, fromC]];
    for (let i = 0; i < q.length; i++) {
      const [r, c] = q[i];
      if (r === goal[0] && c === goal[1]) {
        const path = [];
        for (let k = key(r, c); k !== null; k = prev.get(k)) path.push([Math.floor(k / n), k % n]);
        return path.reverse();
      }
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n || prev.has(key(nr, nc))) continue;
        const ok = ignoreOneWay ? canOpen(lv, r, c, dr, dc) : canMove(lv, r, c, dr, dc);
        if (!ok) continue;
        prev.set(key(nr, nc), key(r, c));
        q.push([nr, nc]);
      }
    }
    return null;
  }
  function canOpen(lv, r, c, dr, dc) {
    const e = dc === 1 ? lv.H[r][c] : dc === -1 ? lv.H[r][c - 1] : dr === 1 ? lv.V[r][c] : lv.V[r - 1][c];
    return e !== 0;
  }

  // 3 estrellas: óptimo o menos. 2: hasta 50% más. 1: resto.
  function stars(moves, par) {
    if (moves <= par) return 3;
    if (moves <= Math.ceil(par * 1.5)) return 2;
    return 1;
  }

  root.parseLevels = parseLevels;
  root.canMove = canMove;
  root.solve = solve;
  root.stars = stars;
})(typeof module !== "undefined" ? module.exports : (window.Logic = {}));
