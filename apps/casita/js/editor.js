/* Editor de personaje: cabello, tono de piel, ropa y accesorios, con vista previa en vivo. */
(function (C) {
  "use strict";
  const { el } = C.U;
  const D = C.Datos, PJ = C.Personaje, IC = C.Iconos, SND = C.Sonido;

  let modal, actual = null, pestana = "cabello";

  const PESTANAS = [
    { id: "cabello", nombre: "Cabello" },
    { id: "piel", nombre: "Piel" },
    { id: "ropa", nombre: "Ropa" },
    { id: "accesorios", nombre: "Accesorios" },
  ];

  const estado = () => C.Juego.estado();
  const look = () => estado().chars[actual].look;

  function vistaCuerpo(lk, vb) {
    const s = PJ.cuerpoSVG(lk, { pose: "stand", expr: "feliz", sinSombra: true });
    return vb ? s.replace(`viewBox="${PJ.VB}"`, `viewBox="${vb}"`) : s;
  }

  function tarjetas(campo, opciones, vb) {
    const lk = look();
    return `<div class="tarjetas">` + opciones.map((o) => {
      const prueba = Object.assign({}, lk, { [campo]: o.id });
      const sel = lk[campo] === o.id ? " sel" : "";
      return `<button class="tarjeta${sel}" data-campo="${campo}" data-valor="${o.id}" aria-pressed="${!!sel}">${vistaCuerpo(prueba, vb)}<span>${o.nombre}</span></button>`;
    }).join("") + `</div>`;
  }
  function colores(campo, lista) {
    const lk = look();
    return `<div class="colores">` + lista.map((c) =>
      `<button class="color${lk[campo] === c ? " sel" : ""}" data-campo="${campo}" data-valor="${c}" style="--c:${c}" aria-label="Color"></button>`).join("") + `</div>`;
  }
  function interruptor(campo, nombre, vb) {
    const lk = look();
    const prueba = Object.assign({}, lk, { [campo]: true });
    return `<button class="tarjeta${lk[campo] ? " sel" : ""}" data-campo="${campo}" data-toggle="1" aria-pressed="${!!lk[campo]}">${vistaCuerpo(prueba, vb)}<span>${nombre}</span></button>`;
  }

  const CARA = "-95 -345 190 200", TORSO = "-100 -200 200 210", CUERPO = "-100 -345 200 355";

  function contenido() {
    const R = D.ROPA;
    switch (pestana) {
      case "cabello":
        return `<h3>Peinado</h3>${tarjetas("hair", R.hair, CARA)}<h3>Color</h3>${colores("hairColor", R.hairColor)}`;
      case "piel":
        return `<h3>Tono de piel</h3>${colores("skin", R.skin)}<div class="vista-piel">${vistaCuerpo(look(), CARA)}</div>`;
      case "ropa":
        return `<h3>Arriba</h3>${tarjetas("top", R.top, TORSO)}${colores("topColor", R.topColor)}` +
          `<h3>Abajo</h3>${tarjetas("bottom", R.bottom, TORSO)}${colores("bottomColor", R.bottomColor)}` +
          `<h3>Zapatos</h3>${colores("shoes", R.shoes)}`;
      default:
        return `<h3>En la cabeza</h3>${tarjetas("head", R.head, CARA)}${colores("headColor", R.headColor)}` +
          `<h3>Extras</h3><div class="tarjetas">${interruptor("lentes", "Lentes", CARA)}${interruptor("broches", "Broches", CARA)}</div>`;
    }
  }

  function render() {
    const S = estado();
    modal.querySelector(".editor-pjs").innerHTML = Object.entries(S.chars).map(([id, c]) =>
      `<button class="chip-pj${id === actual ? " sel" : ""}" data-pj="${id}">${PJ.retrato(c.look)}<span>${c.nombre}</span></button>`).join("");
    modal.querySelector(".editor-vista").innerHTML = vistaCuerpo(look(), CUERPO);
    modal.querySelector(".pestanas").innerHTML = PESTANAS.map((p) =>
      `<button class="pestana${p.id === pestana ? " sel" : ""}" data-pestana="${p.id}">${p.nombre}</button>`).join("");
    modal.querySelector(".opciones").innerHTML = contenido();
  }

  function onClick(e) {
    const b = e.target.closest("button");
    if (!b || !modal.contains(b)) return;
    if (b.dataset.pj) { actual = b.dataset.pj; SND.tocar("toque"); render(); return; }
    if (b.dataset.pestana) { pestana = b.dataset.pestana; SND.tocar("toque"); render(); return; }
    if (b.classList.contains("cerrar-editor") || b.classList.contains("listo")) { cerrar(); return; }
    if (b.dataset.campo) {
      const lk = look();
      if (b.dataset.toggle) lk[b.dataset.campo] = !lk[b.dataset.campo];
      else {
        lk[b.dataset.campo] = b.dataset.valor;
        // al elegir un accesorio de cabeza con "Nada" no hace falta color
      }
      SND.tocar("toque");
      C.Juego.refrescarPJ(actual);
      const scroll = modal.querySelector(".opciones").scrollTop;
      render();
      modal.querySelector(".opciones").scrollTop = scroll;
      const v = modal.querySelector(".editor-vista");
      v.classList.remove("salto"); void v.offsetWidth; v.classList.add("salto");
    }
  }

  function abrir(id) {
    actual = id || C.Juego.seleccionado() || Object.keys(estado().chars)[0];
    modal.hidden = false;
    render();
    SND.tocar("feliz");
  }
  function cerrar() {
    modal.hidden = true;
    SND.tocar("soltar");
  }

  C.Editor = {
    iniciar(nodo) {
      modal = nodo;
      modal.innerHTML =
        `<div class="modal-caja editor">` +
        `<button class="btn-icono cerrar-editor" aria-label="Cerrar">${IC.cerrar}</button>` +
        `<div class="editor-izq"><h2>Vestidor</h2><div class="editor-pjs"></div><div class="editor-vista"></div></div>` +
        `<div class="editor-der"><div class="pestanas"></div><div class="opciones"></div>` +
        `<button class="btn-grande listo">Listo</button></div></div>`;
      modal.addEventListener("click", onClick);
      modal.addEventListener("pointerdown", (e) => { if (e.target === modal) cerrar(); });
    },
    abrir,
    cerrar,
  };
})(window.Casita);
