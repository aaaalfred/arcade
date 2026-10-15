/* Pruebas de lógica pura: node test.js */
const S = require("./logic.js"), DEALS = require("./deals.js"), assert = require("assert");
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
// baraja y reparto
const d = S.shuffledDeck(5); ok(new Set(d).size === 52, "baraja 52 únicas");
let s = S.newGame(d, 1);
ok(s.cols.map((c) => c.length).join() === "1,2,3,4,5,6,7" && s.stock.length === 24, "reparto 1..7 y mazo 24");
ok(s.fu.every((f, i) => f === i), "solo la superior boca arriba");
// reglas
const C = (suit, rank) => suit * 13 + rank - 1;
s = S.newGame(d, 1); s.cols = [[C(0, 7)], [C(1, 6)], [], [C(2, 13)], [C(3, 6)], [], []]; s.fu = [0, 0, 0, 0, 0, 0, 0];
ok(S.canToCol(s, C(1, 6), 0), "6♥ sobre 7♠ (colores alternos)");
ok(!S.canToCol(s, C(3, 6), 1) , "6♣ no sobre 6♥");
ok(!S.canToCol(s, C(3, 6), 4), "mismo color no");
ok(S.canToCol(s, C(2, 13), 2) && !S.canToCol(s, C(0, 12), 2), "solo rey en columna vacía");
ok(!S.canToFound(s, C(0, 2)) && S.canToFound(s, C(0, 1)), "fundación empieza en A");
// robar 1 y 3, reciclar
s = S.newGame(d, 3); const top3 = s.stock.slice(-3).reverse();
S.applyMove(s, { t: "draw" }); ok(s.waste.length === 3 && s.waste[2] === top3[2] && s.stock.length === 21, "robar 3");
s = S.newGame(d, 1); for (let i = 0; i < 24; i++) S.applyMove(s, { t: "draw" }); S.applyMove(s, { t: "draw" });
ok(s.stock.length === 24 && s.waste.length === 0 && s.recycles === 1, "reciclar mazo");
// Vegas: límite de pasadas
s = S.newGame(d, 1, true); ok(s.score === -52, "Vegas -52"); for (let i = 0; i < 24; i++) S.applyMove(s, { t: "draw" });
ok(!S.canDraw(s), "Vegas robar 1: una sola pasada");
// puntuación estándar
s = S.newGame(d, 1); s.cols = [[C(3, 5), C(0, 1)], [], [], [], [], [], []]; s.fu = [1, 0, 0, 0, 0, 0, 0];
S.applyMove(s, { t: "t2f", from: 0 }); ok(s.score === 15 && s.fu[0] === 0 && s.found[0] === 1, "A a fundación +10, voltear +5");
// repartos: la solución del solver se reproduce con applyMove y gana; 5 de robar 1, 5 de robar 3
ok(DEALS.length === 10 && DEALS.slice(0, 5).every((x) => x.draw === 1) && DEALS.slice(5).every((x) => x.draw === 3), "10 niveles 1-5 R1, 6-10 R3");
DEALS.forEach((x, i) => {
  ok(new Set(x.deck).size === 52, "mazo válido nivel " + (i + 1));
  const g = S.newGame(x.deck, x.draw), r = S.solve(g, 300000);
  ok(r.won, "solver gana nivel " + (i + 1));
  const t = S.clone(g);
  r.moves.forEach((m) => { const legal = S.legalMoves(t, { noF2T: true }).some((l) => JSON.stringify(l) === JSON.stringify(m)); ok(legal, "movimiento legal"); S.applyMove(t, m); });
  ok(S.isWon(t), "reproducción gana nivel " + (i + 1));
  console.log("nivel", i + 1, "robar", x.draw, "nodos", r.nodes, "movs", r.moves.length);
});
// autocompletar y pista sobre estado ganado a mitad
let t = S.newGame(DEALS[0].deck, 1), r = S.solve(t, 300000), k = 0;
for (const m of r.moves) { S.applyMove(t, m); if (S.allFaceUp(t)) break; k++; }
ok(S.allFaceUp(t), "se alcanza todo boca arriba"); let guard = 0;
while (!S.isWon(t) && guard++ < 2000) S.applyMove(t, S.autoStep(t));
ok(S.isWon(t), "autocompletar termina en victoria");
ok(S.hint(S.newGame(DEALS[0].deck, 1)) !== null, "pista existe");
// tiempo de findWinnable (aleatorio/diario)
const t0 = Date.now(); const fw = S.findWinnable(20261013 * 10 + 3, 3, 8, 15000); console.log("findWinnable", fw.verified, Date.now() - t0, "ms");
console.log("OK", n, "comprobaciones");
