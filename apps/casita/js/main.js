/* Arranque: pantalla de inicio, botones de la interfaz, guardado y reinicio. */
(function (C) {
  "use strict";
  const D = C.Datos, J = C.Juego, IC = C.Iconos, SND = C.Sonido, G = C.Guardado, PJ = C.Personaje, MU = C.Muebles;
  const $ = (s) => document.querySelector(s);

  let S, habia = false, iniciado = false, avisoGirarVisto = false;

  const guardar = () => G.guardar(S);

  function pintarPortada() {
    $("#portada").innerHTML = MU.portada();
    $("#portada svg").setAttribute("preserveAspectRatio", "xMidYMax slice");
    $("#portada-pjs").innerHTML = Object.values(S.chars)
      .map((c, i) => `<div class="portada-pj p${i}">${PJ.cuerpoSVG(c.look, { expr: "feliz" })}</div>`).join("");
  }

  function onSeleccion(id) {
    const panel = $("#panel-pj");
    if (!id) { panel.hidden = true; return; }
    const c = S.chars[id];
    panel.hidden = false;
    panel.querySelector(".panel-retrato").innerHTML = PJ.retrato(c.look);
    panel.querySelector(".panel-nombre").textContent = c.loc && c.loc.kind === "bed" ? `${c.nombre} duerme` : c.nombre;
    for (const b of panel.querySelectorAll(".cara")) b.classList.toggle("sel", b.dataset.expr === c.expr);
  }

  function ponerIconos() {
    $("#btn-casa").innerHTML = IC.casa;
    $("#btn-editar").innerHTML = IC.editar;
    $("#btn-reiniciar").innerHTML = IC.reiniciar;
    $("#flecha-izq .flecha-ico").innerHTML = IC.izquierda;
    $("#flecha-der .flecha-ico").innerHTML = IC.derecha;
    $(".bandeja-ico").innerHTML = IC.bandeja;
    $(".panel-editar").innerHTML = IC.editar;
    $(".girar-ico").innerHTML = IC.reiniciar;
    for (const b of document.querySelectorAll(".panel-caras .cara")) b.innerHTML = IC[b.dataset.expr];
    pintarSonido();
  }
  function pintarSonido() {
    const b = $("#btn-sonido");
    b.innerHTML = S.silencio ? IC.silencio : IC.sonido;
    b.setAttribute("aria-label", S.silencio ? "Activar sonido" : "Silenciar sonido");
    b.title = S.silencio ? "Activar sonido" : "Silenciar";
  }

  function revisarOrientacion() {
    const vertical = window.innerHeight > window.innerWidth && window.innerWidth < 760;
    $("#aviso-girar").hidden = !(vertical && !avisoGirarVisto && $("#juego").classList.contains("activa"));
  }

  function jugar() {
    SND.desbloquear();
    SND.tocar("feliz");
    $("#inicio").classList.remove("activa");
    $("#juego").classList.add("activa");
    if (!iniciado) {
      iniciado = true;
      J.iniciar(S, {
        juego: $("#juego"), area: $("#area"), esc: $("#escenario"), capaArrastre: $("#arrastre"),
        bandeja: $("#bandeja"), ranuras: $("#bandeja .ranuras"),
        flechaIzq: $("#flecha-izq"), flechaDer: $("#flecha-der"), nombreCuarto: $("#nombre-cuarto"),
        onSeleccion,
      }, guardar);
      mostrarAyuda();
    } else {
      J.ajustar();
    }
    revisarOrientacion();
  }

  function mostrarAyuda() {
    if (habia) return;
    const a = $("#ayuda");
    a.textContent = "Arrastra a los personajes y los objetos. Toca la lámpara, el refrigerador o el ropero.";
    a.hidden = false;
    setTimeout(() => a.classList.add("fuera"), 6500);
    setTimeout(() => { a.hidden = true; }, 7200);
  }

  function arrancar() {
    const r = G.cargar();
    S = r.estado;
    habia = r.habia;
    SND.setSilencio(S.silencio);
    ponerIconos();
    pintarPortada();
    $("#aviso-guardado").hidden = !habia;
    $("#btn-jugar").addEventListener("click", jugar);

    $("#btn-casa").addEventListener("click", () => {
      SND.tocar("toque");
      G.guardar(S, true);
      pintarPortada();
      $("#aviso-guardado").hidden = false;
      $("#juego").classList.remove("activa");
      $("#inicio").classList.add("activa");
      $("#aviso-girar").hidden = true;
    });
    $("#btn-sonido").addEventListener("click", () => {
      S.silencio = !S.silencio;
      SND.setSilencio(S.silencio);
      pintarSonido();
      SND.tocar("toque");
      guardar();
    });
    $("#btn-editar").addEventListener("click", () => C.Editor.abrir());
    $(".panel-editar").addEventListener("click", () => C.Editor.abrir(J.seleccionado()));
    for (const b of document.querySelectorAll(".panel-caras .cara")) b.addEventListener("click", () => J.expresar(b.dataset.expr));

    const conf = $("#modal-confirmar");
    $("#btn-reiniciar").addEventListener("click", () => { SND.tocar("toque"); conf.hidden = false; });
    conf.addEventListener("click", (e) => {
      const a = e.target.closest("[data-accion]");
      if (e.target === conf || (a && a.dataset.accion === "cancelar")) { conf.hidden = true; SND.tocar("soltar"); return; }
      if (a && a.dataset.accion === "reiniciar") {
        conf.hidden = true;
        G.borrar();
        const silencio = S.silencio;
        S = D.estadoInicial();
        S.silencio = silencio;
        J.reconstruir(S);
        G.guardar(S, true);
        SND.tocar("feliz");
      }
    });
    $("#aviso-girar").addEventListener("click", (e) => {
      if (e.target.closest("[data-accion]") || e.target.id === "aviso-girar") { avisoGirarVisto = true; $("#aviso-girar").hidden = true; J.ajustar(); }
    });

    C.Editor.iniciar($("#modal-editor"));
    window.addEventListener("resize", revisarOrientacion);
    window.addEventListener("pagehide", () => G.guardar(S, true));
    document.addEventListener("visibilitychange", () => { if (document.hidden) G.guardar(S, true); });
    // Evita el menú contextual al mantener presionado en táctil
    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  C.estado = () => S;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})(window.Casita);
