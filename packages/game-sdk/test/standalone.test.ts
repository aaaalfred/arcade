import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createArcade } from "../src/index";
import { memoryStorage } from "./helpers";

function topWin() {
  const w: any = { location: { origin: "http://localhost:5174" }, addEventListener() {}, removeEventListener() {} };
  w.parent = w; // sin shell
  return w;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SDK en modo standalone", () => {
  it("ready() devuelve Session standalone sin estado la primera vez", async () => {
    const a = createArcade({ win: topWin(), gameId: "flechas", storage: memoryStorage() });
    const s = await a.ready();
    expect(s).toMatchObject({ mode: "standalone", player: null, state: null, sdk: 1 });
    expect(s.settings).toMatchObject({ sound: true, haptics: true });
  });

  it("save → ready() devuelve el estado guardado (misma storage)", async () => {
    const storage = memoryStorage();
    const a = createArcade({ win: topWin(), gameId: "flechas", storage });
    a.save({ stars: { 0: 3 } }, { progress: { value: 1, total: 10 } });
    const b = createArcade({ win: topWin(), gameId: "flechas", storage });
    expect((await b.ready()).state).toEqual({ stars: { 0: 3 } });
  });

  it("aísla el estado por juego", async () => {
    const storage = memoryStorage();
    createArcade({ win: topWin(), gameId: "flechas", storage }).save({ a: 1 });
    const other = createArcade({ win: topWin(), gameId: "laberinto", storage });
    expect((await other.ready()).state).toBeNull();
  });

  it("sin storage disponible no lanza", async () => {
    const a = createArcade({ win: topWin(), gameId: "flechas", storage: null });
    expect(() => a.save({ a: 1 })).not.toThrow();
    expect((await a.ready()).state).toBeNull();
  });

  it("storage que lanza al escribir no rompe el juego", async () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new Error("QuotaExceeded"); };
    const a = createArcade({ win: topWin(), gameId: "flechas", storage });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => a.save({ a: 1 })).not.toThrow();
  });

  it("estado corrupto en storage ⇒ state null", async () => {
    const storage = memoryStorage();
    storage.setItem("arcade:standalone:flechas:state", "{no es json");
    const a = createArcade({ win: topWin(), gameId: "flechas", storage });
    expect((await a.ready()).state).toBeNull();
  });

  it("submitScore guarda el mejor local con orden desc por defecto", async () => {
    const a = createArcade({ win: topWin(), gameId: "flechas", storage: memoryStorage(), fetchJson: async () => { throw new Error("no manifest"); } });
    expect(await a.submitScore("stars", 5)).toMatchObject({ accepted: true, best: 5, offline: true });
    expect(await a.submitScore("stars", 3)).toMatchObject({ accepted: false, best: 5 });
    expect(await a.submitScore("stars", 9)).toMatchObject({ accepted: true, best: 9 });
  });

  it("submitScore respeta sort asc leyendo manifest.json", async () => {
    const a = createArcade({
      win: topWin(), gameId: "flechas", storage: memoryStorage(),
      fetchJson: async () => ({ boards: [{ id: "fastest", sort: "asc" }] }),
    });
    expect(await a.submitScore("fastest", 40)).toMatchObject({ accepted: true, best: 40 });
    expect(await a.submitScore("fastest", 55)).toMatchObject({ accepted: false, best: 40 });
    expect(await a.submitScore("fastest", 30)).toMatchObject({ accepted: true, best: 30 });
  });

  it("anuncios simulados resuelven: rewarded=true", async () => {
    const a = createArcade({ win: topWin(), gameId: "flechas", storage: memoryStorage() });
    vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(a.ads.interstitial()).resolves.toBeUndefined();
    await expect(a.ads.rewarded()).resolves.toBe(true);
  });

  it("haptic usa vibrate si existe y no falla si no", () => {
    const vibrate = vi.fn(() => true);
    const a = createArcade({ win: topWin(), gameId: "flechas", storage: memoryStorage(), vibrate });
    a.haptic("error");
    expect(vibrate).toHaveBeenCalledTimes(1);
    const b = createArcade({ win: topWin(), gameId: "flechas", storage: memoryStorage() });
    expect(() => b.haptic("light")).not.toThrow();
  });

  it("exit y openLeaderboard no lanzan", () => {
    const a = createArcade({ win: topWin(), gameId: "flechas", storage: memoryStorage() });
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(() => { a.exit(); a.openLeaderboard("stars"); }).not.toThrow();
  });
});
