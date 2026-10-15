/* Objetos manipulables: comida, juguetes, libros y utensilios.
   Cada objeto se dibuja con el ancla en la base (0,0) y crece hacia y negativa. */
(function (C) {
  "use strict";
  const { OL, shade, P, F, L, E, Ef, R, Rf, star, heart, mirror, svg } = C.U;

  const libro = (color, emblema) => () =>
    R(-18, -60, 36, 58, 4, color) +
    Rf(-18, -60, 8, 58, 3, shade(color, -0.2)) + L("M -10,-58 L -10,-4", OL, 2.5) +
    P("M 18,-56 L 22,-54 L 22,-6 L 18,-4 Z", "#fff7e6", 2.5) +
    emblema + L("M -4,-14 L 12,-14", shade(color, 0.5), 2.5);

  const lista = {
    // ---------- Comida ----------
    manzana: {
      nombre: "Manzana", cat: "comida", w: 46, h: 50, comida: true,
      bocados: [[17, -36], [21, -18], [-19, -32]],
      arte: () =>
        P("M 0,-37 C -8,-43 -23,-43 -23,-24 C -23,-6 -10,0 0,-4 C 10,0 23,-6 23,-24 C 23,-43 8,-43 0,-37 Z", "#f26b6b") +
        Ef(-11, -28, 5, 8, "#fff", 'opacity="0.55"') +
        L("M 0,-37 C 0,-43 2,-47 5,-49", OL, 3) +
        P("M 4,-42 C 10,-51 19,-49 19,-44 C 13,-40 7,-40 4,-42 Z", "#7cc47a", 2.5),
    },
    platano: {
      nombre: "Plátano", cat: "comida", w: 66, h: 38, comida: true,
      bocados: [[28, -28], [20, -14], [-26, -26]],
      arte: () =>
        P("M -30,-26 C -20,2 20,2 31,-28 L 26,-32 C 16,-14 -14,-12 -24,-28 Z", "#ffd95a") +
        L("M -22,-22 C -10,-8 12,-8 24,-24", shade("#ffd95a", -0.2), 2) +
        P("M 26,-32 L 31,-28 L 33,-34 Z", "#8a6a3a", 2.5) + Ef(-28, -27, 3, 3, "#8a6a3a"),
    },
    galleta: {
      nombre: "Galleta", cat: "comida", w: 46, h: 46, comida: true,
      bocados: [[18, -36], [20, -12], [-18, -38]],
      arte: () =>
        E(0, -23, 21, 21, "#e8b06a") + `<circle cx="0" cy="-23" r="16" fill="none" stroke="${shade("#e8b06a", -0.15)}" stroke-width="2"/>` +
        Ef(-7, -30, 3.5, 3, "#6b3f24") + Ef(6, -26, 3.5, 3, "#6b3f24") + Ef(-4, -16, 3.5, 3, "#6b3f24") + Ef(8, -14, 3, 2.6, "#6b3f24"),
    },
    pastel: {
      nombre: "Pastel", cat: "comida", w: 60, h: 54, comida: true,
      bocados: [[-24, -36], [-26, -20], [24, -30]],
      arte: () =>
        P("M -26,-6 L 25,-6 L 25,-30 L -26,-40 Z", "#f9e2b0") +
        F("M -26,-22 L 25,-17 L 25,-13 L -26,-18 Z", "#f7a8c4") +
        P("M -28,-40 L 27,-30 C 27,-24 23,-24 22,-28 C 18,-22 14,-24 14,-29 C 10,-24 4,-26 5,-31 C 0,-26 -8,-30 -6,-34 C -12,-30 -20,-32 -18,-37 C -24,-34 -29,-36 -28,-40 Z", "#ffb3cc", 3) +
        E(-6, -44, 6, 6, "#e94b5b", 2.5) + L("M -6,-50 C -4,-56 0,-58 3,-58", OL, 2.5),
    },
    sandia: {
      nombre: "Sandía", cat: "comida", w: 66, h: 46, comida: true,
      bocados: [[0, -42], [-14, -30], [14, -30]],
      arte: () =>
        P("M -31,-12 C -14,2 14,2 31,-12 L 0,-44 Z", "#ff7a85") +
        P("M -31,-12 C -14,2 14,2 31,-12 L 33,-8 C 14,8 -14,8 -33,-8 Z", "#6cc47a", 3) +
        L("M -29,-12 C -14,0 14,0 29,-12", "#e9ffe5", 2) +
        Ef(-8, -22, 2.2, 3.4, "#3a2216") + Ef(6, -18, 2.2, 3.4, "#3a2216") + Ef(0, -30, 2.2, 3.4, "#3a2216") + Ef(14, -14, 2.2, 3.4, "#3a2216"),
    },
    sandwich: {
      nombre: "Sándwich", cat: "comida", w: 62, h: 50, comida: true,
      bocados: [[0, -46], [-12, -34], [12, -34]],
      arte: () =>
        P("M -29,-6 L 29,-6 L 0,-48 Z", "#f5d79c") +
        P("M -22,-12 L 22,-12 L 0,-40 Z", "#fff1d6", 2.5) +
        P("M -31,-8 C -24,-14 -16,-4 -8,-10 C 0,-14 8,-4 16,-10 C 22,-14 28,-6 31,-8 L 30,-3 L -30,-3 Z", "#8fd17a", 2.5) +
        Rf(-26, -3, 52, 3, 1, "#ef6b6b"),
    },
    leche: {
      nombre: "Leche", cat: "comida", w: 42, h: 68, comida: true, bebida: true,
      arte: () =>
        R(-18, -48, 36, 46, 3, "#fdfbf6") +
        P("M -18,-48 L -10,-62 L 10,-62 L 18,-48 Z", "#8fc3f0", 3) +
        R(4, -68, 8, 7, 2, "#ff9fb3", 2.5) +
        Rf(-15, -34, 30, 16, 3, "#cfe6fb") +
        P("M 0,-32 C -5,-26 -6,-23 0,-20 C 6,-23 5,-26 0,-32 Z", "#8fc3f0", 2),
    },
    jugo: {
      nombre: "Jugo", cat: "comida", w: 40, h: 62, comida: true, bebida: true,
      arte: () =>
        L("M 8,-46 L 12,-60 L 18,-60", "#ff8fb1", 4) +
        R(-17, -48, 34, 46, 4, "#ffb35c") +
        E(0, -26, 10, 10, "#ffe08a", 3) + L("M 0,-36 L 2,-40", "#5aa05a", 3) +
        L("M -17,-42 L 17,-42", shade("#ffb35c", -0.2), 2),
    },
    // ---------- Juguetes ----------
    osito: {
      nombre: "Osito", cat: "juguete", w: 66, h: 76,
      arte: () => {
        const c = "#c98a5a", cl = "#f2cfa6";
        return E(-18, -64, 9, 9, c) + E(18, -64, 9, 9, c) + Ef(-18, -64, 4, 4, cl) + Ef(18, -64, 4, 4, cl) +
          E(-22, -8, 11, 9, c) + E(22, -8, 11, 9, c) +
          E(0, -24, 22, 20, c) + Ef(0, -22, 12, 11, cl) +
          E(-24, -30, 8, 11, c, 3, 'transform="rotate(25 -24 -30)"') + E(24, -30, 8, 11, c, 3, 'transform="rotate(-25 24 -30)"') +
          E(0, -52, 22, 19, c) + E(0, -46, 10, 7, cl, 2.5) + Ef(0, -49, 3.5, 2.5, OL) +
          Ef(-8, -55, 2.6, 3.2, OL) + Ef(8, -55, 2.6, 3.2, OL) +
          P("M 0,-36 L -10,-41 L -10,-31 Z M 0,-36 L 10,-41 L 10,-31 Z", "#ff8fb1", 2.5);
      },
    },
    pelota: {
      nombre: "Pelota", cat: "juguete", w: 58, h: 58,
      arte: () =>
        `<defs><clipPath id="cp-pelota"><circle cx="0" cy="-29" r="26"/></clipPath></defs>` +
        E(0, -29, 26, 26, "#fffaf0") +
        `<g clip-path="url(#cp-pelota)">` +
        F("M -30,-55 L 0,-29 L -30,-29 Z", "#ff8fa3") + F("M 30,-55 L 0,-29 L 30,-29 Z", "#8fc3f0") +
        F("M -30,-3 L 0,-29 L -30,-29 Z", "#ffd65a") + F("M 30,-3 L 0,-29 L 30,-29 Z", "#9ed9bd") + `</g>` +
        E(0, -29, 26, 26, "none") + E(0, -29, 5, 5, "#fff", 2.5) + Ef(-12, -40, 5, 3, "#fff", 'opacity="0.7"'),
    },
    cochecito: {
      nombre: "Cochecito", cat: "juguete", w: 74, h: 48,
      arte: () =>
        P("M -32,-12 L -32,-24 C -32,-28 -28,-30 -24,-30 L -16,-30 L -8,-44 L 14,-44 L 22,-30 L 28,-30 C 32,-30 34,-26 34,-22 L 34,-12 Z", "#f26b6b") +
        P("M -5,-40 L 2,-40 L 2,-30 L -12,-30 Z", "#cfeaff", 2.5) + P("M 6,-40 L 12,-40 L 18,-30 L 6,-30 Z", "#cfeaff", 2.5) +
        Ef(30, -24, 3, 3, "#ffe08a") +
        E(-18, -11, 9, 9, "#4a3a44") + E(20, -11, 9, 9, "#4a3a44") + Ef(-18, -11, 3.5, 3.5, "#ddd") + Ef(20, -11, 3.5, 3.5, "#ddd"),
    },
    cubos: {
      nombre: "Cubos", cat: "juguete", w: 60, h: 62,
      arte: () =>
        R(-28, -30, 30, 28, 4, "#8fc3f0") + `<text x="-13" y="-8" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="900" font-size="20" fill="#fff" stroke="${OL}" stroke-width="1.5">A</text>` +
        R(4, -30, 26, 28, 4, "#9ed9bd") + `<text x="17" y="-8" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="900" font-size="18" fill="#fff" stroke="${OL}" stroke-width="1.5">C</text>` +
        R(-14, -60, 30, 30, 4, "#ff9fb3") + `<text x="1" y="-38" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="900" font-size="20" fill="#fff" stroke="${OL}" stroke-width="1.5">B</text>`,
    },
    patito: {
      nombre: "Patito", cat: "juguete", w: 56, h: 52,
      arte: () =>
        P("M -26,-22 C -28,-6 -12,-2 6,-2 C 22,-2 28,-10 26,-22 C 20,-18 12,-20 8,-24 L -18,-24 C -22,-24 -24,-24 -26,-22 Z", "#ffd84a") +
        E(-6, -36, 15, 15, "#ffd84a") +
        P("M -20,-36 C -28,-38 -32,-34 -28,-30 C -24,-30 -20,-31 -18,-32 Z", "#ff9a3c", 2.5) +
        Ef(-9, -40, 2.8, 3.4, OL) + Ef(-10, -41, 1, 1, "#fff") +
        P("M 4,-18 C 10,-22 18,-20 18,-14 C 12,-12 6,-14 4,-18 Z", shade("#ffd84a", -0.12), 2.5),
    },
    // ---------- Libros ----------
    libro_rojo: { nombre: "Libro de cuentos", cat: "libro", w: 46, h: 62, arte: libro("#f07a7a", heart(0, -36, 7, "#ffe1e6", 2.5)) },
    libro_azul: { nombre: "Libro de estrellas", cat: "libro", w: 46, h: 62, arte: libro("#7fb0e6", star(0, -36, 9, "#fff3b0", 2.5)) },
    libro_verde: { nombre: "Libro de plantas", cat: "libro", w: 46, h: 62, arte: libro("#7cc4a4", P("M 0,-26 C -10,-34 -8,-46 0,-48 C 8,-46 10,-34 0,-26 Z", "#e9ffe5", 2.5)) },
    // ---------- Utensilios ----------
    taza: {
      nombre: "Taza", cat: "utensilio", w: 50, h: 44,
      arte: () =>
        L("M 13,-32 C 26,-32 26,-14 12,-14", OL, 9) + L("M 13,-32 C 26,-32 26,-14 12,-14", "#9ed9bd", 4) +
        P("M -18,-38 L 15,-38 L 13,-6 Q 13,-2 9,-2 L -14,-2 Q -18,-2 -18,-6 Z", "#9ed9bd") +
        heart(-2, -22, 6, "#ff8fa3", 2),
    },
    sarten: {
      nombre: "Sartén", cat: "utensilio", w: 94, h: 34,
      arte: () =>
        P("M 6,-20 L 44,-27 L 46,-20 L 8,-13 Z", "#c98a5a", 3) +
        P("M -42,-24 L 8,-24 L 4,-6 Q 2,-2 -4,-2 L -34,-2 Q -40,-2 -42,-6 Z", "#6c7a8f") +
        L("M -40,-20 L 6,-20", "#9aa7ba", 2),
    },
    cuchara: {
      nombre: "Cuchara de madera", cat: "utensilio", w: 28, h: 84,
      arte: () =>
        P("M -3,-56 L 3,-56 L 4,-4 Q 4,-1 0,-1 Q -4,-1 -4,-4 Z", "#e2a86c", 3) +
        E(0, -68, 11, 15, "#e2a86c") + Ef(0, -68, 6, 9, shade("#e2a86c", -0.12)),
    },
    plato: {
      nombre: "Plato", cat: "utensilio", w: 74, h: 28,
      arte: () =>
        P("M -22,-6 L 22,-6 L 18,-1 L -18,-1 Z", "#e9eef7", 3) +
        E(0, -15, 35, 10, "#fdfdff") + Ef(0, -15, 22, 5.5, "#e6eef9") +
        L("M -30,-13 C -16,-6 16,-6 30,-13", "#8fc3f0", 2),
    },
    tetera: {
      nombre: "Tetera", cat: "utensilio", w: 76, h: 62,
      arte: () =>
        P("M -22,-26 C -32,-30 -38,-38 -36,-46 L -30,-46 C -30,-38 -26,-34 -20,-32 Z", "#f7a8c4", 3) +
        L("M 20,-40 C 36,-42 38,-18 20,-14", OL, 9) + L("M 20,-40 C 36,-42 38,-18 20,-14", "#f7a8c4", 4) +
        P("M -24,-28 C -24,-46 24,-46 24,-28 C 24,-10 18,-2 0,-2 C -18,-2 -24,-10 -24,-28 Z", "#f7a8c4") +
        P("M -14,-42 C -10,-48 10,-48 14,-42 Z", "#ffd0e0", 3) + E(0, -50, 5, 4, "#ffd0e0", 2.5) +
        L("M -18,-24 C -6,-20 6,-20 18,-24", "#fff", 2.5) + `<circle cx="0" cy="-30" r="3" fill="#fff"/>`,
    },
  };

  // Construye el SVG del objeto, con mordidas si es comida.
  function objetoSVG(id, bocados = 0, sufijo = "") {
    const def = lista[id];
    const w = def.w, h = def.h, pad = 5;
    const vb = `${-w / 2 - pad} ${-h - pad} ${w + pad * 2} ${h + pad * 2}`;
    let arte = def.arte();
    if (def.comida && !def.bebida && bocados > 0) {
      const mid = `m-${id}${sufijo}`;
      const huecos = def.bocados.slice(0, bocados).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#000"/>`).join("");
      arte = `<defs><mask id="${mid}" maskUnits="userSpaceOnUse" x="${-w}" y="${-h * 2}" width="${w * 2}" height="${h * 3}"><rect x="${-w}" y="${-h * 2}" width="${w * 2}" height="${h * 3}" fill="#fff"/>${huecos}</mask></defs><g mask="url(#${mid})">${arte}</g>`;
    }
    // id único de clipPath para la pelota
    if (id === "pelota") arte = arte.replace(/cp-pelota/g, "cp-pelota" + sufijo);
    const sombra = Ef(0, -1, w * 0.36, 4, "rgba(60,30,20,0.15)", 'class="sombra"');
    const hit = `<rect class="hit" x="${-w / 2 - 6}" y="${-h - 6}" width="${w + 12}" height="${h + 10}" fill="transparent"/>`;
    return svg(vb, hit + sombra + arte, "obj-svg");
  }

  C.Objetos = { lista, objetoSVG, PAD: 5 };
})(window.Casita);
