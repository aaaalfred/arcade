/* Iconos de la interfaz, dibujados en el mismo estilo (contorno café y colores pastel). */
(function (C) {
  "use strict";
  const { OL, P, L, E, Ef, R, star, heart, svg } = C.U;
  const V = "0 0 48 48";

  const carita = (fondo, ojos, boca, extra = "") =>
    svg(V, E(24, 24, 19, 19, fondo, 3) + ojos + boca + extra);
  const ojosNormales = Ef(17, 22, 2.8, 3.6, OL) + Ef(31, 22, 2.8, 3.6, OL);

  const I = {
    casa: svg(V, P("M 8,24 L 24,9 L 40,24 L 36,24 L 36,40 L 12,40 L 12,24 Z", "#ffd6dd", 3) + R(20, 28, 9, 12, 3, "#9ed9bd", 2.5) + P("M 5,25 L 24,7 L 43,25", "none", 3.5)),
    sonido: svg(V, P("M 8,19 L 16,19 L 26,10 L 26,38 L 16,29 L 8,29 Z", "#ffd36e", 3) + L("M 31,18 C 35,21 35,27 31,30 M 35,13 C 42,19 42,29 35,35", OL, 3.5)),
    silencio: svg(V, P("M 8,19 L 16,19 L 26,10 L 26,38 L 16,29 L 8,29 Z", "#e6dcd6", 3) + L("M 31,18 L 41,30 M 41,18 L 31,30", "#e5484d", 4)),
    reiniciar: svg(V, L("M 37,16 A 15,15 0 1 0 39,28", OL, 5) + L("M 37,16 A 15,15 0 1 0 39,28", "#8fc3f0", 2.5) + P("M 30,10 L 40,16 L 32,22 Z", "#8fc3f0", 3)),
    editar: svg(V, P("M 16,10 L 20,8 Q 24,13 28,8 L 32,10 L 41,18 L 35,24 L 33,22 L 33,40 L 15,40 L 15,22 L 13,24 L 7,18 Z", "#c9a6e8", 3) + star(24, 28, 6, "#fff3b0", 2)),
    izquierda: svg(V, P("M 30,10 L 14,24 L 30,38 Z", "#fffdf8", 3.5)),
    derecha: svg(V, P("M 18,10 L 34,24 L 18,38 Z", "#fffdf8", 3.5)),
    cerrar: svg(V, L("M 14,14 L 34,34 M 34,14 L 14,34", OL, 5)),
    check: svg(V, L("M 12,25 L 21,34 L 37,15", OL, 5)),
    bandeja: svg(V, P("M 6,28 L 42,28 L 38,38 L 10,38 Z", "#e9b98a", 3) + heart(24, 21, 6, "#ff8fa3", 2.5)),
    feliz: carita("#ffe08a", ojosNormales, L("M 15,29 Q 24,37 33,29", OL, 3)),
    triste: carita("#bfe0ff", ojosNormales, L("M 16,34 Q 24,27 32,34", OL, 3), P("M 15,28 C 13,32 14,34 16,34 C 18,34 18,31 15,28 Z", "#8fc3f0", 1.5)),
    sorpresa: carita("#ffd6dd", Ef(17, 21, 3.4, 4.4, OL) + Ef(31, 21, 3.4, 4.4, OL), E(24, 32, 4, 5, "#9b3d36", 2.5)),
    enojo: carita("#ffb3a8", ojosNormales + L("M 12,15 L 21,19 M 36,15 L 27,19", OL, 3), L("M 16,33 Q 24,28 32,33", OL, 3)),
  };

  C.Iconos = I;
})(window.Casita);
