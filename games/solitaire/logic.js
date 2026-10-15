/* Lógica pura de Klondike (sin DOM). Funciona en navegador (window.Solitaire) y Node (module.exports).
   Carta = entero 0..51: palo = c/13|0 (0 ♠, 1 ♥, 2 ♦, 3 ♣), rango = c%13+1 (1=A..13=K). */
(function (root) {
  "use strict";
  const suit = (c) => (c / 13) | 0;
  const rank = (c) => (c % 13) + 1;
  const isRed = (c) => { const s = suit(c); return s === 1 || s === 2; };

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffledDeck(seed) {
    const d = []; for (let i = 0; i < 52; i++) d.push(i);
    const r = rng(seed);
    for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }

  /* Estado: cols (7 pilas, la última carta es la superior), fu[i] = índice de la primera carta boca arriba,
     found[palo] = nº de cartas en la fundación, stock (se roba del final), waste (superior = final). */
  function newGame(deck, draw, vegas) {
    const cols = [], fu = []; let k = 0;
    for (let i = 0; i < 7; i++) { cols.push(deck.slice(k, k + i + 1)); k += i + 1; fu.push(i); }
    return { cols, fu, found: [0, 0, 0, 0], stock: deck.slice(k), waste: [], draw: draw === 3 ? 3 : 1,
             vegas: !!vegas, score: vegas ? -52 : 0, moves: 0, recycles: 0 };
  }
  function clone(s) {
    return { cols: s.cols.map((c) => c.slice()), fu: s.fu.slice(), found: s.found.slice(), stock: s.stock.slice(),
             waste: s.waste.slice(), draw: s.draw, vegas: s.vegas, score: s.score, moves: s.moves, recycles: s.recycles };
  }
  const isWon = (s) => s.found[0] + s.found[1] + s.found[2] + s.found[3] === 52;
  const allFaceUp = (s) => s.cols.every((c, i) => c.length === 0 || s.fu[i] === 0);

  function canToFound(s, c) { return rank(c) === s.found[suit(c)] + 1; }
  function canToCol(s, c, to) {
    const col = s.cols[to];
    if (!col.length) return rank(c) === 13;
    const t = col[col.length - 1];
    return rank(t) === rank(c) + 1 && isRed(t) !== isRed(c);
  }
  function maxRecycles(s) { return s.vegas ? (s.draw === 3 ? 2 : 0) : Infinity; }
  function canDraw(s) { return s.stock.length > 0 || (s.waste.length > 0 && s.recycles < maxRecycles(s)); }

  function legalMoves(s, o) {
    o = o || {}; const ms = [];
    for (let f = 0; f < 7; f++) {
      const col = s.cols[f]; if (col.length && canToFound(s, col[col.length - 1])) ms.push({ t: "t2f", from: f });
    }
    if (s.waste.length) {
      const w = s.waste[s.waste.length - 1];
      if (canToFound(s, w)) ms.push({ t: "w2f" });
      let emp = false;
      for (let to = 0; to < 7; to++) if (canToCol(s, w, to)) {
        if (!s.cols[to].length) { if (emp) continue; emp = true; }
        ms.push({ t: "w2t", to });
      }
    }
    for (let f = 0; f < 7; f++) {
      const col = s.cols[f];
      for (let idx = s.fu[f]; idx < col.length; idx++) {
        let emp = false;
        for (let to = 0; to < 7; to++) {
          if (to === f || !canToCol(s, col[idx], to)) continue;
          if (!s.cols[to].length) { if (idx === 0 || emp) continue; emp = true; }
          ms.push({ t: "t2t", from: f, idx, to });
        }
      }
    }
    if (!o.noF2T) for (let p = 0; p < 4; p++) if (s.found[p] > 0) {
      const c = p * 13 + s.found[p] - 1; let emp = false;
      for (let to = 0; to < 7; to++) if (canToCol(s, c, to)) {
        if (!s.cols[to].length) { if (emp) continue; emp = true; }
        ms.push({ t: "f2t", f: p, to });
      }
    }
    if (canDraw(s)) ms.push({ t: "draw" });
    return ms;
  }

  function reveal(s, i) {
    const col = s.cols[i];
    if (!col.length) { s.fu[i] = 0; return false; }
    if (s.fu[i] >= col.length) { s.fu[i] = col.length - 1; return true; }
    return false;
  }
  function dropOn(s, to, cards) { const was = s.cols[to].length; s.cols[to].push(...cards); if (!was) s.fu[to] = 0; }

  /* Aplica un movimiento (muta s). Devuelve true si se descubrió una carta. */
  function applyMove(s, m) {
    const v = s.vegas; let flipped = false;
    s.moves++;
    switch (m.t) {
      case "draw":
        if (s.stock.length) { const n = Math.min(s.draw, s.stock.length); for (let i = 0; i < n; i++) s.waste.push(s.stock.pop()); }
        else { s.stock = s.waste.slice().reverse(); s.waste = []; s.recycles++;
               if (!v) s.score = Math.max(0, s.score - (s.draw === 1 ? 100 : 20)); }
        break;
      case "w2f": { const c = s.waste.pop(); s.found[suit(c)]++; s.score += v ? 5 : 10; break; }
      case "w2t": { const c = s.waste.pop(); dropOn(s, m.to, [c]); if (!v) s.score += 5; break; }
      case "t2f": { const c = s.cols[m.from].pop(); s.found[suit(c)]++; s.score += v ? 5 : 10;
                    flipped = reveal(s, m.from); if (flipped && !v) s.score += 5; break; }
      case "t2t": { const run = s.cols[m.from].splice(m.idx); dropOn(s, m.to, run);
                    flipped = reveal(s, m.from); if (flipped && !v) s.score += 5; break; }
      case "f2t": { const c = m.f * 13 + s.found[m.f] - 1; s.found[m.f]--; dropOn(s, m.to, [c]); s.score += v ? -5 : -15; break; }
    }
    return flipped;
  }

  /* Elección de jugada automática */
  function wasteMove(s) {
    const w = s.waste[s.waste.length - 1]; if (w === undefined) return null;
    const tf = canToFound(s, w) ? { t: "w2f" } : null;
    if (tf && rank(w) <= 2) return tf;
    for (let to = 0; to < 7; to++) if (s.cols[to].length && canToCol(s, w, to)) return { t: "w2t", to };
    if (tf) return tf;
    for (let to = 0; to < 7; to++) if (canToCol(s, w, to)) return { t: "w2t", to };
    return null;
  }
  function tabMove(s, from, idx) {
    const col = s.cols[from]; if (idx < s.fu[from] || idx >= col.length) return null;
    const c = col[idx], top = idx === col.length - 1;
    const tf = top && canToFound(s, c) ? { t: "t2f", from } : null;
    if (tf && rank(c) <= 2) return tf;
    for (let to = 0; to < 7; to++) if (to !== from && s.cols[to].length && canToCol(s, c, to)) return { t: "t2t", from, idx, to };
    if (tf) return tf;
    if (idx > 0) for (let to = 0; to < 7; to++) if (to !== from && !s.cols[to].length && canToCol(s, c, to)) return { t: "t2t", from, idx, to };
    return null;
  }
  /* src: {kind:'tab',col,idx} | {kind:'waste'} | {kind:'found',f} */
  function tapMove(s, src) {
    if (src.kind === "waste") return wasteMove(s);
    if (src.kind === "tab") return tabMove(s, src.col, src.idx);
    if (src.kind === "found" && s.found[src.f] > 0) {
      const c = src.f * 13 + s.found[src.f] - 1;
      for (let to = 0; to < 7; to++) if (s.cols[to].length && canToCol(s, c, to)) return { t: "f2t", f: src.f, to };
    }
    return null;
  }
  function foundMove(s, src) {
    if (src.kind === "waste") { const w = s.waste[s.waste.length - 1]; return w !== undefined && canToFound(s, w) ? { t: "w2f" } : null; }
    if (src.kind === "tab") { const col = s.cols[src.col];
      return src.idx === col.length - 1 && src.idx >= s.fu[src.col] && canToFound(s, col[src.idx]) ? { t: "t2f", from: src.col } : null; }
    return null;
  }
  function hint(s) {
    let best = null, bs = -1;
    for (const m of legalMoves(s)) {
      let v = 0;
      if (m.t === "t2f") v = 60 + (s.cols[m.from].length - 1 === s.fu[m.from] && s.fu[m.from] > 0 ? 15 : 0);
      else if (m.t === "w2f") v = 55;
      else if (m.t === "t2t") {
        if (m.idx === s.fu[m.from] && s.fu[m.from] > 0) v = 70;
        else if (m.idx === s.fu[m.from]) v = 40;
        else v = s.cols[m.to].length ? 10 : 65;
        if (!s.cols[m.to].length && m.idx > 0 && m.idx === s.fu[m.from]) v = 72;
      } else if (m.t === "w2t") v = 45;
      else if (m.t === "draw") v = 5;
      else v = 1;
      if (v > bs) { bs = v; best = m; }
    }
    return best;
  }
  /* Autocompletar: solo fundaciones y robar; null si no hay progreso posible */
  function autoStep(s) {
    for (let f = 0; f < 7; f++) { const col = s.cols[f]; if (col.length && canToFound(s, col[col.length - 1])) return { t: "t2f", from: f }; }
    if (s.waste.length && canToFound(s, s.waste[s.waste.length - 1])) return { t: "w2f" };
    return canDraw(s) ? { t: "draw" } : null;
  }

  /* ---- Solver DFS con límite de nodos (sin movimientos fundación->tableau) ---- */
  function key(s) {
    let k = "";
    for (let i = 0; i < 7; i++) { k += String.fromCharCode(...s.cols[i].map((c) => c + 48)) + s.fu[i] + "|"; }
    return k + s.found.join("") + String.fromCharCode(...s.stock.map((c) => c + 48)) + "#" + String.fromCharCode(...s.waste.map((c) => c + 48));
  }
  const PRI = { t2t: 0, w2t: 1, t2f: 2, w2f: 2, draw: 9 };
  function solve(start, limit) {
    const seen = new Set(); let nodes = 0; const path = [];
    function rec(s) {
      if (isWon(s)) return true;
      if (++nodes > limit) return false;
      const k = key(s); if (seen.has(k)) return false; seen.add(k);
      const ms = legalMoves(s, { noF2T: true });
      const sc = (m) => {
        if (m.t === "t2t") return m.idx === s.fu[m.from] && s.fu[m.from] > 0 ? -5 : (m.idx === s.fu[m.from] ? 3 : 6);
        if (m.t === "t2f" || m.t === "w2f") return rank(m.t === "w2f" ? s.waste[s.waste.length - 1] : s.cols[m.from][s.cols[m.from].length - 1]) <= 3 ? -8 : 1;
        return PRI[m.t];
      };
      ms.sort((a, b) => sc(a) - sc(b));
      for (const m of ms) {
        const n = clone(s); applyMove(n, m); path.push(m);
        if (rec(n)) return true;
        path.pop(); if (nodes > limit) return false;
      }
      return false;
    }
    const s0 = clone(start); s0.vegas = false; s0.recycles = 0;
    const won = rec(s0);
    return { won, nodes, moves: won ? path.slice() : null };
  }
  /* Busca un reparto ganable a partir de una semilla (para aleatorio/diario) */
  function findWinnable(seed, draw, tries, limit) {
    for (let i = 0; i < tries; i++) {
      const sd = seed + i, deck = shuffledDeck(sd);
      if (solve(newGame(deck, draw), limit).won) return { seed: sd, deck, verified: true };
    }
    const sd = seed + tries; return { seed: sd, deck: shuffledDeck(sd), verified: false };
  }

  root.Solitaire = { suit, rank, isRed, rng, shuffledDeck, newGame, clone, isWon, allFaceUp, canToFound, canToCol, canDraw,
    legalMoves, applyMove, tapMove, foundMove, hint, autoStep, solve, findWinnable, key };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Solitaire;
})(typeof window !== "undefined" ? window : globalThis);
