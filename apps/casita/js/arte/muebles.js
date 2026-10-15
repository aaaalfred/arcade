/* Muebles y fondos de habitación. Cada mueble se dibuja en su propio SVG (0,0 a w,h)
   para poder ordenarlo en capas con los personajes y los objetos. */
(function (C) {
  "use strict";
  const { OL, shade, P, F, L, E, Ef, R, Rf, star, heart, mirror, svg } = C.U;

  const MADERA = "#d99a68", MADERA_OSC = "#b97b4e", MADERA_CLARA = "#ecc195";

  const arte = {
    alfombra(st, d) {
      const w = d.w, h = d.h, c = d.color || "#f7b6c8";
      return Ef(w / 2, h / 2 + 4, w / 2 - 6, h / 2 - 8, "rgba(60,30,20,0.10)") +
        E(w / 2, h / 2, w / 2 - 8, h / 2 - 10, c, 3.5) +
        `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 30}" ry="${h / 2 - 26}" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="14 10" opacity="0.8"/>` +
        Ef(w / 2, h / 2, w / 2 - 70, h / 2 - 45, shade(c, 0.25));
    },

    librero() {
      let g = R(6, 14, 178, 356, 8, MADERA) + Rf(20, 26, 150, 330, 4, MADERA_OSC);
      for (const y of [95, 210, 325]) g += R(12, y, 166, 13, 4, MADERA_CLARA, 3);
      g += R(0, 4, 190, 20, 7, MADERA_CLARA) + R(12, 360, 166, 14, 4, shade(MADERA, -0.1), 3);
      // macetita decorativa arriba
      g += P("M 140,4 L 168,4 L 164,-2 L 144,-2 Z", "#f08a7a", 2.5);
      return g;
    },

    sofa() {
      const c = "#f2a7a0", cd = shade(c, -0.12), cl = shade(c, 0.22);
      const brazo = P("M 8,82 C 8,60 20,54 40,54 C 60,54 68,64 68,82 L 68,180 Q 68,188 60,188 L 16,188 Q 8,188 8,180 Z", cd) +
        Ef(38, 70, 18, 7, shade(c, 0.15));
      return Ef(220, 192, 210, 8, "rgba(60,30,20,0.15)") +
        R(30, 182, 14, 16, 3, MADERA_OSC, 3) + R(396, 182, 14, 16, 3, MADERA_OSC, 3) +
        P("M 40,44 C 40,16 60,8 90,8 L 350,8 C 380,8 400,16 400,44 L 400,124 L 40,124 Z", c) +
        R(62, 26, 152, 86, 22, cl, 3) + R(226, 26, 152, 86, 22, cl, 3) +
        `<circle cx="138" cy="66" r="3.5" fill="${cd}"/><circle cx="302" cy="66" r="3.5" fill="${cd}"/>` +
        P("M 30,112 L 410,112 L 410,180 Q 410,188 400,188 L 40,188 Q 30,188 30,180 Z", cd) +
        R(52, 92, 166, 40, 14, cl, 3) + R(222, 92, 166, 40, 14, cl, 3) +
        brazo + `<g transform="translate(440,0) scale(-1,1)">${brazo}</g>` +
        // cojín
        P("M 80,60 C 76,40 96,32 112,40 C 126,32 142,44 136,62 C 142,80 122,90 110,82 C 96,92 74,80 80,60 Z", "#ffd36e", 3) +
        heart(108, 62, 7, "#fff3b0", 2);
    },

    sillon() {
      const c = "#f6c66e", cd = shade(c, -0.14), cl = shade(c, 0.25);
      const brazo = P("M 10,74 C 10,56 20,50 36,50 C 52,50 58,58 58,74 L 58,168 Q 58,176 50,176 L 18,176 Q 10,176 10,168 Z", cd);
      return Ef(105, 182, 98, 7, "rgba(60,30,20,0.15)") +
        R(28, 170, 12, 16, 3, MADERA_OSC, 3) + R(170, 170, 12, 16, 3, MADERA_OSC, 3) +
        P("M 32,34 C 32,10 52,4 105,4 C 158,4 178,10 178,34 L 178,112 L 32,112 Z", c) +
        R(50, 22, 110, 76, 22, cl, 3) +
        P("M 26,104 L 184,104 L 184,168 Q 184,176 176,176 L 34,176 Q 26,176 26,168 Z", cd) +
        R(44, 86, 122, 36, 14, cl, 3) +
        brazo + `<g transform="translate(210,0) scale(-1,1)">${brazo}</g>`;
    },

    mesa_centro() {
      return Ef(120, 90, 108, 6, "rgba(60,30,20,0.15)") +
        R(22, 20, 14, 70, 4, MADERA_OSC, 3) + R(204, 20, 14, 70, 4, MADERA_OSC, 3) +
        R(30, 56, 180, 10, 3, MADERA, 3) +
        R(4, 6, 232, 18, 8, MADERA_CLARA) + L("M 16,16 L 224,16", shade(MADERA_CLARA, -0.15), 2);
    },

    lampara_pie(st) {
      const on = st && st.on;
      const pantalla = on ? "#fff3b0" : "#ffd9a8";
      return Ef(70, 372, 52, 11, "rgba(60,30,20,0.15)") +
        (on ? `<circle cx="70" cy="80" r="70" fill="#fff6c8" opacity="0.55"/>` : "") +
        R(64, 104, 12, 256, 5, "#c9a27e", 3) +
        E(70, 366, 46, 11, "#c98a5a") +
        (on ? E(70, 108, 12, 10, "#fffbe0", 2.5) : "") +
        P("M 18,112 L 122,112 L 102,20 L 38,20 Z", pantalla) +
        L("M 24,96 L 116,96", shade(pantalla, -0.15), 3) +
        `<g opacity="0.7">${L("M 46,30 L 34,104", "#fff", 3)}</g>`;
    },

    planta() {
      const hoja = (d, c) => P(d, c, 3);
      return Ef(55, 168, 34, 5, "rgba(60,30,20,0.15)") +
        hoja("M 55,112 C 20,100 6,70 16,48 C 36,56 50,84 55,112 Z", "#7cc47a") +
        hoja("M 55,112 C 90,96 104,62 92,40 C 72,52 60,82 55,112 Z", "#8fd18a") +
        hoja("M 55,112 C 44,76 40,36 56,8 C 72,36 66,76 55,112 Z", "#6cb46a") +
        hoja("M 55,112 C 30,96 26,82 34,74 C 46,82 52,96 55,112 Z", "#9be095") +
        P("M 24,108 L 86,108 L 78,166 L 32,166 Z", "#f08a7a") + R(20, 104, 70, 14, 5, shade("#f08a7a", 0.15), 3);
    },

    refri(st) {
      const abierto = st && st.open;
      const c = "#cfe9f6", cp = "#dcf0fa";
      let g = Ef(130, 474, 116, 7, "rgba(60,30,20,0.15)") +
        R(10, 10, 230, 460, 22, c) +
        R(14, 14, 222, 140, 18, cp, 3) + R(206, 60, 12, 56, 6, "#9fb7c8", 3) +
        star(60, 70, 13, "#ffd65a") + heart(100, 66, 9, "#ff8fa3");
      if (!abierto) {
        g += R(14, 158, 222, 308, 18, cp, 3) + R(206, 190, 12, 96, 6, "#9fb7c8", 3) +
          // dibujo infantil pegado con imán
          `<g transform="rotate(-6 100 270)">${R(60, 220, 90, 80, 4, "#fffdf6", 3)}` +
          E(84, 246, 10, 10, "#ffd65a", 2.5) + L("M 66,288 Q 90,268 112,282 Q 128,272 144,284", "#7cc47a", 3) +
          L("M 120,250 L 120,272 M 112,258 L 128,258", "#f07a7a", 2.5) + `</g>` +
          E(105, 222, 6, 6, "#ff8fa3", 2.5);
      } else {
        g += R(24, 160, 202, 302, 12, "#f6fcff", 3) +
          Rf(28, 164, 194, 36, 10, "#fffbe0", 'opacity="0.9"') +
          R(26, 246, 198, 8, 3, "#c4e4f2", 2.5) + R(26, 356, 198, 8, 3, "#c4e4f2", 2.5) +
          F("M 240,160 L 302,178 L 302,450 L 240,468 Z", "rgba(60,30,20,0.08)") +
          P("M 240,160 L 300,176 L 300,452 L 240,468 Z", cp) +
          L("M 246,236 L 294,244 M 246,316 L 294,320 M 246,396 L 294,398", "#b0cfdf", 3) +
          R(254, 210, 12, 26, 3, "#ffb35c", 2) + R(270, 214, 12, 24, 3, "#8fd17a", 2) +
          R(256, 292, 30, 22, 4, "#ffe08a", 2);
      }
      return g;
    },

    barra() {
      const c = "#9ed9bd", cl = shade(c, 0.2);
      return Ef(280, 254, 270, 7, "rgba(60,30,20,0.15)") +
        P("M 104,72 L 104,36 C 104,24 112,18 124,18 L 146,18 C 152,18 154,22 154,26 L 154,34 L 142,34 L 142,30 L 124,30 C 118,30 116,34 116,40 L 116,72 Z", "#c7d2de", 3) +
        R(14, 90, 532, 162, 8, c) +
        R(26, 104, 116, 138, 8, cl, 3) + R(150, 104, 116, 138, 8, cl, 3) +
        R(118, 160, 8, 26, 4, "#fff", 2.5) + R(166, 160, 8, 26, 4, "#fff", 2.5) +
        R(282, 104, 252, 138, 8, "#f6f6f6", 3) + R(302, 134, 212, 72, 12, "#5a4a54", 3) +
        Rf(312, 142, 80, 20, 8, "#7d6b77") + R(320, 116, 176, 9, 4, "#c7d2de", 2.5) +
        R(4, 70, 552, 22, 6, "#fff6ea") +
        Ef(130, 77, 54, 5, "#a9bccd") +
        Ef(360, 75, 42, 5, "#4a3a44") + Ef(468, 75, 42, 5, "#4a3a44") +
        R(20, 250, 520, 8, 3, shade(c, -0.2), 2.5);
    },

    repisa() {
      const sop = P("M 40,26 L 40,56 L 70,26 Z", MADERA, 3);
      return sop + `<g transform="translate(380,0) scale(-1,1)">${sop}</g>` +
        R(4, 14, 372, 14, 5, MADERA_CLARA);
    },

    mesa() {
      const mantel = "#ffc3d1";
      return Ef(150, 134, 136, 6, "rgba(60,30,20,0.15)") +
        R(26, 26, 16, 108, 4, MADERA_OSC, 3) + R(258, 26, 16, 108, 4, MADERA_OSC, 3) +
        R(4, 8, 292, 18, 6, MADERA_CLARA) +
        P("M 12,22 L 288,22 L 284,60 C 270,66 256,58 244,64 C 230,70 216,60 202,66 C 188,72 172,62 158,68 C 144,72 128,62 114,68 C 100,72 86,62 72,66 C 58,70 44,60 30,64 L 16,60 Z", mantel, 3) +
        L("M 50,24 L 46,62 M 100,24 L 98,66 M 150,24 L 150,68 M 200,24 L 202,66 M 250,24 L 254,62", "#fff", 3, 'opacity="0.7"');
    },

    silla() {
      const c = "#f7a8b8";
      return Ef(60, 192, 50, 5, "rgba(60,30,20,0.15)") +
        R(18, 96, 12, 96, 4, MADERA_OSC, 3) + R(90, 96, 12, 96, 4, MADERA_OSC, 3) + R(24, 150, 72, 8, 3, MADERA, 2.5) +
        R(22, 6, 76, 84, 18, c) + heart(60, 46, 12, "#fff", 2.5) +
        R(8, 78, 104, 22, 9, shade(c, 0.2));
    },

    juguetero() {
      const caja = (x, c) => R(x, 146, 66, 64, 8, c, 3) + R(x + 22, 160, 22, 8, 4, shade(c, -0.15), 2);
      return Ef(125, 222, 118, 6, "rgba(60,30,20,0.15)") +
        R(14, 22, 222, 196, 10, "#a8d8c4") + Rf(26, 26, 198, 92, 6, shade("#a8d8c4", -0.12)) +
        R(14, 118, 222, 11, 3, "#c9ecdc", 3) +
        caja(26, "#ffb3c6") + caja(92, "#ffe08a") + caja(158, "#a9cdf2") +
        R(4, 12, 242, 14, 6, "#c9ecdc");
    },

    mesita() {
      return Ef(60, 108, 54, 5, "rgba(60,30,20,0.15)") +
        R(14, 20, 92, 82, 8, MADERA) + R(24, 34, 72, 26, 6, MADERA_CLARA, 3) + R(24, 66, 72, 26, 6, MADERA_CLARA, 3) +
        E(60, 47, 4, 4, "#fff", 2) + E(60, 79, 4, 4, "#fff", 2) +
        R(4, 6, 112, 16, 6, MADERA_CLARA);
    },

    lampara_mesa(st) {
      const on = st && st.on;
      const pantalla = on ? "#fff3b0" : "#e9c8f2";
      return (on ? `<circle cx="35" cy="40" r="44" fill="#fff6c8" opacity="0.6"/>` : "") +
        R(31, 56, 8, 52, 3, "#c9a27e", 2.5) + E(35, 112, 22, 7, "#b48ad8", 3) +
        (on ? E(35, 58, 7, 6, "#fffbe0", 2) : "") +
        P("M 8,60 L 62,60 L 52,14 L 18,14 Z", pantalla) + L("M 12,50 L 58,50", shade(pantalla, -0.15), 2.5);
    },

    cama() {
      const madera = "#c98a5a";
      return Ef(270, 244, 250, 7, "rgba(60,30,20,0.15)") +
        P("M 12,240 L 12,56 C 12,28 30,18 50,18 C 70,18 90,28 90,56 L 90,240 Z", madera) +
        heart(51, 70, 14, "#ffb3c6") +
        R(60, 150, 430, 62, 10, MADERA, 3.5) + R(70, 212, 16, 30, 4, MADERA_OSC, 3) + R(462, 212, 16, 30, 4, MADERA_OSC, 3) +
        R(70, 120, 410, 40, 14, "#fffaf3") +
        P("M 98,88 C 96,76 108,72 122,74 L 186,76 C 200,76 206,84 204,96 L 202,116 C 200,126 190,128 176,126 L 112,124 C 100,124 96,118 96,108 Z", "#ffffff") +
        L("M 110,100 L 194,102", "#cfe6fb", 4) +
        P("M 470,240 L 470,108 C 470,92 482,86 496,86 C 510,86 522,92 522,108 L 522,240 Z", madera);
    },

    manta(st, d) {
      const c = "#b9a3ec", cl = shade(c, 0.3), w = d.w;
      let cuadros = "";
      for (let i = 0; i * 46 < w; i++) cuadros += `<rect x="${18 + i * 46}" y="44" width="22" height="22" rx="4" fill="${cl}"/><rect x="${41 + i * 46}" y="78" width="22" height="22" rx="4" fill="${cl}"/>`;
      return P(`M 6,16 L ${w - 6},16 C ${w - 2},16 ${w},20 ${w},26 L ${w - 4},118 C ${w - 4},128 ${w - 10},134 ${w - 20},134 L 18,134 C 8,134 4,128 4,118 L 2,24 C 2,18 4,16 6,16 Z`, c) +
        `<g clip-path="url(#cp-manta)">${cuadros}</g>` +
        `<defs><clipPath id="cp-manta"><rect x="4" y="36" width="${w - 8}" height="96" rx="10"/></clipPath></defs>` +
        P(`M 4,16 L ${w - 4},16 L ${w - 4},38 L 4,38 Z`, "#fffaf3", 3) + L(`M 10,30 L ${w - 10},30`, "#cfe6fb", 3);
    },

    ropero(st) {
      const abierto = st && st.open;
      const c = "#f4c9df", cp = "#f8d7e8";
      let g = Ef(180, 490, 150, 7, "rgba(60,30,20,0.15)") +
        R(42, 474, 18, 16, 3, MADERA_OSC, 3) + R(300, 474, 18, 16, 3, MADERA_OSC, 3) +
        R(30, 26, 300, 452, 12, c);
      if (!abierto) {
        g += R(42, 40, 136, 424, 8, cp, 3) + R(182, 40, 136, 424, 8, cp, 3) +
          R(56, 112, 108, 160, 10, "none", 2.5) + R(196, 112, 108, 160, 10, "none", 2.5) +
          R(56, 290, 108, 150, 10, "none", 2.5) + R(196, 290, 108, 150, 10, "none", 2.5) +
          heart(110, 76, 11, "#fff", 2.5) + heart(250, 76, 11, "#fff", 2.5) +
          E(166, 262, 6, 6, "#ffd65a", 2.5) + E(194, 262, 6, 6, "#ffd65a", 2.5);
      } else {
        g += R(44, 40, 272, 424, 8, "#e4abc8", 3) +
          R(44, 150, 272, 10, 3, cp, 3) + R(44, 270, 272, 10, 3, cp, 3) +
          L("M 52,300 L 308,300", "#a07a5a", 5) +
          // ropa colgada (decorativa)
          L("M 96,300 Q 96,292 102,290", OL, 2.5) + P("M 80,304 L 112,304 L 124,330 L 118,334 L 116,400 L 76,400 L 74,334 L 68,330 Z", "#9ed9bd", 3) +
          L("M 170,300 Q 170,292 176,290", OL, 2.5) + P("M 150,304 L 190,304 L 196,320 L 186,326 L 210,420 L 130,420 L 154,326 L 144,320 Z", "#ffd36e", 3) +
          L("M 250,300 Q 250,292 256,290", OL, 2.5) + P("M 232,304 L 268,304 L 282,324 L 274,330 L 274,392 L 226,392 L 226,330 L 218,324 Z", "#a9cdf2", 3) +
          R(70, 430, 60, 26, 6, "#f08a7a", 3) + R(230, 430, 60, 26, 6, "#b48ad8", 3) +
          F("M 30,40 L 0,28 L 0,472 L 30,464 Z", "rgba(60,30,20,0.06)") +
          P("M 30,40 L 2,28 L 2,470 L 30,462 Z", cp) + P("M 330,40 L 358,28 L 358,470 L 330,462 Z", cp) +
          E(20, 250, 4, 5, "#ffd65a", 2) + E(340, 250, 4, 5, "#ffd65a", 2);
      }
      g += R(20, 6, 320, 28, 9, shade(c, -0.1)) + heart(180, 20, 7, "#fff", 2);
      return g;
    },
  };

  // ---------- Fondos ----------
  function marcoCasa() {
    return R(-4, -4, 30, 908, 0, "#c98a5a", 4) + R(1574, -4, 30, 908, 0, "#c98a5a", 4) +
      R(-4, -4, 1608, 30, 0, "#d99a68", 4) +
      L("M 26,26 L 26,900 M 1574,26 L 1574,900", "rgba(60,30,20,0.25)", 6);
  }
  function rodapie(color = "#fff6ea") {
    return F("M 0,560 L 1600,560 L 1600,610 L 0,610 Z", "rgba(60,30,20,0.10)") +
      R(-4, 544, 1608, 22, 0, color, 3.5);
  }
  function pisoMadera(c, rayas) {
    let g = Rf(0, 560, 1600, 340, 0, c);
    const filas = [560, 598, 642, 694, 754, 822, 900];
    for (let i = 1; i < filas.length - 1; i++) g += L(`M 0,${filas[i]} L 1600,${filas[i]}`, rayas, 2.5);
    for (let i = 0; i < filas.length - 1; i++) {
      const paso = 190 + i * 40, off = (i % 2) * paso * 0.5;
      for (let x = off; x < 1600; x += paso) g += L(`M ${x},${filas[i] + 2} L ${x},${filas[i + 1] - 2}`, rayas, 2);
    }
    return g + F("M 0,566 L 1600,566 L 1600,600 L 0,600 Z", "rgba(60,30,20,0.08)");
  }
  function ventana(x, y, w, h, cielo, cortina, noche) {
    let g = R(x - 14, y - 14, w + 28, h + 28, 12, "#fffdf8") +
      `<defs><linearGradient id="cielo-${x}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cielo[0]}"/><stop offset="1" stop-color="${cielo[1]}"/></linearGradient></defs>` +
      R(x, y, w, h, 6, `url(#cielo-${x})`, 3);
    if (noche) {
      g += `<circle cx="${x + w * 0.72}" cy="${y + h * 0.3}" r="26" fill="#fff3b0"/><circle cx="${x + w * 0.72 + 12}" cy="${y + h * 0.3 - 8}" r="24" fill="${cielo[0]}"/>`;
      for (const [sx, sy] of [[0.2, 0.25], [0.4, 0.5], [0.3, 0.75], [0.6, 0.7], [0.85, 0.6]]) g += star(x + w * sx, y + h * sy, 7, "#fff3b0", 2);
    } else {
      g += Ef(x + w * 0.3, y + h * 0.35, 44, 16, "#fff") + Ef(x + w * 0.4, y + h * 0.3, 30, 18, "#fff") +
        Ef(x + w * 0.75, y + h * 0.6, 36, 12, "#fff", 'opacity="0.9"') +
        F(`M ${x},${y + h} L ${x},${y + h * 0.8} C ${x + w * 0.3},${y + h * 0.7} ${x + w * 0.6},${y + h * 0.82} ${x + w},${y + h * 0.75} L ${x + w},${y + h} Z`, "#a8dc9a");
    }
    g += L(`M ${x + w / 2},${y} L ${x + w / 2},${y + h} M ${x},${y + h / 2} L ${x + w},${y + h / 2}`, "#fffdf8", 9) +
      L(`M ${x + w / 2},${y} L ${x + w / 2},${y + h} M ${x},${y + h / 2} L ${x + w},${y + h / 2}`, OL, 2) +
      R(x - 24, y + h + 8, w + 48, 16, 6, "#fffdf8");
    // cortinas
    const cd = shade(cortina, -0.15);
    g += R(x - 40, y - 34, w + 80, 12, 6, MADERA_OSC, 3) +
      P(`M ${x - 36},${y - 26} L ${x + 30},${y - 26} C ${x + 20},${y + h * 0.4} ${x + 40},${y + h * 0.7} ${x + 10},${y + h + 20} L ${x - 40},${y + h + 20} Z`, cortina) +
      L(`M ${x - 18},${y - 20} C ${x - 22},${y + h * 0.4} ${x - 14},${y + h * 0.7} ${x - 24},${y + h + 14}`, cd, 3) +
      P(`M ${x + w + 36},${y - 26} L ${x + w - 30},${y - 26} C ${x + w - 20},${y + h * 0.4} ${x + w - 40},${y + h * 0.7} ${x + w - 10},${y + h + 20} L ${x + w + 40},${y + h + 20} Z`, cortina) +
      L(`M ${x + w + 18},${y - 20} C ${x + w + 22},${y + h * 0.4} ${x + w + 14},${y + h * 0.7} ${x + w + 24},${y + h + 14}`, cd, 3);
    return g;
  }
  function cuadro(x, y, w, h, interior) {
    return R(x, y, w, h, 6, MADERA_CLARA) + R(x + 10, y + 10, w - 20, h - 20, 3, "#fffdf6", 3) + interior;
  }

  const fondos = {
    sala() {
      let g = `<defs><pattern id="pat-sala" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="#fde6d2"/><rect width="30" height="64" fill="#fbdcc4"/><circle cx="47" cy="16" r="3" fill="#f7c9ad"/><circle cx="47" cy="48" r="3" fill="#f7c9ad"/></pattern></defs>`;
      g += Rf(0, 0, 1600, 560, 0, "url(#pat-sala)") + pisoMadera("#e9b98a", "#cf9a6a") + rodapie();
      g += ventana(330, 120, 250, 230, ["#9fd6ff", "#d9f1ff"], "#f7a8b8");
      g += cuadro(660, 200, 130, 100, F("M 674,286 L 712,236 L 740,270 L 756,252 L 776,286 Z", "#8fd18a") + `<circle cx="752" cy="226" r="10" fill="#ffd65a"/>`);
      g += cuadro(850, 176, 110, 130, heart(905, 242, 22, "#ff8fa3", 3));
      g += cuadro(1010, 214, 90, 80, star(1055, 254, 20, "#ffd65a", 3));
      // reloj de pared
      g += E(1240, 200, 46, 46, "#fffdf8", 4) + E(1240, 200, 36, 36, "#fff", 2.5) + L("M 1240,200 L 1240,176 M 1240,200 L 1258,208", OL, 4) + E(1240, 200, 4, 4, OL, 0);
      return g + marcoCasa();
    },
    cocina() {
      let g = `<defs><pattern id="pat-azulejo" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#c7ead9"/><rect x="2" y="2" width="44" height="44" rx="6" fill="#d9f2e6"/></pattern>` +
        `<pattern id="pat-cocina" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#e4f6ec"/><circle cx="20" cy="20" r="4" fill="#cdeedd"/><circle cx="60" cy="60" r="4" fill="#cdeedd"/></pattern></defs>`;
      g += Rf(0, 0, 1600, 560, 0, "url(#pat-cocina)") + R(340, 290, 640, 260, 0, "url(#pat-azulejo)", 3);
      // piso de cuadros
      const filas = [560, 604, 654, 712, 780, 856, 940];
      for (let i = 0; i < filas.length - 1; i++) {
        const tam = 80 + i * 14;
        for (let x = -tam, k = 0; x < 1600; x += tam, k++) {
          g += Rf(x + ((i % 2) * tam) / 2, filas[i], tam, filas[i + 1] - filas[i], 0, (k + i) % 2 ? "#fff3e0" : "#f6cfa8");
        }
      }
      g += F("M 0,566 L 1600,566 L 1600,600 L 0,600 Z", "rgba(60,30,20,0.08)") + rodapie();
      g += ventana(1060, 120, 240, 200, ["#9fd6ff", "#d9f1ff"], "#ffd36e");
      g += E(1450, 170, 44, 44, "#fffdf8", 4) + E(1450, 170, 34, 34, "#ffd36e", 2.5) + L("M 1450,170 L 1450,148 M 1450,170 L 1466,180", OL, 4);
      return g + marcoCasa();
    },
    dormitorio() {
      let g = `<defs><pattern id="pat-dormi" width="90" height="90" patternUnits="userSpaceOnUse"><rect width="90" height="90" fill="#e8def8"/>${star(22, 24, 7, "#fff3b0", 1.5)}${star(67, 66, 6, "#fff3b0", 1.5)}<circle cx="70" cy="20" r="3" fill="#d8c8f2"/><circle cx="20" cy="70" r="3" fill="#d8c8f2"/></pattern></defs>`;
      g += Rf(0, 0, 1600, 560, 0, "url(#pat-dormi)") + pisoMadera("#d9a77a", "#bd8a5e") + rodapie();
      g += ventana(600, 96, 270, 220, ["#2d3f7a", "#5a6fb0"], "#c9a6e8", true);
      // banderines
      let b = L("M 40,60 Q 330,110 600,62", "#a07a5a", 3) + L("M 900,62 Q 1180,110 1560,60", "#a07a5a", 3);
      const cols = ["#ff8fa3", "#ffd65a", "#9ed9bd", "#8fc3f0"];
      for (let i = 0; i < 8; i++) { const x = 80 + i * 64, y = 70 + Math.sin((i / 7) * Math.PI) * 24; b += P(`M ${x},${y} L ${x + 36},${y + 2} L ${x + 18},${y + 36} Z`, cols[i % 4], 2.5); }
      for (let i = 0; i < 9; i++) { const x = 940 + i * 66, y = 70 + Math.sin((i / 8) * Math.PI) * 24; b += P(`M ${x},${y} L ${x + 36},${y + 2} L ${x + 18},${y + 36} Z`, cols[(i + 2) % 4], 2.5); }
      g += b;
      g += cuadro(240, 190, 120, 110, `<circle cx="300" cy="245" r="26" fill="#fff3b0" stroke="${OL}" stroke-width="3"/><circle cx="312" cy="236" r="22" fill="#fffdf6"/>`);
      return g + marcoCasa();
    },
  };

  function mueble(def, st) {
    return svg(`0 0 ${def.w} ${def.h}`, arte[def.arte](st, def), "mueble-svg");
  }
  function fondo(cuarto) {
    return svg("0 0 1600 900", fondos[cuarto](), "fondo-svg");
  }

  // ---------- Portada ----------
  function portada() {
    let g = `<defs><linearGradient id="cielo-portada" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8dcff"/><stop offset="1" stop-color="#fde6f0"/></linearGradient></defs>`;
    g += Rf(0, 0, 1600, 900, 0, "url(#cielo-portada)");
    g += `<circle cx="1360" cy="150" r="70" fill="#fff3b0" stroke="${OL}" stroke-width="4"/>`;
    for (const [x, y, s] of [[260, 140, 1], [620, 90, 0.8], [1020, 170, 1.1]]) {
      g += `<g transform="translate(${x},${y}) scale(${s})">${P("M -70,20 C -90,20 -92,-6 -70,-8 C -66,-34 -30,-40 -16,-20 C -4,-44 40,-40 44,-12 C 70,-14 76,20 52,20 Z", "#fffdf8")}</g>`;
    }
    g += P("M 0,720 C 300,640 600,700 800,690 C 1050,680 1300,620 1600,680 L 1600,900 L 0,900 Z", "#a8dc9a");
    g += P("M 0,780 C 400,740 900,790 1600,750 L 1600,900 L 0,900 Z", "#8fd18a");
    // casa
    g += P("M 520,760 L 520,430 L 1080,430 L 1080,760 Z", "#ffd6dd");
    g += P("M 470,450 L 800,210 L 1130,450 C 1134,462 1124,470 1114,466 L 800,240 L 486,466 C 476,470 466,462 470,450 Z", "#f08a7a");
    g += P("M 500,450 L 800,232 L 1100,450 Z", "#f6a08f");
    for (let i = 0; i < 4; i++) g += L(`M ${560 + i * 20},${420 - i * 40} L ${1040 - i * 20},${420 - i * 40}`, shade("#f6a08f", -0.15), 3);
    g += R(740, 300, 120, 100, 50, "#fff3b0") + L("M 800,300 L 800,400 M 740,350 L 860,350", OL, 3);
    // ventanas con interiores de colores (cocina, sala, dormitorio)
    const vent = (x, c) => R(x, 500, 130, 110, 10, c) + L(`M ${x + 65},500 L ${x + 65},610 M ${x},555 L ${x + 130},555`, "#fffdf8", 8) + R(x - 8, 606, 146, 14, 5, "#fffdf8", 3);
    g += vent(560, "#d9f2e6") + vent(910, "#e8def8");
    g += R(740, 560, 120, 200, 14, "#9ed9bd") + E(840, 662, 7, 7, "#ffd65a", 3) + heart(800, 610, 16, "#fff", 3);
    g += R(720, 752, 160, 16, 6, "#e9b98a", 3);
    // flores
    for (const [x, c] of [[540, "#ff8fa3"], [600, "#ffd65a"], [1010, "#c9a6e8"], [1060, "#ff8fa3"]]) {
      g += L(`M ${x},770 L ${x},740`, "#5aa05a", 4) + E(x, 734, 12, 12, c, 3) + E(x, 734, 4, 4, "#fff3b0", 2);
    }
    return svg("0 0 1600 900", g, "portada-svg");
  }

  C.Muebles = { arte, mueble, fondo, portada };
})(window.Casita);
