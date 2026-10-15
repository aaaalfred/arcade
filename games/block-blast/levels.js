/* 10 niveles. goal: {type:"score"|"lines"|"gems", n}. Tablero inicial generado de forma determinista. */
(function (root) {
  "use strict";
  function prefill(seed, count, gems) {
    var rng = (root.Logic || require("./logic.js")).mulberry(seed), b = [], i;
    for (i = 0; i < 64; i++) b.push(0);
    var tries = 0, placed = 0;
    while (placed < count && tries++ < 2000) {
      var c = Math.floor(rng() * 64); if (b[c]) continue;
      b[c] = 1 + Math.floor(rng() * 6); placed++;
      // evita líneas completas
      var r = (c / 8) | 0, k = c % 8, rowFull = true, colFull = true, j;
      for (j = 0; j < 8; j++) { if (!b[r * 8 + j]) rowFull = false; if (!b[j * 8 + k]) colFull = false; }
      if (rowFull || colFull) { b[c] = 0; placed--; }
    }
    var filled = []; for (i = 0; i < 64; i++) if (b[i]) filled.push(i);
    for (var g = 0; g < gems && filled.length; g++) { var p = Math.floor(rng() * filled.length), idx = filled.splice(p, 1)[0]; b[idx] = 10 + (b[idx] % 6 || 6); }
    return b;
  }
  var DEFS = [
    { goal: { type: "score", n: 250 }, seed: 11, fill: 0,  gems: 0, diff: 0.0 },
    { goal: { type: "lines", n: 5 },   seed: 12, fill: 6,  gems: 0, diff: 0.05 },
    { goal: { type: "gems",  n: 3 },   seed: 13, fill: 10, gems: 4, diff: 0.1 },
    { goal: { type: "score", n: 450 }, seed: 14, fill: 8,  gems: 0, diff: 0.15 },
    { goal: { type: "lines", n: 8 },   seed: 15, fill: 12, gems: 0, diff: 0.2 },
    { goal: { type: "gems",  n: 5 },   seed: 16, fill: 12, gems: 7, diff: 0.25 },
    { goal: { type: "score", n: 500 }, seed: 17, fill: 10, gems: 0, diff: 0.3 },
    { goal: { type: "lines", n: 11 },  seed: 18, fill: 14, gems: 0, diff: 0.35 },
    { goal: { type: "gems",  n: 7 },   seed: 19, fill: 16, gems: 9, diff: 0.4 },
    { goal: { type: "score", n: 650 }, seed: 20, fill: 16, gems: 0, diff: 0.45 }
  ];
  var LEVELS = DEFS.map(function (d, i) {
    var text = d.goal.type === "score" ? "Alcanza " + d.goal.n + " puntos" : d.goal.type === "lines" ? "Limpia " + d.goal.n + " líneas" : "Rompe " + d.goal.n + " gemas";
    return { id: i + 1, goal: d.goal, text: text, seed: d.seed, diff: d.diff, board: prefill(d.seed, d.fill, d.gems) };
  });
  root.LEVELS_DATA = LEVELS;
  if (typeof module !== "undefined") module.exports = LEVELS;
})(typeof window !== "undefined" ? window : globalThis);
