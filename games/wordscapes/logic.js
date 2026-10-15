/* Logica pura de Palabras en Rueda (sin DOM). Funciona en navegador (window.Logic) y Node (module.exports). */
(function (root) {
  "use strict";
  function normalize(w) {
    return String(w).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  }
  function counts(s) { var m = {}; for (var i = 0; i < s.length; i++) m[s[i]] = (m[s[i]] || 0) + 1; return m; }
  // ¿se puede formar `word` con las letras de la rueda (cada letra una vez)?
  function canForm(word, letters) {
    var have = counts(letters);
    for (var i = 0; i < word.length; i++) { var c = word[i]; if (!have[c]) return false; have[c]--; }
    return true;
  }
  // celdas [r,c] de una palabra del crucigrama
  function cellsOf(w) {
    var out = [];
    for (var i = 0; i < w.w.length; i++) out.push([w.r + (w.d === "v" ? i : 0), w.c + (w.d === "h" ? i : 0)]);
    return out;
  }
  // estado nuevo: palabras halladas del crucigrama, extras halladas, celdas reveladas por pista
  function newState() { return { found: [], bonus: [], hinted: {}, hints: 0 }; }
  // evalua un intento. Devuelve {type: "grid"|"bonus"|"dup"|"short"|"invalid", word}
  function submit(level, st, raw) {
    var w = normalize(raw);
    if (w.length < 3) return { type: "short", word: w };
    if (st.found.indexOf(w) >= 0 || st.bonus.indexOf(w) >= 0) return { type: "dup", word: w };
    for (var i = 0; i < level.words.length; i++) if (level.words[i].w === w) { st.found.push(w); return { type: "grid", word: w }; }
    if (level.bonus.indexOf(w) >= 0) { st.bonus.push(w); return { type: "bonus", word: w }; }
    return { type: "invalid", word: w };
  }
  // mapa "r,c" -> letra visible (palabras halladas + pistas)
  function revealed(level, st) {
    var m = {};
    level.words.forEach(function (wd) {
      if (st.found.indexOf(wd.w) >= 0) cellsOf(wd).forEach(function (p, i) { m[p[0] + "," + p[1]] = wd.w[i]; });
    });
    Object.keys(st.hinted).forEach(function (k) { m[k] = st.hinted[k]; });
    return m;
  }
  // celdas del crucigrama sin revelar: [{r,c,ch}]
  function hiddenCells(level, st) {
    var vis = revealed(level, st), seen = {}, out = [];
    level.words.forEach(function (wd) {
      if (st.found.indexOf(wd.w) >= 0) return;
      cellsOf(wd).forEach(function (p, i) {
        var k = p[0] + "," + p[1];
        if (!vis[k] && !seen[k]) { seen[k] = 1; out.push({ r: p[0], c: p[1], ch: wd.w[i] }); }
      });
    });
    return out;
  }
  // aplica una pista: revela una celda oculta (rnd en [0,1)). Si completa palabras, las marca halladas.
  function applyHint(level, st, rnd) {
    var h = hiddenCells(level, st);
    if (!h.length) return null;
    var cell = h[Math.floor(rnd * h.length) % h.length];
    st.hinted[cell.r + "," + cell.c] = cell.ch;
    st.hints++;
    var vis = revealed(level, st), done = [];
    level.words.forEach(function (wd) {
      if (st.found.indexOf(wd.w) >= 0) return;
      if (cellsOf(wd).every(function (p) { return vis[p[0] + "," + p[1]]; })) { st.found.push(wd.w); done.push(wd.w); }
    });
    return { cell: cell, completed: done };
  }
  function isComplete(level, st) { return level.words.every(function (w) { return st.found.indexOf(w.w) >= 0; }); }
  // puntos: 10 por letra de palabra del crucigrama (no pista), 5 por letra de extra
  function points(level, st) {
    var p = 0;
    st.found.forEach(function (w) { p += 10 * w.length; });
    st.bonus.forEach(function (w) { p += 5 * w.length; });
    return p;
  }
  // estrellas: 3 sin pistas, 2 con 1-2 pistas, 1 con mas
  function stars(st) { return st.hints === 0 ? 3 : st.hints <= 2 ? 2 : 1; }
  var API = { normalize: normalize, canForm: canForm, cellsOf: cellsOf, newState: newState, submit: submit,
    revealed: revealed, hiddenCells: hiddenCells, applyHint: applyHint, isComplete: isComplete, points: points, stars: stars };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.Logic = API;
})(typeof window !== "undefined" ? window : this);
