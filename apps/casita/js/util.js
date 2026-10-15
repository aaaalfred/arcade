/* Utilidades compartidas: colores, primitivas SVG y DOM. Sin dependencias. */
window.Casita = window.Casita || {};
(function (C) {
  "use strict";

  const OL = "#4a2e22"; // contorno café oscuro, como la ilustración de referencia

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  }
  // amt < 0 oscurece, amt > 0 aclara (0..1)
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    if (amt < 0) { const f = 1 + amt; return rgbToHex(r * f, g * f, b * f); }
    return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  }

  const P = (d, fill, sw = 3.5, extra = "") =>
    `<path d="${d}" fill="${fill}" stroke="${OL}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const F = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const L = (d, color = OL, sw = 3, extra = "") =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const E = (cx, cy, rx, ry, fill, sw = 3.5, extra = "") =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${OL}" stroke-width="${sw}" ${extra}/>`;
  const Ef = (cx, cy, rx, ry, fill, extra = "") => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
  const R = (x, y, w, h, rx, fill, sw = 3.5, extra = "") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${OL}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
  const Rf = (x, y, w, h, rx, fill, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;

  function star(cx, cy, r, fill, sw = 3) {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.5 : r;
      d += (i ? " L " : "M ") + (cx + Math.cos(a) * rr).toFixed(1) + "," + (cy + Math.sin(a) * rr).toFixed(1);
    }
    return P(d + " Z", fill, sw);
  }
  function heart(cx, cy, s, fill, sw = 3) {
    const d = `M ${cx},${cy + s * 0.9} C ${cx - s * 1.4},${cy} ${cx - s * 0.9},${cy - s * 1.1} ${cx},${cy - s * 0.35} C ${cx + s * 0.9},${cy - s * 1.1} ${cx + s * 1.4},${cy} ${cx},${cy + s * 0.9} Z`;
    return P(d, fill, sw);
  }

  const mirror = (inner) => `<g transform="scale(-1,1)">${inner}</g>`;
  const svg = (vb, inner, cls = "") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="${cls}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const copia = (o) => JSON.parse(JSON.stringify(o));

  C.U = { OL, clamp, shade, P, F, L, E, Ef, R, Rf, star, heart, mirror, svg, el, copia };
})(window.Casita);
