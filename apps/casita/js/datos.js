/* Datos del juego: habitaciones, muebles, zonas donde se puede soltar, ropa y estado inicial.
   Para agregar contenido basta con añadir entradas aquí (y su dibujo en arte/). */
(function (C) {
  "use strict";

  const CUARTOS = ["cocina", "sala", "dormitorio"];
  const NOMBRES = { cocina: "Cocina", sala: "Sala", dormitorio: "Dormitorio" };

  // Banda del piso donde se pueden parar personajes y dejar objetos (coordenadas del escenario 1600×900)
  const PISO = { x1: 70, x2: 1530, y1: 612, y2: 885 };

  /* Muebles. base = línea del suelo del mueble (decide el orden de capas).
     interactivo: "lampara" (se enciende), "puerta" (se abre y cierra). */
  const MUEBLES = [
    // Sala
    { id: "alfombra_sala", cuarto: "sala", arte: "alfombra", x: 430, y: 690, w: 760, h: 160, base: 0, color: "#f7b6c8" },
    { id: "librero", cuarto: "sala", arte: "librero", x: 70, y: 250, w: 190, h: 376, base: 625 },
    { id: "planta", cuarto: "sala", arte: "planta", x: 280, y: 470, w: 110, h: 172, base: 640 },
    { id: "sofa", cuarto: "sala", arte: "sofa", x: 600, y: 450, w: 440, h: 200, base: 650 },
    { id: "sillon", cuarto: "sala", arte: "sillon", x: 1120, y: 470, w: 210, h: 190, base: 660 },
    { id: "mesa_centro", cuarto: "sala", arte: "mesa_centro", x: 700, y: 660, w: 240, h: 95, base: 755 },
    { id: "lampara_sala", cuarto: "sala", arte: "lampara_pie", x: 1390, y: 270, w: 140, h: 385, base: 655, interactivo: "lampara", nombre: "lámpara" },
    // Cocina
    { id: "refri", cuarto: "cocina", arte: "refri", x: 60, y: 160, w: 310, h: 482, base: 640, interactivo: "puerta", nombre: "refrigerador" },
    { id: "barra", cuarto: "cocina", arte: "barra", x: 380, y: 380, w: 560, h: 262, base: 640 },
    { id: "repisa", cuarto: "cocina", arte: "repisa", x: 440, y: 230, w: 380, h: 60, base: 300 },
    { id: "mesa", cuarto: "cocina", arte: "mesa", x: 1080, y: 590, w: 300, h: 140, base: 730 },
    { id: "silla_1", cuarto: "cocina", arte: "silla", x: 960, y: 520, w: 120, h: 196, base: 715 },
    { id: "silla_2", cuarto: "cocina", arte: "silla", x: 1380, y: 520, w: 120, h: 196, base: 715 },
    // Dormitorio
    { id: "alfombra_dormi", cuarto: "dormitorio", arte: "alfombra", x: 560, y: 730, w: 600, h: 140, base: 0, color: "#a9cdf2" },
    { id: "juguetero", cuarto: "dormitorio", arte: "juguetero", x: 60, y: 420, w: 250, h: 226, base: 645 },
    { id: "mesita", cuarto: "dormitorio", arte: "mesita", x: 350, y: 560, w: 120, h: 112, base: 670 },
    { id: "lampara_mesa", cuarto: "dormitorio", arte: "lampara_mesa", x: 405, y: 450, w: 70, h: 122, base: 671, interactivo: "lampara", nombre: "lámpara" },
    { id: "cama", cuarto: "dormitorio", arte: "cama", x: 470, y: 450, w: 540, h: 250, base: 700 },
    { id: "manta", cuarto: "dormitorio", arte: "manta", x: 736, y: 552, w: 248, h: 138, base: 700, z: 7006 },
    { id: "ropero", cuarto: "dormitorio", arte: "ropero", x: 1100, y: 140, w: 360, h: 500, base: 640, interactivo: "puerta", nombre: "ropero" },
  ];

  /* Zonas:
     superficie: los objetos se apoyan en la línea y (entre x1 y x2). "dentro" = solo si ese mueble está abierto.
     asiento: el personaje se sienta con la cadera en (x,y).
     cama: el personaje se acuesta con el centro del cuerpo en (x,y). */
  const ZONAS = [
    { id: "librero_1", cuarto: "sala", tipo: "superficie", mueble: "librero", x1: 90, x2: 240, y: 345 },
    { id: "librero_2", cuarto: "sala", tipo: "superficie", mueble: "librero", x1: 90, x2: 240, y: 460 },
    { id: "librero_3", cuarto: "sala", tipo: "superficie", mueble: "librero", x1: 90, x2: 240, y: 575 },
    { id: "mesa_centro", cuarto: "sala", tipo: "superficie", mueble: "mesa_centro", x1: 715, x2: 925, y: 668 },
    { id: "sofa_1", cuarto: "sala", tipo: "asiento", mueble: "sofa", x: 737, y: 548 },
    { id: "sofa_2", cuarto: "sala", tipo: "asiento", mueble: "sofa", x: 902, y: 548 },
    { id: "sillon", cuarto: "sala", tipo: "asiento", mueble: "sillon", x: 1225, y: 560 },

    { id: "refri_1", cuarto: "cocina", tipo: "superficie", mueble: "refri", dentro: "refri", x1: 92, x2: 278, y: 406 },
    { id: "refri_2", cuarto: "cocina", tipo: "superficie", mueble: "refri", dentro: "refri", x1: 92, x2: 278, y: 516 },
    { id: "refri_3", cuarto: "cocina", tipo: "superficie", mueble: "refri", dentro: "refri", x1: 92, x2: 278, y: 620 },
    { id: "barra", cuarto: "cocina", tipo: "superficie", mueble: "barra", x1: 392, x2: 928, y: 450 },
    { id: "repisa", cuarto: "cocina", tipo: "superficie", mueble: "repisa", x1: 455, x2: 805, y: 244 },
    { id: "mesa", cuarto: "cocina", tipo: "superficie", mueble: "mesa", x1: 1095, x2: 1365, y: 600 },
    { id: "silla_1", cuarto: "cocina", tipo: "asiento", mueble: "silla_1", x: 1020, y: 602 },
    { id: "silla_2", cuarto: "cocina", tipo: "asiento", mueble: "silla_2", x: 1440, y: 602 },

    { id: "juguetero_1", cuarto: "dormitorio", tipo: "superficie", mueble: "juguetero", x1: 74, x2: 296, y: 432 },
    { id: "juguetero_2", cuarto: "dormitorio", tipo: "superficie", mueble: "juguetero", x1: 82, x2: 288, y: 538 },
    { id: "mesita", cuarto: "dormitorio", tipo: "superficie", mueble: "mesita", x1: 360, x2: 410, y: 566 },
    { id: "cama_sup", cuarto: "dormitorio", tipo: "superficie", mueble: "cama", z: 7008, x1: 560, x2: 960, y: 574 },
    { id: "cama", cuarto: "dormitorio", tipo: "cama", mueble: "cama", x: 700, y: 552 },
    { id: "ropero_1", cuarto: "dormitorio", tipo: "superficie", mueble: "ropero", dentro: "ropero", x1: 1152, x2: 1408, y: 290 },
    { id: "ropero_2", cuarto: "dormitorio", tipo: "superficie", mueble: "ropero", dentro: "ropero", x1: 1152, x2: 1408, y: 410 },
  ];

  const muebleId = Object.fromEntries(MUEBLES.map((m) => [m.id, m]));
  for (const z of ZONAS) {
    const m = muebleId[z.mueble];
    if (z.z == null) z.z = m.base * 10 + (z.tipo === "superficie" ? 5 : 3);
    if (z.tipo === "superficie") z.hit = { x1: z.x1 - 12, x2: z.x2 + 12, y1: z.y - 100, y2: z.y + 18 };
    else if (z.tipo === "asiento") z.hit = { x1: z.x - 85, x2: z.x + 85, y1: z.y - 160, y2: z.y + 70 };
    else z.hit = { x1: m.x + 10, x2: m.x + m.w - 10, y1: m.y - 60, y2: m.y + 230 };
  }
  const zonaId = Object.fromEntries(ZONAS.map((z) => [z.id, z]));

  // Dónde empieza cada objeto (y adónde vuelve la comida terminada)
  const OBJETOS_INICIO = {
    libro_rojo: { kind: "surface", zone: "librero_1", x: 125 },
    libro_azul: { kind: "surface", zone: "librero_1", x: 172 },
    taza: { kind: "surface", zone: "mesa_centro", x: 770 },
    pelota: { kind: "floor", room: "sala", x: 1080, y: 836 },
    leche: { kind: "surface", zone: "refri_1", x: 130 },
    jugo: { kind: "surface", zone: "refri_1", x: 200 },
    manzana: { kind: "surface", zone: "refri_2", x: 128 },
    sandia: { kind: "surface", zone: "refri_2", x: 214 },
    pastel: { kind: "surface", zone: "refri_3", x: 180 },
    plato: { kind: "surface", zone: "barra", x: 560 },
    tetera: { kind: "surface", zone: "barra", x: 680 },
    sarten: { kind: "surface", zone: "barra", x: 840 },
    cuchara: { kind: "surface", zone: "repisa", x: 530 },
    platano: { kind: "surface", zone: "mesa", x: 1140 },
    galleta: { kind: "surface", zone: "mesa", x: 1225 },
    sandwich: { kind: "surface", zone: "mesa", x: 1308 },
    osito: { kind: "surface", zone: "juguetero_1", x: 124 },
    cochecito: { kind: "surface", zone: "juguetero_1", x: 238 },
    cubos: { kind: "surface", zone: "juguetero_2", x: 132 },
    patito: { kind: "surface", zone: "juguetero_2", x: 234 },
    libro_verde: { kind: "surface", zone: "ropero_1", x: 1210 },
  };

  // ---------- Guardarropa ----------
  const ROPA = {
    hair: [
      { id: "ondulado", nombre: "Ondulado" }, { id: "corto", nombre: "Corto" },
      { id: "coletas", nombre: "Coletas" }, { id: "chongo", nombre: "Chongo" },
    ],
    hairColor: ["#8b5a33", "#3b2a26", "#e8b86b", "#d9733f", "#f2a0c4", "#8ab4e8"],
    skin: ["#fde3cc", "#f6c9a4", "#e8b088", "#c98e62", "#a8704a", "#7a4e33"],
    top: [{ id: "playera", nombre: "Playera" }, { id: "blusa", nombre: "Blusa" }, { id: "sudadera", nombre: "Sudadera" }],
    topColor: ["#c9a6e8", "#ffd36e", "#9ed9bd", "#f7a8b8", "#8fc3f0", "#fffdf8"],
    bottom: [{ id: "overol", nombre: "Overol" }, { id: "short", nombre: "Short" }, { id: "falda", nombre: "Falda" }, { id: "pantalon", nombre: "Pantalón" }],
    bottomColor: ["#5b86c4", "#7cc4a4", "#f08aa8", "#b48ad8", "#f2b36b", "#6b5b7b"],
    shoes: ["#f08a7a", "#6aa8e8", "#ffd36e", "#9ed9bd", "#fffdf8", "#b48ad8"],
    head: [{ id: "ninguno", nombre: "Nada" }, { id: "gorra", nombre: "Gorra" }, { id: "mono", nombre: "Moño" }, { id: "diadema", nombre: "Diadema" }],
    headColor: ["#9ed9bd", "#f7a8b8", "#ffd36e", "#8fc3f0", "#c9a6e8", "#f08a7a"],
  };

  const PERSONAJES_INICIO = {
    luna: {
      nombre: "Luna",
      look: { hair: "ondulado", hairColor: "#8b5a33", skin: "#f6c9a4", top: "playera", topColor: "#c9a6e8", bottom: "overol", bottomColor: "#5b86c4", shoes: "#f08a7a", head: "gorra", headColor: "#9ed9bd", lentes: false, broches: true, eyes: "#7a4a2a" },
      expr: "feliz",
      loc: { kind: "floor", room: "sala", x: 470, y: 800 },
    },
    teo: {
      nombre: "Teo",
      look: { hair: "corto", hairColor: "#3b2a26", skin: "#c98e62", top: "sudadera", topColor: "#ffd36e", bottom: "pantalon", bottomColor: "#7cc4a4", shoes: "#6aa8e8", head: "ninguno", headColor: "#8fc3f0", lentes: true, broches: false, eyes: "#4a2e1e" },
      expr: "feliz",
      loc: { kind: "seat", zone: "sofa_2" },
    },
  };

  function estadoInicial() {
    const copia = C.U.copia;
    const items = {};
    for (const [id, loc] of Object.entries(OBJETOS_INICIO)) items[id] = { loc: copia(loc), bocados: 0 };
    return {
      v: 1,
      cuarto: "sala",
      silencio: false,
      chars: copia(PERSONAJES_INICIO),
      items,
      muebles: { lampara_sala: { on: false }, lampara_mesa: { on: true }, refri: { open: false }, ropero: { open: false } },
    };
  }

  // Cuarto en el que está una ubicación (null si está en la bandeja o en una mano)
  function cuartoDe(loc) {
    if (!loc) return null;
    if (loc.room) return loc.room;
    if (loc.zone && zonaId[loc.zone]) return zonaId[loc.zone].cuarto;
    return null;
  }

  C.Datos = { CUARTOS, NOMBRES, PISO, MUEBLES, ZONAS, muebleId, zonaId, OBJETOS_INICIO, ROPA, PERSONAJES_INICIO, estadoInicial, cuartoDe, BANDEJA: 5 };
})(window.Casita);
