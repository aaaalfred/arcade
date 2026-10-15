/* Personaje chibi por piezas (vector), inspirado en la ilustración de referencia.
   Coordenadas locales: origen en los pies (0,0), la cabeza hacia y negativa.
   Capas: pelo trasero, cuerpo, ropa, brazos, cabeza, cara, pelo frontal y accesorios.
   Las manos van en un SVG aparte, encima de los objetos sostenidos. */
(function (C) {
  "use strict";
  const { OL, shade, P, F, L, E, Ef, R, star, mirror, svg } = C.U;

  const VB = "-115 -345 230 355";
  const TAM = [230, 355];
  // Punto del div (px) que coincide con el ancla de cada postura
  const ANCLAS = { stand: [115, 345], sit: [115, 253], lie: [115, 195] };
  const MANOS = { L: [-60, -92], R: [60, -92] };
  const BOCA = [0, -193];

  // ---------- Pelo ----------
  function pelo(look) {
    const c = look.hairColor, d = shade(c, -0.32);
    const st = (p) => L(p, d, 3);
    switch (look.hair) {
      case "corto": {
        const lado = P("M -69,-232 C -72,-218 -70,-206 -65,-197 L -61,-216 Z", c, 3);
        return {
          back: P("M -68,-232 C -76,-282 -42,-308 0,-308 C 42,-308 76,-282 68,-232 L 62,-206 L -62,-206 Z", c),
          front:
            P("M -69,-226 C -73,-276 -42,-302 0,-303 C 44,-302 73,-276 69,-226 C 63,-242 55,-250 44,-255 L 36,-245 L 28,-259 L 15,-247 L 4,-262 L -9,-248 L -22,-261 L -33,-247 C -46,-247 -60,-240 -69,-226 Z", c) +
            st("M -40,-282 C -28,-292 -12,-296 4,-295") + st("M 22,-290 C 36,-286 50,-276 58,-262") +
            lado + mirror(lado),
        };
      }
      case "coletas": {
        const cola =
          P("M -60,-262 C -100,-268 -124,-236 -118,-196 C -114,-170 -100,-156 -86,-160 C -96,-176 -98,-196 -92,-214 C -86,-232 -74,-242 -62,-244 Z", c) +
          st("M -104,-232 C -112,-212 -108,-190 -100,-176") +
          E(-66, -253, 8, 8, "#ff8fb1", 3);
        return {
          back: cola + mirror(cola) + P("M -68,-232 C -74,-282 -42,-306 0,-306 C 42,-306 74,-282 68,-232 Z", c),
          front:
            P("M -70,-226 C -74,-274 -44,-302 0,-302 C 44,-302 74,-274 70,-226 C 64,-244 58,-252 48,-254 Q 36,-246 26,-256 Q 14,-246 2,-256 Q -10,-246 -22,-256 Q -34,-246 -46,-254 C -56,-252 -64,-244 -70,-226 Z", c) +
            st("M -36,-286 C -20,-294 4,-296 22,-290"),
        };
      }
      case "chongo": {
        return {
          back:
            E(0, -314, 30, 25, c) + st("M -16,-322 C -6,-330 10,-330 18,-320") +
            P("M -68,-232 C -74,-282 -42,-306 0,-306 C 42,-306 74,-282 68,-232 L 64,-204 L -64,-204 Z", c),
          front:
            P("M -70,-226 C -74,-278 -42,-303 2,-303 C 46,-303 74,-278 70,-226 C 66,-246 52,-262 30,-268 C 8,-272 -14,-264 -30,-256 C -46,-250 -60,-240 -70,-226 Z", c) +
            st("M -40,-280 C -20,-292 10,-294 34,-284") + st("M 44,-268 C 54,-260 62,-248 66,-236") +
            P("M -70,-232 C -80,-212 -76,-196 -80,-182 C -70,-190 -66,-204 -63,-220 Z", c, 3),
        };
      }
      default: { // "ondulado": melena ondulada como la referencia
        const lock = P("M -70,-232 C -84,-206 -78,-184 -86,-160 C -72,-170 -64,-192 -62,-218 Z", c, 3);
        const hebras = st("M -92,-212 C -102,-192 -94,-176 -100,-160") + st("M -84,-150 C -96,-134 -88,-118 -94,-112");
        return {
          back:
            P("M -66,-284 C -102,-272 -112,-232 -100,-202 C -116,-186 -112,-160 -100,-150 C -116,-134 -106,-110 -88,-108 C -82,-96 -62,-96 -56,-108 L -48,-168 L 48,-168 L 56,-108 C 62,-96 82,-96 88,-108 C 106,-110 116,-134 100,-150 C 112,-160 116,-186 100,-202 C 112,-232 102,-272 66,-284 C 40,-308 -40,-308 -66,-284 Z", c) +
            hebras + mirror(hebras),
          front:
            P("M -70,-224 C -76,-270 -50,-302 0,-303 C 50,-302 76,-270 70,-224 C 66,-242 58,-256 46,-262 C 36,-252 20,-250 8,-266 C -4,-250 -26,-248 -42,-262 C -52,-252 -64,-242 -70,-224 Z", c) +
            st("M -30,-288 C -18,-296 2,-298 18,-292") + st("M 30,-282 C 44,-276 56,-266 62,-250") +
            lock + mirror(lock),
        };
      }
    }
  }

  // ---------- Ojos, cejas y boca ----------
  function ojo(s, expr, look) {
    const X = 27 * s, inner = -s; // hacia el centro de la cara
    const lid = shade(look.skin, -0.02);
    if (expr === "dormido") {
      return `<g class="pj-ojo">${L(`M ${X - 13},-221 Q ${X},-210 ${X + 13},-221`, OL, 4)}${L(`M ${X + 12 * s},-219 l ${6 * s},3`, OL, 3)}</g>`;
    }
    const big = expr === "sorpresa" ? 1.14 : 1;
    const pupila = expr === "sorpresa" ? 4.2 : 6;
    let g =
      Ef(X, -221, 12.5, 15, "#3a2216") +
      Ef(X, -218.5, 9.5, 11.5, look.eyes || "#7a4a2a") +
      Ef(X, -217.5, pupila, pupila * 1.2, "#2a160c") +
      `<circle cx="${X - 4}" cy="-227" r="4.6" fill="#fff"/><circle cx="${X + 4.5}" cy="-213" r="2.2" fill="#fff"/>` +
      L(`M ${X - 14},-224 Q ${X},-240 ${X + 14},-224`, OL, 4) +
      L(`M ${X + 13 * s},-228 l ${6 * s},-5 M ${X + 14 * s},-222 l ${7 * s},-1`, OL, 3);
    if (expr === "triste") g += `<circle cx="${X + 3}" cy="-224" r="2.4" fill="#fff"/>`;
    if (expr === "enojo") {
      const o = X - 16 * inner, i = X + 16 * inner;
      g += F(`M ${o},-242 L ${i},-242 L ${i},-222 L ${o},-233 Z`, lid) + L(`M ${o},-233 L ${i},-222`, OL, 4);
    }
    const t = big !== 1 ? ` transform="translate(${X},-221) scale(${big}) translate(${-X},221)"` : "";
    return `<g class="pj-ojo"${t}>${g}</g>`;
  }

  function ceja(s, expr, color) {
    const X = 27 * s, inner = -s;
    const o = X - 11 * inner, i = X + 11 * inner;
    let d;
    if (expr === "triste") d = `M ${o},-243 Q ${X},-246 ${i},-253`;
    else if (expr === "enojo") d = `M ${o},-253 Q ${X},-249 ${i},-241`;
    else if (expr === "sorpresa") d = `M ${o},-252 Q ${X},-260 ${i},-252`;
    else d = `M ${o},-245 Q ${X},-251 ${i},-246`;
    return L(d, color, 4.5);
  }

  function boca(expr) {
    let normal;
    switch (expr) {
      case "triste": normal = L("M -9,-188 Q 0,-196 9,-188", OL, 3.5); break;
      case "sorpresa": normal = E(0, -191, 6, 8, "#9b3d36", 3); break;
      case "enojo": normal = L("M -9,-189 Q 0,-195 9,-189", OL, 3.5); break;
      case "dormido": normal = L("M -6,-193 Q 0,-189 6,-193", OL, 3); break;
      default: normal = P("M -11,-197 Q 0,-183 11,-197 Q 0,-192 -11,-197 Z", "#b9524a", 3);
    }
    const mastica =
      `<g class="boca-mastica"><g class="m1">${E(0, -192, 8, 7, "#9b3d36", 3)}</g>` +
      `<g class="m2">${L("M -9,-192 Q 0,-188 9,-192", OL, 3.5)}</g></g>`;
    return `<g class="boca-normal">${normal}</g>${mastica}`;
  }

  function cara(look, expr) {
    const cejaColor = shade(look.hairColor, -0.35);
    const rubor = expr === "enojo" ? "#f07070" : "#f59a9a";
    let g =
      Ef(-44, -203, 11, 6.5, rubor, 'opacity="0.6"') + Ef(44, -203, 11, 6.5, rubor, 'opacity="0.6"') +
      ojo(-1, expr, look) + ojo(1, expr, look) +
      Ef(0, -206, 4, 3, shade(look.skin, -0.18)) +
      boca(expr) +
      ceja(-1, expr, cejaColor) + ceja(1, expr, cejaColor);
    if (expr === "triste") g += P("M -36,-206 C -41,-197 -40,-192 -36,-191 C -32,-192 -31,-197 -36,-206 Z", "#9fd8ff", 2.5);
    return g;
  }

  // ---------- Accesorios ----------
  function accesorios(look) {
    let g = "";
    const hc = look.headColor || "#9ed9bd";
    if (look.head === "gorra") {
      g +=
        P("M -74,-256 C -78,-318 -32,-338 4,-338 C 50,-336 78,-306 74,-262 C 40,-276 -40,-276 -74,-256 Z", hc) +
        L("M 4,-336 C -6,-310 -10,-290 -12,-270", shade(hc, -0.25), 3) +
        L("M 4,-336 C 22,-312 30,-292 34,-272", shade(hc, -0.25), 3) +
        P("M 8,-272 C 50,-292 100,-286 118,-260 C 112,-248 92,-246 66,-250 C 44,-254 24,-258 8,-262 Z", shade(hc, -0.1)) +
        E(4, -338, 7, 5, shade(hc, -0.05), 3);
    } else if (look.head === "mono") {
      g +=
        P("M 36,-288 C 20,-306 6,-300 8,-286 C 10,-274 24,-278 36,-288 Z", hc) +
        P("M 36,-288 C 52,-306 66,-300 64,-286 C 62,-274 48,-278 36,-288 Z", hc) +
        E(36, -288, 7, 7, shade(hc, -0.15), 3);
    } else if (look.head === "diadema") {
      g += L("M -66,-252 C -56,-302 56,-302 66,-252", OL, 13) + L("M -66,-252 C -56,-302 56,-302 66,-252", hc, 7.5);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g += E(-38 + Math.cos(a) * 7, -284 + Math.sin(a) * 7, 6, 6, "#fff", 2.5);
      }
      g += E(-38, -284, 4, 4, "#ffd65a", 2);
    }
    if (look.broches) g += star(-66, -212, 11, "#ffd65a", 3) + star(60, -248, 11, "#ffd65a", 3);
    if (look.lentes) {
      g +=
        `<g fill="#ffffff" fill-opacity="0.15" stroke="#3a2a40" stroke-width="3.5">` +
        `<circle cx="-27" cy="-221" r="18"/><circle cx="27" cy="-221" r="18"/></g>` +
        L("M -9,-224 Q 0,-230 9,-224", "#3a2a40", 3.5) + L("M -45,-224 L -64,-228 M 45,-224 L 64,-228", "#3a2a40", 3.5);
    }
    return g;
  }

  // ---------- Ropa ----------
  function piernas(look, pose) {
    const sk = look.skin, sh = look.shoes;
    let pier = "";
    if (look.bottom !== "pantalon") {
      const pierna = pose === "sit"
        ? P("M -35,-66 L -34,-36 L -12,-36 L -10,-66 Z", sk) + E(-23, -62, 14, 8, sk, 3)
        : P("M -33,-68 L -32,-36 L -11,-36 L -10,-68 Z", sk);
      const media = R(-33.5, -42, 22.5, 20, 3, "#fbfaf5", 3) + L("M -29,-40 L -29,-26 M -23,-40 L -23,-26 M -17,-40 L -17,-26", "#ddd6c8", 2);
      pier = pierna + media + mirror(pierna + media);
    }
    const zap =
      P("M -41,-8 C -43,-20 -38,-27 -30,-28 L -14,-28 C -7,-28 -4,-22 -4,-14 L -4,-8 Z", sh) +
      P("M -43,-9 L -3,-9 C -3,-3 -6,0 -12,0 L -36,0 C -41,0 -43,-4 -43,-9 Z", "#fffaf2", 3) +
      L("M -27,-25 L -17,-20 M -27,-20 L -17,-25", "#fff4e0", 2.5);
    const zapato = pose === "sit" ? `<g transform="rotate(-8 -22 -12)">${zap}</g>` : zap;
    return pier + zapato + mirror(zapato);
  }

  function parteAbajo(look) {
    const c = look.bottomColor, cl = shade(c, 0.22), cd = shade(c, -0.25);
    switch (look.bottom) {
      case "falda":
        return P("M -44,-106 L -60,-58 C -30,-50 30,-50 60,-58 L 44,-106 Z", c) +
          L("M -20,-104 L -27,-55 M 20,-104 L 27,-55 M 0,-104 L 0,-52", cd, 2.5);
      case "pantalon": {
        const puno = P("M -42,-38 L -9,-38 L -9,-28 L -42,-28 Z", cl, 3);
        return P("M -45,-106 L -42,-28 L -9,-28 L -4,-84 L 4,-84 L 9,-28 L 42,-28 L 45,-106 Z", c) + puno + mirror(puno) +
          L("M 0,-104 L 0,-86", cd, 2.5);
      }
      default: { // short y overol comparten el short
        const puno = P("M -48,-72 C -36,-67 -20,-67 -7,-70 L -7,-64 C -20,-61 -38,-61 -48,-66 Z", cl, 3);
        return P("M -45,-106 L -48,-66 C -38,-61 -20,-61 -7,-64 L 0,-86 L 7,-64 C 20,-61 38,-61 48,-66 L 45,-106 Z", c) +
          puno + mirror(puno) + L("M 0,-104 L 0,-87", cd, 2.5) +
          L("M -40,-96 C -34,-92 -26,-92 -22,-96", cd, 2) + L("M 40,-96 C 34,-92 26,-92 22,-96", cd, 2);
      }
    }
  }

  function babero(look) {
    if (look.bottom !== "overol") return "";
    const c = look.bottomColor, cd = shade(c, -0.25), cl = shade(c, 0.3);
    const tirante = P("M -28,-150 L -38,-172 L -29,-175 L -19,-152 Z", c, 3) + E(-24, -149, 4.5, 4.5, "#e7b14c", 2.5);
    return (
      tirante + mirror(tirante) +
      P("M -28,-152 C -28,-155 -26,-156 -24,-156 L 24,-156 C 26,-156 28,-155 28,-152 L 31,-104 L -31,-104 Z", c) +
      L("M -24,-150 L -26,-108 M 24,-150 L 26,-108", cl, 1.8, 'stroke-dasharray="3 3"') +
      P("M -12,-142 L 12,-142 L 11,-124 Q 0,-120 -11,-124 Z", shade(c, 0.08), 2.5) +
      // flor bordada del bolsillo
      L("M 0,-129 L 0,-124", "#5aa05a", 2) +
      `<g fill="#fff" stroke="${OL}" stroke-width="1"><circle cx="0" cy="-136" r="2.6"/><circle cx="-3.2" cy="-133" r="2.6"/><circle cx="3.2" cy="-133" r="2.6"/><circle cx="-2" cy="-129.6" r="2.6"/><circle cx="2" cy="-129.6" r="2.6"/></g>` +
      `<circle cx="0" cy="-133" r="2" fill="#ffd65a"/>` +
      L("M -44,-104 L 44,-104", cd, 3)
    );
  }

  function torso(look) {
    const c = look.topColor, cd = shade(c, -0.18), sk = look.skin;
    const brazo = P("M -66,-138 C -70,-122 -70,-106 -67,-96 L -53,-96 C -53,-108 -53,-122 -50,-136 Z", sk, 3);
    let manga, cuerpo, extra = "";
    if (look.top === "sudadera") {
      manga = P("M -36,-169 C -54,-167 -68,-152 -71,-128 C -72,-114 -70,-104 -68,-98 L -52,-98 C -52,-112 -51,-128 -47,-150 Z", c) +
        P("M -69,-106 L -51,-106 L -52,-97 L -68,-97 Z", cd, 3);
      cuerpo = P("M -36,-170 C -46,-166 -49,-156 -48,-146 L -46,-92 C -20,-87 20,-87 46,-92 L 48,-146 C 49,-156 46,-166 36,-170 C 22,-163 -22,-163 -36,-170 Z", c);
      extra = P("M -24,-122 L 24,-122 L 30,-98 L -30,-98 Z", cd, 2.5) +
        L("M -8,-164 L -9,-142 M 8,-164 L 9,-142", "#fff", 2.5) +
        `<circle cx="-9" cy="-141" r="2.5" fill="#fff"/><circle cx="9" cy="-141" r="2.5" fill="#fff"/>`;
      return { brazos: manga + mirror(manga), cuerpo: cuerpo + extra, brazoPiel: "" };
    }
    if (look.top === "blusa") {
      manga = P("M -36,-169 C -62,-172 -73,-150 -66,-133 C -60,-127 -52,-129 -48,-134 C -48,-148 -46,-158 -42,-164 Z", c) +
        L("M -66,-136 C -60,-132 -54,-132 -48,-136", cd, 2.5);
      cuerpo = P("M -36,-170 C -46,-166 -49,-156 -48,-146 L -45,-100 C -20,-95 20,-95 45,-100 L 48,-146 C 49,-156 46,-166 36,-170 C 22,-163 -22,-163 -36,-170 Z", c);
      const cuello = P("M -2,-166 C -8,-150 -26,-150 -30,-165 C -20,-171 -8,-171 -2,-166 Z", "#fffdf8", 2.5);
      extra = cuello + mirror(cuello) + `<circle cx="0" cy="-140" r="2.5" fill="${cd}"/><circle cx="0" cy="-126" r="2.5" fill="${cd}"/>`;
    } else {
      manga = P("M -36,-169 C -52,-167 -64,-156 -69,-134 C -62,-129 -56,-128 -50,-130 C -49,-142 -48,-152 -45,-160 Z", c);
      cuerpo = P("M -36,-170 C -46,-166 -49,-156 -48,-146 L -45,-100 C -20,-95 20,-95 45,-100 L 48,-146 C 49,-156 46,-166 36,-170 C 22,-163 -22,-163 -36,-170 Z", c);
      extra = L("M -14,-168 Q 0,-158 14,-168", cd, 2.5);
    }
    return { brazos: brazo + mirror(brazo) + manga + mirror(manga), cuerpo: cuerpo + extra, brazoPiel: "" };
  }

  // ---------- Ensamblado ----------
  function cuerpoSVG(look, opts = {}) {
    const pose = opts.pose || "stand";
    const expr = pose === "lie" ? "dormido" : opts.expr || "feliz";
    const sk = look.skin, sd = shade(sk, -0.12);
    const h = pelo(look);
    const t = torso(look);
    const capucha = look.top === "sudadera" ? P("M -42,-174 C -54,-202 -30,-216 0,-216 C 30,-216 54,-202 42,-174 Z", shade(look.topColor, -0.12)) : "";
    const sombra = pose === "stand" && !opts.sinSombra ? Ef(0, -3, 50, 9, "rgba(60,30,20,0.16)", 'class="sombra"') : "";
    const oreja = E(-64, -220, 12, 13, sk, 3) + L("M -66,-226 C -70,-220 -68,-214 -63,-213", sd, 2.5);
    const g =
      `<ellipse cx="0" cy="-170" rx="85" ry="170" fill="transparent" class="hit"/>` +
      sombra +
      h.back + capucha +
      R(-12, -180, 24, 18, 4, sk, 3) + // cuello
      // Sentado: de la cintura para abajo se acorta (muslos hacia el frente) y los pies quedan colgando
      (pose === "sit"
        ? `<g transform="translate(0,-104) scale(1,0.6) translate(0,104)">${piernas(look, pose) + parteAbajo(look)}</g>`
        : piernas(look, pose) + parteAbajo(look)) +
      t.cuerpo + t.brazos + babero(look) +
      oreja + mirror(oreja) +
      E(0, -228, 66, 62, sk) +
      F("M -60,-206 C -50,-176 50,-176 60,-206 C 50,-184 -50,-184 -60,-206 Z", sd, 'opacity="0.35"') +
      cara(look, expr) +
      h.front +
      accesorios(look) +
      (expr === "enojo" ? L("M 44,-282 Q 48,-278 44,-274 M 56,-282 Q 52,-278 56,-274 M 46,-286 Q 50,-282 54,-286 M 46,-270 Q 50,-274 54,-270", "#e5484d", 3) : "");
    return svg(VB, `<g class="pj-g">${g}</g>`, "pj-svg");
  }

  function manosSVG(look) {
    const sk = look.skin;
    const mano = E(-60, -92, 10.5, 10.5, sk, 3) + L("M -54,-99 C -49,-99 -47,-94 -50,-91", OL, 2.5);
    return svg(VB, mano + mirror(mano), "pj-svg-manos");
  }

  // Busto pequeño para botones (editor, bandeja)
  function retrato(look) {
    const s = cuerpoSVG(look, { pose: "stand", expr: "feliz", sinSombra: true });
    return s.replace(`viewBox="${VB}"`, 'viewBox="-90 -345 180 200"');
  }

  C.Personaje = { VB, TAM, ANCLAS, MANOS, BOCA, cuerpoSVG, manosSVG, retrato };
})(window.Casita);
