/* 10 niveles. blocks = índices (fila*ancho+col) de casillas bloqueadas.
   maxMoves = límite de movimientos (null = sin límite). s3/s2 = movimientos máx. para 3/2 estrellas. */
(function (root) {
  "use strict";
  // Mínimo teórico de movimientos ~ objetivo / 2.2 (cada movimiento añade ~2.2 de suma).
  function mk(id, w, h, target, blocks, maxMoves) {
    const min = Math.ceil(target / 2.2);
    return { id: id, w: w, h: h, target: target, blocks: blocks || [], maxMoves: maxMoves || null,
             s3: Math.ceil(min * 1.45), s2: Math.ceil(min * 1.9) };
  }
  root.LEVELS_DATA = [
    mk(1, 4, 4, 128),
    mk(2, 4, 4, 256),
    mk(3, 5, 5, 256),
    mk(4, 4, 4, 256, [5, 10]),
    mk(5, 5, 5, 512),
    mk(6, 3, 3, 128),
    mk(7, 4, 4, 512, [], 330),
    mk(8, 5, 5, 512, [6, 12, 18], null),
    mk(9, 4, 4, 1024),
    mk(10, 4, 4, 2048)
  ];
  if (typeof module !== "undefined" && module.exports) module.exports = root.LEVELS_DATA;
})(typeof window !== "undefined" ? window : globalThis);
