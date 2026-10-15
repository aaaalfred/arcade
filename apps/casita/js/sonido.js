/* Sonidos suaves sintetizados con Web Audio (no requiere archivos). */
(function (C) {
  "use strict";
  let ctx = null, maestro = null, silencio = false;

  function asegurar() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      maestro = ctx.createGain();
      maestro.gain.value = 0.22;
      maestro.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tono(f1, f2, dur, tipo = "sine", vol = 0.5, retraso = 0) {
    const t = ctx.currentTime + retraso;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f2, 1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(maestro);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function ruido(dur, f1, f2, vol = 0.4, retraso = 0, q = 1.5) {
    const t = ctx.currentTime + retraso;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.Q.value = q;
    filtro.frequency.setValueAtTime(f1, t);
    filtro.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filtro).connect(g).connect(maestro);
    src.start(t);
  }

  const SONIDOS = {
    tomar: () => tono(520, 820, 0.12, "sine", 0.45),
    soltar: () => tono(420, 250, 0.14, "triangle", 0.45),
    invalido: () => { tono(330, 300, 0.12, "triangle", 0.35); tono(260, 230, 0.16, "triangle", 0.35, 0.11); },
    toque: () => tono(700, 900, 0.07, "sine", 0.35),
    boing: () => tono(300, 620, 0.2, "sine", 0.4),
    sentar: () => { tono(380, 300, 0.12, "triangle", 0.4); ruido(0.15, 600, 300, 0.12); },
    comer: () => { for (let i = 0; i < 3; i++) ruido(0.09, 900, 500, 0.35, i * 0.32, 3); },
    beber: () => { for (let i = 0; i < 3; i++) tono(300, 520, 0.1, "sine", 0.3, i * 0.3); },
    puerta: () => { ruido(0.3, 300, 1200, 0.2, 0, 0.8); tono(180, 140, 0.18, "triangle", 0.2, 0.15); },
    lampara: () => { tono(1400, 1300, 0.03, "square", 0.12); tono(900, 880, 0.04, "square", 0.08, 0.04); },
    cuarto: () => ruido(0.35, 400, 1600, 0.15, 0, 0.7),
    feliz: () => { tono(523, 523, 0.12, "sine", 0.3); tono(659, 659, 0.12, "sine", 0.3, 0.1); tono(784, 784, 0.18, "sine", 0.3, 0.2); },
    bandeja: () => tono(600, 400, 0.12, "triangle", 0.35),
    dormir: () => { tono(392, 330, 0.3, "sine", 0.25); tono(330, 262, 0.4, "sine", 0.25, 0.25); },
  };

  C.Sonido = {
    desbloquear() { asegurar(); },
    tocar(nombre) {
      if (silencio || !SONIDOS[nombre]) return;
      if (!asegurar()) return;
      try { SONIDOS[nombre](); } catch (e) { /* sin audio, el juego sigue */ }
    },
    setSilencio(v) { silencio = !!v; },
    get silencio() { return silencio; },
  };
})(window.Casita);
