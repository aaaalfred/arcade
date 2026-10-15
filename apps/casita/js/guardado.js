/* Guardado automático en el dispositivo (localStorage). */
(function (C) {
  "use strict";
  const CLAVE = "casita-pastel-v1";
  let temporizador = null;

  function valido(loc, D) {
    if (!loc || typeof loc !== "object") return false;
    switch (loc.kind) {
      case "floor": return D.CUARTOS.includes(loc.room) && isFinite(loc.x) && isFinite(loc.y);
      case "surface": return !!D.zonaId[loc.zone] && D.zonaId[loc.zone].tipo === "superficie" && isFinite(loc.x);
      case "seat": return !!D.zonaId[loc.zone] && D.zonaId[loc.zone].tipo === "asiento";
      case "bed": return !!D.zonaId[loc.zone] && D.zonaId[loc.zone].tipo === "cama";
      case "hand": return typeof loc.owner === "string" && (loc.hand === "L" || loc.hand === "R");
      case "tray": return Number.isInteger(loc.slot) && loc.slot >= 0 && loc.slot < D.BANDEJA;
      default: return false;
    }
  }

  // Mezcla lo guardado con el estado inicial: si falta o sobra algo (versión anterior), se corrige.
  function sanear(guardado) {
    const D = C.Datos;
    const base = D.estadoInicial();
    if (!guardado || guardado.v !== 1) return base;
    const s = base;
    if (D.CUARTOS.includes(guardado.cuarto)) s.cuarto = guardado.cuarto;
    s.silencio = !!guardado.silencio;
    for (const id of Object.keys(s.chars)) {
      const g = guardado.chars && guardado.chars[id];
      if (!g) continue;
      if (g.look) Object.assign(s.chars[id].look, g.look);
      if (typeof g.expr === "string") s.chars[id].expr = g.expr;
      if (valido(g.loc, D) && g.loc.kind !== "hand") s.chars[id].loc = g.loc;
    }
    for (const id of Object.keys(s.items)) {
      const g = guardado.items && guardado.items[id];
      if (!g) continue;
      const okMano = g.loc && g.loc.kind === "hand" ? !!s.chars[g.loc.owner] : true;
      if (valido(g.loc, D) && okMano) s.items[id].loc = g.loc;
      s.items[id].bocados = Math.max(0, Math.min(2, g.bocados | 0));
    }
    for (const id of Object.keys(s.muebles)) if (guardado.muebles && guardado.muebles[id]) Object.assign(s.muebles[id], guardado.muebles[id]);
    // Nada debe compartir ranura de bandeja, asiento, cama ni mano
    const usados = new Set();
    const revisa = (ent, clave, inicio) => {
      if (!clave) return;
      if (usados.has(clave)) ent.loc = C.U.copia(inicio);
      else usados.add(clave);
    };
    for (const [id, c] of Object.entries(s.chars)) {
      const l = c.loc;
      revisa(c, l.kind === "tray" ? "t" + l.slot : l.kind === "seat" || l.kind === "bed" ? "z" + l.zone : null, D.PERSONAJES_INICIO[id].loc);
    }
    for (const [id, it] of Object.entries(s.items)) {
      const l = it.loc;
      revisa(it, l.kind === "tray" ? "t" + l.slot : l.kind === "hand" ? "h" + l.owner + l.hand : null, D.OBJETOS_INICIO[id]);
    }
    return s;
  }

  C.Guardado = {
    cargar() {
      try {
        const txt = localStorage.getItem(CLAVE);
        return { estado: sanear(txt ? JSON.parse(txt) : null), habia: !!txt };
      } catch (e) {
        return { estado: C.Datos.estadoInicial(), habia: false };
      }
    },
    guardar(estado, inmediato) {
      clearTimeout(temporizador);
      const hacer = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* almacenamiento lleno o bloqueado */ } };
      if (inmediato) hacer(); else temporizador = setTimeout(hacer, 250);
    },
    borrar() { try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } },
  };
})(window.Casita);
