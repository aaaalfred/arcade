/* Lógica pura de Bloques (testeable en Node). Celdas: 0 vacío, 1..6 color, 11..16 gema. */
(function (root) {
  "use strict";
  var N = 8;
  var SHAPES = [
    ["1"], ["11"], ["1","1"], ["111"], ["1","1","1"], ["1111"], ["1","1","1","1"], ["11111"], ["1","1","1","1","1"],
    ["11","11"], ["111","111","111"], ["111","111"], ["11","11","11"],
    ["10","11"], ["01","11"], ["11","10"], ["11","01"],
    ["100","100","111"], ["001","001","111"], ["111","100","100"], ["111","001","001"],
    ["010","111"], ["111","010"], ["10","11","10"], ["01","11","01"],
    ["110","011"], ["011","110"], ["10","11","01"], ["01","11","10"]
  ].map(function (rows) {
    var cells = [];
    rows.forEach(function (r, y) { for (var x = 0; x < r.length; x++) if (r[x] === "1") cells.push([x, y]); });
    var w = 0, h = rows.length; rows.forEach(function (r) { w = Math.max(w, r.length); });
    return { cells: cells, w: w, h: h, n: cells.length };
  });

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function emptyBoard() { var b = []; for (var i = 0; i < N * N; i++) b.push(0); return b; }
  function canPlace(b, s, x, y) {
    if (x < 0 || y < 0 || x + s.w > N || y + s.h > N) return false;
    for (var i = 0; i < s.cells.length; i++) if (b[(y + s.cells[i][1]) * N + x + s.cells[i][0]]) return false;
    return true;
  }
  function anyFit(b, s) { for (var y = 0; y <= N - s.h; y++) for (var x = 0; x <= N - s.w; x++) if (canPlace(b, s, x, y)) return true; return false; }
  /* Detecta líneas completas tras colocar (sin modificar). */
  function findLines(b) {
    var rows = [], cols = [], i, j, ok;
    for (i = 0; i < N; i++) { ok = true; for (j = 0; j < N; j++) if (!b[i * N + j]) { ok = false; break; } if (ok) rows.push(i); }
    for (j = 0; j < N; j++) { ok = true; for (i = 0; i < N; i++) if (!b[i * N + j]) { ok = false; break; } if (ok) cols.push(j); }
    return { rows: rows, cols: cols, count: rows.length + cols.length };
  }
  /* Coloca pieza (muta b). Devuelve {lines, rows, cols, cleared:[idx], gems, boardEmpty}. */
  function place(b, s, x, y, color) {
    for (var i = 0; i < s.cells.length; i++) b[(y + s.cells[i][1]) * N + x + s.cells[i][0]] = color;
    var L = findLines(b), set = {}, cleared = [], gems = 0, k;
    L.rows.forEach(function (r) { for (k = 0; k < N; k++) set[r * N + k] = 1; });
    L.cols.forEach(function (c) { for (k = 0; k < N; k++) set[k * N + c] = 1; });
    for (var idx in set) { idx = +idx; if (b[idx] >= 10) gems++; cleared.push(idx); b[idx] = 0; }
    var empty = true; for (k = 0; k < b.length; k++) if (b[k]) { empty = false; break; }
    return { lines: L.count, rows: L.rows, cols: L.cols, cleared: cleared, gems: gems, boardEmpty: empty };
  }
  /* Puntuación: celdas + 10*n^2 por líneas, multiplicada por racha. streak = racha tras este movimiento (>=1 si limpió). */
  function scoreMove(cells, lines, streak, boardEmpty) {
    var s = cells;
    if (lines > 0) s += Math.round(10 * lines * lines * (1 + 0.5 * (streak - 1)));
    if (boardEmpty) s += 120;
    return s;
  }
  /* ¿Existe un orden y colocaciones que permitan colocar todas las piezas? */
  function solvable(b, pieces) {
    var used = pieces.map(function () { return false; });
    function rec(board, left) {
      if (left === 0) return true;
      var tried = {};
      for (var p = 0; p < pieces.length; p++) {
        if (used[p]) continue;
        var s = pieces[p], key = s.cells.length + ":" + s.w + "x" + s.h + ":" + s.cells.join(";");
        if (tried[key]) continue; tried[key] = 1;
        used[p] = true;
        for (var y = 0; y <= N - s.h; y++) for (var x = 0; x <= N - s.w; x++) {
          if (!canPlace(board, s, x, y)) continue;
          var nb = board.slice(); place(nb, s, x, y, 1);
          if (rec(nb, left - 1)) { used[p] = false; return true; }
        }
        used[p] = false;
      }
      return false;
    }
    return rec(b, pieces.length);
  }
  function maxClearPotential(b, s) {
    var best = 0;
    for (var y = 0; y <= N - s.h; y++) for (var x = 0; x <= N - s.w; x++) if (canPlace(b, s, x, y)) { var nb = b.slice(); var r = place(nb, s, x, y, 1); if (r.lines > best) best = r.lines; }
    return best;
  }
  function weightFor(s, level) {
    // level 0..1: dificultad (más piezas grandes). Piezas pequeñas siempre posibles.
    var n = s.n, w = 1;
    if (n <= 2) w = 1.2 - 0.8 * level;
    else if (n <= 4) w = 1;
    else if (n <= 6) w = 0.7 + 0.5 * level;
    else w = 0.4 + 0.8 * level;
    return Math.max(0.15, w);
  }
  function pick(rng, level) {
    var tot = 0, i; for (i = 0; i < SHAPES.length; i++) tot += weightFor(SHAPES[i], level);
    var r = rng() * tot; for (i = 0; i < SHAPES.length; i++) { r -= weightFor(SHAPES[i], level); if (r <= 0) return i; }
    return SHAPES.length - 1;
  }
  /* Genera 3 piezas (índices en SHAPES) que garantizan solución con el tablero actual. */
  function generateTray(b, rng, level) {
    var best = null, bestScore = -1, tries = 0;
    for (var c = 0; c < 14; c++) {
      var idx = [pick(rng, level), pick(rng, level), pick(rng, level)];
      var ps = idx.map(function (i) { return SHAPES[i]; });
      tries++;
      if (!solvable(b, ps)) continue;
      var sc = 0; ps.forEach(function (p) { sc += maxClearPotential(b, p); });
      sc = sc * (0.6 + 0.8 * (1 - level)) + rng();
      if (sc > bestScore) { bestScore = sc; best = idx; }
      if (c >= 6 && best) break;
    }
    if (best) return best;
    // Respaldo constructivo: pieza a pieza sobre tablero simulado.
    var sim = b.slice(), out = [];
    for (var k = 0; k < 3; k++) {
      var cand = [];
      for (var i = 0; i < SHAPES.length; i++) if (anyFit(sim, SHAPES[i])) cand.push(i);
      if (!cand.length) { out.push(0); continue; }
      var ci = cand[Math.floor(rng() * cand.length)], s = SHAPES[ci];
      outer: for (var y = 0; y <= N - s.h; y++) for (var x = 0; x <= N - s.w; x++) if (canPlace(sim, s, x, y)) { place(sim, s, x, y, 1); break outer; }
      out.push(ci);
    }
    var ps2 = out.map(function (i) { return SHAPES[i]; });
    if (solvable(b, ps2)) return out;
    return [0, 0, 0].map(function () { return 0; }); // último recurso: cubitos (si caben)
  }
  function gameOver(b, pieces) { // pieces: array de shapes o null
    for (var i = 0; i < pieces.length; i++) if (pieces[i] && anyFit(b, pieces[i])) return false;
    return true;
  }
  /* Bot voraz para pruebas: elige la colocación con mejor heurística. */
  function botMove(b, s) {
    var best = null, bs = -1e9;
    for (var y = 0; y <= N - s.h; y++) for (var x = 0; x <= N - s.w; x++) {
      if (!canPlace(b, s, x, y)) continue;
      var nb = b.slice(), r = place(nb, s, x, y, 1), sc = r.lines * 100 + r.gems * 60;
      // penalizar huecos aislados y altura de relleno
      var holes = 0; for (var i = 0; i < 64; i++) if (!nb[i]) { var cx = i % 8, cy = (i / 8) | 0, nbrs = 0;
        if (cx === 0 || nb[i - 1]) nbrs++; if (cx === 7 || nb[i + 1]) nbrs++; if (cy === 0 || nb[i - 8]) nbrs++; if (cy === 7 || nb[i + 8]) nbrs++; if (nbrs >= 4) holes++; }
      var filled = 0; for (i = 0; i < 64; i++) if (nb[i]) filled++;
      sc -= holes * 25 + filled * 1.5;
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    return best;
  }
  root.Logic = { N: N, SHAPES: SHAPES, mulberry: mulberry, emptyBoard: emptyBoard, canPlace: canPlace, anyFit: anyFit, findLines: findLines, place: place, scoreMove: scoreMove, solvable: solvable, generateTray: generateTray, gameOver: gameOver, botMove: botMove };
  if (typeof module !== "undefined") module.exports = root.Logic;
})(typeof window !== "undefined" ? window : globalThis);
