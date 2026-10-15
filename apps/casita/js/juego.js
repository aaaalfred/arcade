/* Motor de la casita: escenario, capas, arrastrar y soltar, zonas, interacciones y bandeja.
   Un solo sistema de interacción para personajes y objetos en las tres habitaciones. */
(function (C) {
  "use strict";
  const { clamp, el, copia } = C.U;
  const D = C.Datos, PJ = C.Personaje, OB = C.Objetos, MU = C.Muebles, SND = C.Sonido, IC = C.Iconos;
  const J = (C.Juego = {});
  const W = 1600, H = 900, PAD = OB.PAD;

  let S = null, alCambiar = () => {};
  let R = {};                        // referencias del DOM
  let escala = 1, ox = 0, oy = 0;
  const cuartos = {};
  const pjEls = {}, obEls = {}, muEls = {};
  let seleccion = null, pend = null, drag = null, cuartoVisible = null;
  const ocupados = new Set();        // entidades en animación (comiendo, regresando)
  let flecha = { btn: null, t: null };

  // ---------- Coordenadas ----------
  function ajustar() {
    if (!R.area) return;
    const r = R.area.getBoundingClientRect();
    escala = Math.min(r.width / W, r.height / H);
    ox = (r.width - W * escala) / 2;
    oy = (r.height - H * escala) / 2;
    R.esc.style.transform = `translate(${ox}px, ${oy}px) scale(${escala})`;
  }
  function aEsc(cx, cy) {
    const r = R.area.getBoundingClientRect();
    return { x: (cx - r.left - ox) / escala, y: (cy - r.top - oy) / escala };
  }

  // ---------- Consultas de estado ----------
  const poseDe = (loc) => (loc && loc.kind === "seat" ? "sit" : loc && loc.kind === "bed" ? "lie" : "stand");
  const zonaOcupada = (zid) => Object.values(S.chars).some((c) => c.loc && (c.loc.kind === "seat" || c.loc.kind === "bed") && c.loc.zone === zid);
  const manoOcupada = (pid, h) => Object.values(S.items).some((it) => it.loc && it.loc.kind === "hand" && it.loc.owner === pid && it.loc.hand === h);
  const manoLibre = (pid) => (!manoOcupada(pid, "R") ? "R" : !manoOcupada(pid, "L") ? "L" : null);
  function cuartoDeEntidad(ent) {
    const l = ent.loc;
    if (!l) return null;
    if (l.kind === "hand") return S.chars[l.owner] ? D.cuartoDe(S.chars[l.owner].loc) : null;
    return D.cuartoDe(l);
  }
  function ranuraOcupada(slot) {
    for (const [id, c] of Object.entries(S.chars)) if (c.loc && c.loc.kind === "tray" && c.loc.slot === slot) return { tipo: "pj", id };
    for (const [id, it] of Object.entries(S.items)) if (it.loc && it.loc.kind === "tray" && it.loc.slot === slot) return { tipo: "ob", id };
    return null;
  }
  // Puntos de boca y manos de un personaje, en coordenadas del escenario
  function puntosPJ(pid) {
    const l = S.chars[pid].loc;
    let ax, ay, dy;
    if (l.kind === "seat") { const z = D.zonaId[l.zone]; ax = z.x; ay = z.y; dy = 92; }
    else { ax = l.x; ay = l.y; dy = 0; }
    const p = (lx, ly) => ({ x: ax + lx, y: ay + ly + dy });
    return { boca: p(PJ.BOCA[0], PJ.BOCA[1]), L: p(PJ.MANOS.L[0], PJ.MANOS.L[1]), R: p(PJ.MANOS.R[0], PJ.MANOS.R[1]) };
  }

  // ---------- Construcción ----------
  function construir() {
    R.esc.innerHTML = "";
    for (const k of Object.keys(pjEls)) delete pjEls[k];
    for (const k of Object.keys(obEls)) delete obEls[k];
    for (const c of D.CUARTOS) {
      const root = el("div", "cuarto", MU.fondo(c));
      root.dataset.cuarto = c;
      const capa = el("div", "capa"), luces = el("div", "luces"), zonas = el("div", "zonas");
      root.append(capa, luces, zonas);
      R.esc.appendChild(root);
      cuartos[c] = { root, capa, luces, zonas };
    }
    for (const m of D.MUEBLES) crearMueble(m);
    for (const id of Object.keys(S.chars)) crearPJ(id);
    for (const id of Object.keys(S.items)) crearOB(id);
    for (const id of Object.keys(S.chars)) ubicarPJ(id);
    for (const id of Object.keys(S.items)) ubicarOB(id);
    actualizarLuces();
    cuartoVisible = null;
    mostrarCuarto(S.cuarto, 0);
    renderBandeja();
    seleccionar(null);
  }

  function crearMueble(m) {
    const e = el("div", "mueble" + (m.interactivo ? " interactivo" : ""));
    e.dataset.id = m.id;
    Object.assign(e.style, { left: m.x + "px", top: m.y + "px", width: m.w + "px", height: m.h + "px", zIndex: m.z != null ? m.z : m.base * 10 });
    if (m.interactivo) e.setAttribute("aria-label", m.nombre);
    cuartos[m.cuarto].capa.appendChild(e);
    muEls[m.id] = e;
    dibujarMueble(m.id);
  }
  function dibujarMueble(id) {
    const m = D.muebleId[id];
    muEls[id].innerHTML = `<div class="mu-in">${MU.mueble(m, S.muebles[id])}</div>`;
  }

  function crearPJ(id) {
    const e = el("div", "pj");
    e.dataset.id = id;
    e.innerHTML =
      `<div class="pj-rot"><div class="pj-react"><div class="pj-anim">` +
      `<div class="pj-cuerpo"></div><div class="pj-mano" data-mano="L"></div><div class="pj-mano" data-mano="R"></div>` +
      `<div class="pj-boca"></div><div class="pj-manos"></div>` +
      `</div></div></div>` +
      `<div class="pj-zzz"><span>z</span><span>z</span><span>Z</span></div><div class="pj-part"></div>` +
      `<div class="pj-nombre">${S.chars[id].nombre || id}</div>`;
    const q = (s) => e.querySelector(s);
    pjEls[id] = {
      root: e, react: q(".pj-react"), cuerpo: q(".pj-cuerpo"), manos: q(".pj-manos"), boca: q(".pj-boca"), part: q(".pj-part"),
      manoL: q('.pj-mano[data-mano="L"]'), manoR: q('.pj-mano[data-mano="R"]'), pose: null,
    };
    dibujarPJ(id, "stand");
  }
  function dibujarPJ(id, pose) {
    const c = S.chars[id], E = pjEls[id];
    E.pose = pose || E.pose || poseDe(c.loc);
    E.cuerpo.innerHTML = PJ.cuerpoSVG(c.look, { expr: c.expr, pose: E.pose });
    E.manos.innerHTML = PJ.manosSVG(c.look);
  }

  function crearOB(id) {
    const def = OB.lista[id];
    const e = el("div", "obj");
    e.dataset.id = id;
    e.setAttribute("aria-label", def.nombre);
    e.style.width = def.w + PAD * 2 + "px";
    e.style.height = def.h + PAD * 2 + "px";
    obEls[id] = e;
    dibujarOB(id);
  }
  function dibujarOB(id) {
    obEls[id].innerHTML = `<div class="obj-in">${OB.objetoSVG(id, S.items[id].bocados)}</div>`;
  }

  // ---------- Colocación ----------
  function ubicarPJ(id) {
    const c = S.chars[id], E = pjEls[id], l = c.loc;
    E.root.style.transform = "";
    E.root.style.transition = "";
    E.root.classList.remove("pose-stand", "pose-sit", "pose-lie", "arrastrando");
    if (!l || l.kind === "tray") { E.root.remove(); return; }
    let x, y, z, cuarto;
    const pose = poseDe(l);
    if (l.kind === "floor") { x = l.x; y = l.y; z = Math.round(y * 10) + 1; cuarto = l.room; }
    else { const zo = D.zonaId[l.zone]; x = zo.x; y = zo.y; z = zo.z; cuarto = zo.cuarto; }
    const [ax, ay] = PJ.ANCLAS[pose];
    E.root.style.left = x - ax + "px";
    E.root.style.top = y - ay + "px";
    E.root.style.zIndex = z;
    E.root.classList.add("pose-" + pose);
    if (E.pose !== pose) dibujarPJ(id, pose);
    if (E.root.parentNode !== cuartos[cuarto].capa) cuartos[cuarto].capa.appendChild(E.root);
  }

  function ubicarOB(id) {
    const it = S.items[id], def = OB.lista[id], e = obEls[id], l = it.loc;
    e.style.transform = "";
    e.style.transition = "";
    e.classList.remove("arrastrando", "oculto", "en-mano");
    if (!l || l.kind === "tray") { e.remove(); return; }
    if (l.kind === "hand") {
      const P = pjEls[l.owner];
      const ranura = l.hand === "L" ? P.manoL : P.manoR;
      e.style.left = -(def.w / 2 + PAD) + "px";
      e.style.top = -(def.h + PAD) + 20 + "px";
      e.style.zIndex = "";
      e.classList.add("en-mano");
      if (e.parentNode !== ranura) ranura.appendChild(e);
      return;
    }
    let x, y, z, cuarto, oculto = false;
    if (l.kind === "floor") { x = l.x; y = l.y; z = Math.round(y * 10) + 2; cuarto = l.room; }
    else {
      const zo = D.zonaId[l.zone];
      x = l.x; y = zo.y; z = zo.z; cuarto = zo.cuarto;
      oculto = !!(zo.dentro && !S.muebles[zo.dentro].open);
    }
    e.style.left = x - def.w / 2 - PAD + "px";
    e.style.top = y - def.h - PAD + "px";
    e.style.zIndex = z;
    e.classList.toggle("oculto", oculto);
    if (e.parentNode !== cuartos[cuarto].capa) cuartos[cuarto].capa.appendChild(e);
  }

  // ---------- Habitaciones ----------
  function mostrarCuarto(nuevo, dir) {
    const viejo = cuartoVisible;
    S.cuarto = nuevo;
    cuartoVisible = nuevo;
    for (const c of D.CUARTOS) {
      const r = cuartos[c].root;
      r.classList.remove("activa", "entra-der", "entra-izq", "sale-der", "sale-izq");
      if (c === nuevo) r.classList.add("activa");
    }
    if (viejo && viejo !== nuevo && dir) {
      cuartos[viejo].root.classList.add(dir > 0 ? "sale-izq" : "sale-der");
      cuartos[nuevo].root.classList.add(dir > 0 ? "entra-der" : "entra-izq");
      setTimeout(() => {
        cuartos[viejo].root.classList.remove("sale-izq", "sale-der");
        cuartos[nuevo].root.classList.remove("entra-der", "entra-izq");
      }, 420);
    }
    const i = D.CUARTOS.indexOf(nuevo);
    const prev = D.CUARTOS[i - 1], next = D.CUARTOS[i + 1];
    R.flechaIzq.hidden = !prev;
    R.flechaDer.hidden = !next;
    if (prev) R.flechaIzq.querySelector(".flecha-txt").textContent = D.NOMBRES[prev];
    if (next) R.flechaDer.querySelector(".flecha-txt").textContent = D.NOMBRES[next];
    R.nombreCuarto.textContent = D.NOMBRES[nuevo];
    if (seleccion && cuartoDeEntidad(S.chars[seleccion]) !== nuevo && !(drag && drag.id === seleccion)) seleccionar(null);
  }

  function cambiarCuarto(dir) {
    const i = D.CUARTOS.indexOf(S.cuarto) + dir;
    if (i < 0 || i >= D.CUARTOS.length) return;
    mostrarCuarto(D.CUARTOS[i], dir);
    SND.tocar("cuarto");
    if (drag) { drag.lista = calcularObjetivos(); mostrarZonas(); }
    alCambiar();
  }

  function actualizarLuces() {
    const sala = cuartos.sala.luces, dor = cuartos.dormitorio.luces;
    sala.innerHTML = S.muebles.lampara_sala.on ? `<div class="luz-calida" style="left:1460px;top:110px"></div>` : "";
    const on = S.muebles.lampara_mesa.on;
    dor.innerHTML = `<div class="noche${on ? " tenue" : ""}"></div>` + (on ? `<div class="luz-calida chica" style="left:440px;top:470px"></div>` : "");
  }

  function alternarMueble(id) {
    const m = D.muebleId[id], st = S.muebles[id];
    if (m.interactivo === "lampara") {
      st.on = !st.on;
      SND.tocar("lampara");
      actualizarLuces();
    } else {
      st.open = !st.open;
      SND.tocar("puerta");
      for (const oid of Object.keys(S.items)) {
        const l = S.items[oid].loc;
        if (l && l.kind === "surface" && D.zonaId[l.zone].dentro === id) ubicarOB(oid);
      }
    }
    dibujarMueble(id);
    reaccion(muEls[id].querySelector(".mu-in"), "menea");
    alCambiar();
  }

  // ---------- Selección y expresiones ----------
  function seleccionar(id) {
    if (seleccion && pjEls[seleccion]) pjEls[seleccion].root.classList.remove("seleccionado");
    seleccion = id;
    if (id) pjEls[id].root.classList.add("seleccionado");
    if (R.onSeleccion) R.onSeleccion(id);
  }
  function expresar(expr) {
    if (!seleccion) return;
    const c = S.chars[seleccion];
    c.expr = expr;
    dibujarPJ(seleccion);
    reaccion(pjEls[seleccion].react, expr === "triste" ? "encoge" : expr === "enojo" ? "menea" : "salto");
    SND.tocar(expr === "feliz" ? "feliz" : expr === "sorpresa" ? "boing" : expr === "enojo" ? "invalido" : "dormir");
    if (R.onSeleccion) R.onSeleccion(seleccion);
    alCambiar();
  }

  // ---------- Animaciones pequeñas ----------
  function reaccion(nodo, clase) {
    if (!nodo) return;
    nodo.classList.remove("salto", "rebote", "menea", "encoge");
    void nodo.offsetWidth;
    nodo.classList.add(clase);
    setTimeout(() => nodo.classList.remove(clase), 650);
  }
  function particulas(pid, tipo) {
    const E = pjEls[pid];
    const pose = E.pose;
    const cabeza = pose === "lie" ? [40, 120] : [115, 30];
    const boca = pose === "lie" ? [65, 195] : [115, 150];
    const n = tipo === "corazon" ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const p = el("span", "part " + tipo);
      const [bx, by] = tipo === "corazon" ? cabeza : boca;
      p.style.left = bx + (Math.random() * 60 - 30) + "px";
      p.style.top = by + (Math.random() * 16 - 8) + "px";
      p.style.animationDelay = i * (tipo === "corazon" ? 0.15 : 0.12) + "s";
      p.style.setProperty("--dx", Math.random() * 50 - 25 + "px");
      if (tipo === "corazon") p.innerHTML = C.U.svg("0 0 40 40", C.U.heart(20, 22, 14, "#ff8fa3", 3));
      E.part.appendChild(p);
      setTimeout(() => p.remove(), 1600);
    }
  }
  function parpadeos() {
    for (const id of Object.keys(pjEls)) {
      if (Math.random() < 0.3) {
        const r = pjEls[id].root;
        r.classList.add("parpadea");
        setTimeout(() => r.classList.remove("parpadea"), 220);
      }
    }
  }

  // ---------- Bandeja ----------
  function renderBandeja() {
    const cont = R.ranuras;
    cont.innerHTML = "";
    for (let i = 0; i < D.BANDEJA; i++) {
      const r = el("div", "ranura");
      r.dataset.slot = i;
      const o = ranuraOcupada(i);
      if (o) {
        r.dataset.tipo = o.tipo;
        r.dataset.id = o.id;
        r.classList.add("llena", o.tipo);
        r.innerHTML = o.tipo === "pj" ? PJ.retrato(S.chars[o.id].look) : OB.objetoSVG(o.id, S.items[o.id].bocados, "-bandeja");
        r.setAttribute("aria-label", o.tipo === "pj" ? S.chars[o.id].nombre : OB.lista[o.id].nombre);
      }
      cont.appendChild(r);
    }
  }
  function ranuraEn(cx, cy) {
    const b = R.bandeja.getBoundingClientRect();
    if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) return null;
    const ranuras = [...R.ranuras.children];
    for (const r of ranuras) {
      const q = r.getBoundingClientRect();
      if (cx >= q.left && cx <= q.right && cy >= q.top - 20 && cy <= q.bottom + 20 && !ranuraOcupada(+r.dataset.slot)) return +r.dataset.slot;
    }
    for (let i = 0; i < D.BANDEJA; i++) if (!ranuraOcupada(i)) return i;
    return -1; // llena
  }

  // ---------- Objetivos para soltar ----------
  function calcularObjetivos() {
    const lista = [], r = S.cuarto;
    if (drag.tipo === "pj") {
      for (const z of D.ZONAS) {
        if (z.cuarto !== r || (z.tipo !== "asiento" && z.tipo !== "cama") || zonaOcupada(z.id)) continue;
        const vis = z.tipo === "asiento"
          ? { x1: z.x - 78, x2: z.x + 78, y1: z.y - 70, y2: z.y + 36 }
          : { x1: z.hit.x1 + 50, x2: z.hit.x2 - 60, y1: z.y - 30, y2: z.y + 60 };
        lista.push({ clase: z.tipo, rect: z.hit, vis, zona: z });
      }
    } else {
      const def = OB.lista[drag.id];
      for (const pid of Object.keys(S.chars)) {
        const c = S.chars[pid];
        if (!c.loc || D.cuartoDe(c.loc) !== r || c.loc.kind === "bed" || c.loc.kind === "tray" || ocupados.has(pid)) continue;
        const pts = puntosPJ(pid);
        if (def.comida) lista.push({ clase: "boca", pj: pid, c: pts.boca, r: 44 });
        for (const h of ["R", "L"]) if (!manoOcupada(pid, h)) lista.push({ clase: "mano", pj: pid, mano: h, c: pts[h], r: 40 });
      }
      for (const z of D.ZONAS) {
        if (z.cuarto !== r || z.tipo !== "superficie" || (z.dentro && !S.muebles[z.dentro].open)) continue;
        lista.push({ clase: "superficie", rect: z.hit, vis: { x1: z.x1 - 6, x2: z.x2 + 6, y1: z.y - 46, y2: z.y + 8 }, zona: z });
      }
    }
    lista.push({ clase: "piso" });
    return lista;
  }

  function mostrarZonas() {
    for (const c of D.CUARTOS) cuartos[c].zonas.innerHTML = "";
    const capa = cuartos[S.cuarto].zonas;
    for (const o of drag.lista) {
      let z;
      if (o.clase === "piso") {
        z = el("div", "zona piso");
        Object.assign(z.style, { left: D.PISO.x1 - 30 + "px", top: D.PISO.y1 - 10 + "px", width: D.PISO.x2 - D.PISO.x1 + 60 + "px", height: D.PISO.y2 - D.PISO.y1 + 20 + "px" });
      } else if (o.c) {
        z = el("div", "zona circ " + o.clase);
        Object.assign(z.style, { left: o.c.x - o.r + "px", top: o.c.y - o.r + "px", width: o.r * 2 + "px", height: o.r * 2 + "px" });
      } else {
        const v = o.vis;
        z = el("div", "zona rect " + o.clase);
        Object.assign(z.style, { left: v.x1 + "px", top: v.y1 + "px", width: v.x2 - v.x1 + "px", height: v.y2 - v.y1 + "px" });
      }
      o.el = z;
      capa.appendChild(z);
    }
  }
  function limpiarZonas() {
    for (const c of D.CUARTOS) cuartos[c].zonas.innerHTML = "";
    R.bandeja.classList.remove("sobre", "llena-aviso");
  }

  function buscarObjetivo(cx, cy) {
    const slot = ranuraEn(cx, cy);
    if (slot !== null) return slot >= 0 ? { clase: "bandeja", slot } : { clase: "bandeja-llena" };
    const p = aEsc(cx, cy);
    if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) return null;
    const def = drag.tipo === "ob" ? OB.lista[drag.id] : null;
    for (const o of drag.lista) {
      if (o.clase === "piso") {
        const by = drag.tipo === "pj" ? p.y + 150 : p.y + def.h / 2;
        if (by >= D.PISO.y1 - 30 && by <= D.PISO.y2 + 40 && p.x >= D.PISO.x1 - 40 && p.x <= D.PISO.x2 + 40) return o;
      } else if (o.rect) {
        const q = o.rect;
        if (p.x >= q.x1 && p.x <= q.x2 && p.y >= q.y1 && p.y <= q.y2) return o;
      } else if (o.c) {
        if (Math.hypot(p.x - o.c.x, p.y - o.c.y) <= o.r) return o;
      }
    }
    return null;
  }

  // ---------- Arrastre ----------
  function posFantasma(tipo, id, cx, cy) {
    if (tipo === "pj") return [cx - 115 * escala, cy - 195 * escala];
    const def = OB.lista[id];
    return [cx - (def.w / 2 + PAD) * escala, cy - (def.h / 2 + PAD) * escala];
  }

  function iniciarArrastre(info, e) {
    const { tipo, id } = info;
    const ent = tipo === "pj" ? S.chars[id] : S.items[id];
    const elem = tipo === "pj" ? pjEls[id].root : obEls[id];
    // Punto de pantalla al que debe volver el "agarre" si se suelta en un lugar no válido
    let origen;
    const l = ent.loc;
    const aPant = (x, y) => { const p = J._aPantalla(x, y); return { cx: p.x, cy: p.y }; };
    if (info.desdeBandeja) {
      const r = R.ranuras.children[l.slot].getBoundingClientRect();
      origen = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    } else if (tipo === "pj") {
      if (l.kind === "floor") origen = aPant(l.x, l.y - 150);
      else { const z = D.zonaId[l.zone]; origen = aPant(z.x, l.kind === "seat" ? z.y - 58 : z.y); }
    } else if (l.kind === "hand") {
      const r = elem.getBoundingClientRect();
      origen = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    } else {
      const def = OB.lista[id];
      const y = l.kind === "floor" ? l.y : D.zonaId[l.zone].y;
      origen = aPant(l.x, y - def.h / 2);
    }
    drag = { tipo, id, elem, pid: info.pid, origenLoc: copia(ent.loc), origen, objetivo: null };
    ent.loc = null;
    elem.classList.remove("oculto", "en-mano");
    elem.classList.add("arrastrando");
    elem.style.left = "0px";
    elem.style.top = "0px";
    elem.style.zIndex = "";
    if (tipo === "pj") {
      pjEls[id].root.classList.remove("pose-sit", "pose-lie");
      pjEls[id].root.classList.add("pose-stand");
      if (pjEls[id].pose !== "stand") dibujarPJ(id, "stand");
      seleccionar(id);
    }
    R.capaArrastre.appendChild(elem);
    if (info.desdeBandeja) renderBandeja();
    drag.lista = calcularObjetivos();
    mostrarZonas();
    moverArrastre(e.clientX, e.clientY);
    SND.tocar("tomar");
  }

  function moverArrastre(cx, cy) {
    const [px, py] = posFantasma(drag.tipo, drag.id, cx, cy);
    drag.elem.style.transform = `translate(${px}px, ${py}px) scale(${escala})`;
    vigilarFlechas(cx, cy);
    const o = buscarObjetivo(cx, cy);
    if (drag.objetivo && drag.objetivo.el) drag.objetivo.el.classList.remove("activa");
    R.bandeja.classList.toggle("sobre", !!o && o.clase === "bandeja");
    R.bandeja.classList.toggle("llena-aviso", !!o && o.clase === "bandeja-llena");
    if (o && o.el) o.el.classList.add("activa");
    drag.objetivo = o;
  }

  function vigilarFlechas(cx, cy) {
    let sobre = null;
    for (const [btn, dir] of [[R.flechaIzq, -1], [R.flechaDer, 1]]) {
      if (btn.hidden) continue;
      const r = btn.getBoundingClientRect();
      if (cx >= r.left - 10 && cx <= r.right + 10 && cy >= r.top - 30 && cy <= r.bottom + 30) sobre = [btn, dir];
    }
    if (sobre && flecha.btn === sobre[0]) return;
    limpiarFlecha();
    if (sobre) {
      flecha.btn = sobre[0];
      flecha.btn.classList.add("cargando");
      flecha.t = setTimeout(() => { limpiarFlecha(); if (drag) cambiarCuarto(sobre[1]); }, 650);
    }
  }
  function limpiarFlecha() {
    clearTimeout(flecha.t);
    if (flecha.btn) flecha.btn.classList.remove("cargando");
    flecha = { btn: null, t: null };
  }

  function soltar(cx, cy) {
    const d = drag;
    limpiarFlecha();
    const o = buscarObjetivo(cx, cy);
    limpiarZonas();
    if (!o || o.clase === "bandeja-llena") return regresar();
    const p = aEsc(cx, cy);
    drag = null;
    if (d.tipo === "pj") {
      const c = S.chars[d.id];
      if (o.clase === "asiento") { c.loc = { kind: "seat", zone: o.zona.id }; SND.tocar("sentar"); }
      else if (o.clase === "cama") { c.loc = { kind: "bed", zone: o.zona.id }; SND.tocar("dormir"); }
      else if (o.clase === "bandeja") { c.loc = { kind: "tray", slot: o.slot }; SND.tocar("bandeja"); }
      else { c.loc = { kind: "floor", room: S.cuarto, x: Math.round(clamp(p.x, D.PISO.x1, D.PISO.x2)), y: Math.round(clamp(p.y + 150, D.PISO.y1, D.PISO.y2)) }; SND.tocar("soltar"); }
      ubicarPJ(d.id);
      if (c.loc.kind === "tray") seleccionar(null);
      else reaccion(pjEls[d.id].react, c.loc.kind === "bed" ? "encoge" : "rebote");
    } else {
      const it = S.items[d.id], def = OB.lista[d.id];
      if (o.clase === "boca") { comer(o.pj, d.id, d.origenLoc); renderBandeja(); return; }
      if (o.clase === "mano") {
        it.loc = { kind: "hand", owner: o.pj, hand: o.mano };
        SND.tocar("toque");
        reaccion(pjEls[o.pj].react, "salto");
      } else if (o.clase === "superficie") {
        it.loc = { kind: "surface", zone: o.zona.id, x: Math.round(clamp(p.x, o.zona.x1, o.zona.x2)) };
        SND.tocar("soltar");
      } else if (o.clase === "bandeja") {
        it.loc = { kind: "tray", slot: o.slot };
        SND.tocar("bandeja");
      } else {
        it.loc = { kind: "floor", room: S.cuarto, x: Math.round(clamp(p.x, D.PISO.x1, D.PISO.x2)), y: Math.round(clamp(p.y + def.h / 2, D.PISO.y1, D.PISO.y2)) };
        SND.tocar("soltar");
      }
      ubicarOB(d.id);
      if (it.loc.kind !== "tray") reaccion(obEls[d.id].querySelector(".obj-in"), "rebote");
    }
    renderBandeja();
    alCambiar();
  }

  // Si se suelta en un lugar no válido, regresa suavemente a donde estaba
  function regresar() {
    const d = drag;
    drag = null;
    SND.tocar("invalido");
    ocupados.add(d.id);
    const [px, py] = posFantasma(d.tipo, d.id, d.origen.cx, d.origen.cy);
    d.elem.style.transition = "transform .38s cubic-bezier(.3,1.25,.5,1)";
    d.elem.style.transform = `translate(${px}px, ${py}px) scale(${escala})`;
    setTimeout(() => {
      const ent = d.tipo === "pj" ? S.chars[d.id] : S.items[d.id];
      ent.loc = d.origenLoc;
      if (d.tipo === "pj") ubicarPJ(d.id); else ubicarOB(d.id);
      ocupados.delete(d.id);
      renderBandeja();
      alCambiar();
    }, 400);
  }

  // ---------- Comer ----------
  function comer(pid, oid, origenLoc) {
    const def = OB.lista[oid], it = S.items[oid], E = pjEls[pid], e = obEls[oid];
    ocupados.add(pid); ocupados.add(oid);
    const mano = manoLibre(pid);
    it.loc = mano ? { kind: "hand", owner: pid, hand: mano } : origenLoc; // destino tras comer (estado siempre válido)
    e.classList.remove("arrastrando");
    e.style.transform = "";
    e.style.transition = "";
    e.style.left = -(def.w / 2 + PAD) + "px";
    e.style.top = -(def.h / 2 + PAD) + "px";
    E.boca.appendChild(e);
    e.classList.add("mordiendo");
    E.root.classList.add("comiendo");
    SND.tocar(def.bebida ? "beber" : "comer");
    particulas(pid, def.bebida ? "gotas" : "migas");
    alCambiar();
    setTimeout(() => {
      E.root.classList.remove("comiendo");
      e.classList.remove("mordiendo");
      S.chars[pid].expr = "feliz";
      dibujarPJ(pid);
      particulas(pid, "corazon");
      reaccion(E.react, "salto");
      SND.tocar("feliz");
      const fin = () => { ocupados.delete(pid); ocupados.delete(oid); renderBandeja(); if (seleccion === pid && R.onSeleccion) R.onSeleccion(pid); alCambiar(); };
      if (!def.bebida) it.bocados++;
      if (!def.bebida && it.bocados >= 3) {
        e.classList.add("desaparece");
        setTimeout(() => {
          e.classList.remove("desaparece");
          it.bocados = 0;
          it.loc = copia(D.OBJETOS_INICIO[oid]); // se repone en su lugar de siempre
          dibujarOB(oid);
          ubicarOB(oid);
          fin();
        }, 420);
      } else {
        dibujarOB(oid);
        ubicarOB(oid);
        fin();
      }
    }, 1300);
  }

  // ---------- Entrada (ratón y táctil) ----------
  function resaltar(info, on) {
    let n = null;
    if (info.tipo === "ob" && !info.desdeBandeja) n = obEls[info.id];
    else if (info.tipo === "pj" && !info.desdeBandeja) n = pjEls[info.id].root;
    else if (info.tipo === "mu") n = muEls[info.id];
    if (n) n.classList.toggle("tocado", on);
  }

  function onDown(e) {
    if (drag || pend) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const t = e.target;
    if (!t || !t.closest || !R.juego.contains(t)) return;
    if (t.closest("button, .modal, #barra-sup, #panel-pj")) return;
    const ran = t.closest(".ranura");
    const ob = t.closest(".obj");
    const pj = t.closest(".pj");
    const mu = t.closest(".mueble.interactivo");
    let info = null;
    if (ran) { if (ran.dataset.tipo) info = { tipo: ran.dataset.tipo, id: ran.dataset.id, desdeBandeja: true }; else return; }
    else if (ob && R.esc.contains(ob)) info = { tipo: "ob", id: ob.dataset.id };
    else if (pj && R.esc.contains(pj)) info = { tipo: "pj", id: pj.dataset.id };
    else if (mu) info = { tipo: "mu", id: mu.dataset.id };
    else { if (R.area.contains(t)) seleccionar(null); return; }
    if (info.tipo !== "mu") {
      if (ocupados.has(info.id)) return;
      if (info.tipo === "ob") { const l = S.items[info.id].loc; if (l && l.kind === "hand" && ocupados.has(l.owner)) return; }
    }
    e.preventDefault();
    SND.desbloquear();
    pend = Object.assign(info, { x: e.clientX, y: e.clientY, pid: e.pointerId });
    resaltar(info, true);
  }
  function onMove(e) {
    if (pend && !drag && e.pointerId === pend.pid && pend.tipo !== "mu") {
      if (Math.hypot(e.clientX - pend.x, e.clientY - pend.y) > 8) {
        resaltar(pend, false);
        iniciarArrastre(pend, e);
      }
    }
    if (drag && e.pointerId === drag.pid) { e.preventDefault(); moverArrastre(e.clientX, e.clientY); }
  }
  function onUp(e) {
    if (drag && e.pointerId === drag.pid) { soltar(e.clientX, e.clientY); pend = null; return; }
    if (pend && e.pointerId === pend.pid) {
      const p = pend;
      pend = null;
      resaltar(p, false);
      tocar(p);
    }
  }
  function onCancel(e) {
    if (drag && e.pointerId === drag.pid) { limpiarFlecha(); limpiarZonas(); regresar(); }
    if (pend && e.pointerId === pend.pid) { resaltar(pend, false); pend = null; }
  }

  function tocar(info) {
    if (info.tipo === "pj") {
      if (info.desdeBandeja) return;
      seleccionar(info.id);
      reaccion(pjEls[info.id].react, "salto");
      SND.tocar("boing");
    } else if (info.tipo === "ob") {
      if (info.desdeBandeja) return;
      reaccion(obEls[info.id].querySelector(".obj-in"), "menea");
      SND.tocar("toque");
    } else if (info.tipo === "mu") {
      alternarMueble(info.id);
    }
  }

  // ---------- API ----------
  let listo = false;
  J.iniciar = function (estado, refs, onCambio) {
    S = estado;
    R = refs;
    alCambiar = onCambio || (() => {});
    construir();
    ajustar();
    if (!listo) {
      listo = true;
      window.addEventListener("resize", ajustar);
      window.addEventListener("orientationchange", () => setTimeout(ajustar, 200));
      window.addEventListener("pointerdown", onDown, { passive: false });
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      R.flechaIzq.addEventListener("click", () => cambiarCuarto(-1));
      R.flechaDer.addEventListener("click", () => cambiarCuarto(1));
      setInterval(parpadeos, 900);
    }
  };
  J.reconstruir = function (estado) { S = estado; drag = null; pend = null; ocupados.clear(); construir(); ajustar(); };
  J.ajustar = ajustar;
  J.expresar = expresar;
  J.seleccionado = () => seleccion;
  J.estado = () => S;
  J.refrescarPJ = function (id) { dibujarPJ(id); renderBandeja(); if (seleccion === id && R.onSeleccion) R.onSeleccion(id); alCambiar(); };
  J.cambiarCuarto = cambiarCuarto;
  // Para pruebas automáticas: punto de pantalla de un lugar del escenario
  J._aPantalla = function (x, y) {
    const r = R.area.getBoundingClientRect();
    return { x: r.left + ox + x * escala, y: r.top + oy + y * escala };
  };
  J._puntosPJ = (pid) => puntosPJ(pid);
})(window.Casita);
