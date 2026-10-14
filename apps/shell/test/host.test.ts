import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, Manifest } from "@arcade/protocol";
import { attachGameHost } from "../src/bridge/host";
import { createStore } from "../src/services/store";
import { fakeNative } from "./helpers";

const stars: Board = { id: "stars", name: "Estrellas", sort: "desc", min: 0, max: 30, integer: true };
const manifest = { id: "flechas", name: "Flechas", ads: { interstitial: true, rewarded: true }, boards: [stars], orientation: "portrait" } as unknown as Manifest;

function setup(over: { sync?: any; ads?: any; settings?: any } = {}) {
  const gameWin = { postMessage: vi.fn() };
  const iframe = { contentWindow: gameWin } as unknown as HTMLIFrameElement;
  const store = createStore();
  store.player.value = { id: "p1", nickname: "Ana" };
  const sync = {
    pull: vi.fn(async () => undefined),
    loadLocal: vi.fn(async () => ({ state: { lvl: 2 }, rev: 3, progress: { value: 2, total: 10 } })),
    saveLocal: vi.fn(async () => undefined),
    recordScore: vi.fn(async (_g: string, _b: Board, v: number) => ({ accepted: true, best: v, rank: { all: 1, weekly: 1 }, offline: false })),
    ...over.sync,
  };
  const ads = { init: vi.fn(), interstitial: vi.fn(async () => undefined), rewarded: vi.fn(async () => true), ...over.ads };
  const native = fakeNative();
  const onExit = vi.fn();
  const onLeaderboard = vi.fn();
  const settings = over.settings ?? { sound: true, haptics: true, locale: "es" };
  const handle = attachGameHost({
    iframe, manifest, sync, ads, native, store, settings: () => settings, onExit, onLeaderboard, origin: "https://localhost",
  } as any);
  const send = (data: unknown, o: { source?: unknown; origin?: string } = {}) =>
    window.dispatchEvent(new MessageEvent("message", { data, source: ("source" in o ? o.source : gameWin) as any, origin: o.origin ?? "https://localhost" }));
  const sent = () => gameWin.postMessage.mock.calls.map((c) => c[0]);
  const flush = () => vi.advanceTimersByTimeAsync(0);
  return { gameWin, store, sync, ads, native, onExit, onLeaderboard, handle, send, sent, flush };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("host del puente", () => {
  it("hello: hace pull, carga lo local y responde la Session", async () => {
    const s = setup();
    s.send({ arcade: 1, id: "a1", type: "hello" });
    await s.flush();
    expect(s.sync.pull).toHaveBeenCalledWith(1500);
    expect(s.sent()[0]).toMatchObject({
      arcade: 1, replyTo: "a1", ok: true,
      payload: { player: { id: "p1", nickname: "Ana" }, state: { lvl: 2 }, mode: "host", sdk: 1, settings: { sound: true, haptics: true, locale: "es" } },
    });
    expect(s.sent()[0].payload.insets).toBeDefined();
  });

  it("save: guarda local con progreso; si falla no se propaga", async () => {
    const s = setup();
    s.send({ arcade: 1, type: "save", payload: { state: { a: 1 }, progress: { value: 3, total: 10 } } });
    await s.flush();
    expect(s.sync.saveLocal).toHaveBeenCalledWith("flechas", { a: 1 }, { value: 3, total: 10 });
    s.sync.saveLocal.mockRejectedValueOnce(new Error("El estado supera 64 KB"));
    s.send({ arcade: 1, type: "save", payload: { state: { a: 2 } } });
    await s.flush();
    expect(console.warn).toHaveBeenCalled();
  });

  it("score: usa el tablero del manifiesto y responde el resultado", async () => {
    const s = setup();
    s.send({ arcade: 1, id: "s1", type: "score", payload: { board: "stars", value: 12 } });
    await s.flush();
    expect(s.sync.recordScore).toHaveBeenCalledWith("flechas", stars, 12, undefined);
    expect(s.sent()[0]).toMatchObject({ replyTo: "s1", ok: true, payload: { accepted: true, best: 12 } });
  });

  it("score de tablero inexistente ⇒ ok:false", async () => {
    const s = setup();
    s.send({ arcade: 1, id: "s2", type: "score", payload: { board: "nope", value: 1 } });
    await s.flush();
    expect(s.sync.recordScore).not.toHaveBeenCalled();
    expect(s.sent()[0]).toMatchObject({ replyTo: "s2", ok: false });
  });

  it("haptic respeta el ajuste del jugador", async () => {
    const on = setup();
    on.send({ arcade: 1, type: "haptic", payload: { kind: "success" } });
    expect(on.native.haptic).toHaveBeenCalledWith("success");
    const off = setup({ settings: { sound: true, haptics: false, locale: "es" } });
    off.send({ arcade: 1, type: "haptic", payload: { kind: "success" } });
    expect(off.native.haptic).not.toHaveBeenCalled();
  });

  it("exit y leaderboard.open llaman a los callbacks", async () => {
    const s = setup();
    s.send({ arcade: 1, type: "leaderboard.open", payload: { board: "stars" } });
    s.send({ arcade: 1, type: "exit" });
    expect(s.onLeaderboard).toHaveBeenCalledWith("stars");
    expect(s.onExit).toHaveBeenCalledTimes(1);
  });

  it("anuncios: pausa antes, reanuda después (aun si falla) y responde", async () => {
    const s = setup();
    s.send({ arcade: 1, id: "r1", type: "ad.rewarded" });
    await s.flush();
    expect(s.sent().map((m) => m.type ?? `reply:${m.replyTo}`)).toEqual(["pause", "resume", "reply:r1"]);
    expect(s.sent().at(-1)).toMatchObject({ ok: true, payload: true });

    const f = setup({ ads: { interstitial: vi.fn(async () => { throw new Error("boom"); }) } });
    f.send({ arcade: 1, id: "i1", type: "ad.interstitial" });
    await f.flush();
    expect(f.sent().map((m) => m.type ?? `reply:${m.replyTo}`)).toEqual(["pause", "resume", "reply:i1"]);
    expect(f.sent().at(-1)).toMatchObject({ ok: false });
  });

  it("pausas anidadas: reanuda solo cuando se liberan todas", async () => {
    let release!: () => void;
    const s = setup({ ads: { rewarded: vi.fn(() => new Promise<boolean>((r) => (release = () => r(true)))) } });
    s.handle.pause();
    s.send({ arcade: 1, id: "r1", type: "ad.rewarded" });
    await s.flush();
    expect(s.sent().filter((m) => m.type === "pause")).toHaveLength(1);
    release();
    await s.flush();
    expect(s.sent().filter((m) => m.type === "resume")).toHaveLength(0);
    s.handle.resume();
    expect(s.sent().filter((m) => m.type === "resume")).toHaveLength(1);
  });

  it("segundo plano pausa y vuelta reanuda", async () => {
    const s = setup();
    s.native.emitBackground(true);
    s.native.emitBackground(false);
    expect(s.sent().map((m) => m.type)).toEqual(["pause", "resume"]);
  });

  it("notifySettings envía el evento settings", async () => {
    const s = setup();
    s.handle.notifySettings();
    expect(s.sent()[0]).toEqual({ arcade: 1, type: "settings", payload: { sound: true, haptics: true, locale: "es" } });
  });

  describe("mensajes que se descartan", () => {
    it.each([
      ["otra ventana", { source: {} }],
      ["otro origen", { origin: "https://evil.example" }],
    ])("%s", async (_n, o) => {
      const s = setup();
      s.send({ arcade: 1, id: "x", type: "hello" }, o);
      await s.flush();
      expect(s.sent()).toEqual([]);
      expect(s.sync.loadLocal).not.toHaveBeenCalled();
    });

    it.each([
      ["null", null],
      ["cadena", "hola"],
      ["tipo desconocido", { arcade: 1, type: "rm-rf" }],
      ["versión de puente 2", { arcade: 2, type: "hello", id: "x" }],
      ["score con valor cadena", { arcade: 1, type: "score", payload: { board: "stars", value: "12" } }],
    ])("mensaje inválido (%s) no rompe el host", async (_n, data) => {
      const s = setup();
      s.send(data);
      await s.flush();
      expect(s.sync.saveLocal).not.toHaveBeenCalled();
      s.send({ arcade: 1, id: "ok", type: "hello" });
      await s.flush();
      expect(s.sent().at(-1)).toMatchObject({ replyTo: "ok", ok: true });
    });

    it("petición inválida con id recibe ok:false (el SDK no espera al timeout)", async () => {
      const s = setup();
      s.send({ arcade: 1, id: "bad1", type: "score", payload: { board: "stars", value: "12" } });
      await s.flush();
      expect(s.sent()[0]).toMatchObject({ replyTo: "bad1", ok: false });
    });
  });

  it("dispose: deja de responder y de escuchar segundo plano", async () => {
    const s = setup();
    s.handle.dispose();
    s.send({ arcade: 1, id: "x", type: "hello" });
    s.native.emitBackground(true);
    await s.flush();
    expect(s.sent()).toEqual([]);
  });

  it("un anuncio que termina después de dispose no envía nada", async () => {
    let release!: () => void;
    const s = setup({ ads: { interstitial: vi.fn(() => new Promise<void>((r) => (release = r))) } });
    s.send({ arcade: 1, id: "i", type: "ad.interstitial" });
    await s.flush();
    s.handle.dispose();
    release();
    await s.flush();
    expect(s.sent().filter((m) => m.replyTo)).toEqual([]);
  });
});
