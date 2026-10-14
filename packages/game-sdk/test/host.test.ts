import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SAVE_BYTES } from "@arcade/protocol";
import { createArcade, SDK_MAX_SAVE_BYTES } from "../src/index";
import { makeHostWin, memoryStorage, SESSION } from "./helpers";

function setup() {
  const h = makeHostWin();
  const arcade = createArcade({ win: h.win, gameId: "flechas", storage: memoryStorage() });
  return { ...h, arcade };
}

async function readyHost(s: ReturnType<typeof setup>) {
  const p = s.arcade.ready();
  s.reply(s.last().id, true, SESSION);
  return p;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SDK en modo host", () => {
  it("el límite local de guardado coincide con el del protocolo", () => {
    expect(SDK_MAX_SAVE_BYTES).toBe(MAX_SAVE_BYTES);
  });

  it("ready() envía hello y devuelve la Session del shell", async () => {
    const s = setup();
    const session = await readyHost(s);
    expect(s.sent()[0]).toMatchObject({ arcade: 1, type: "hello" });
    expect(session.mode).toBe("host");
    expect(session.state).toEqual({ level: 3 });
    expect(session.player?.nickname).toBe("Jugador1234");
  });

  it("ready() se cachea: un solo hello", async () => {
    const s = setup();
    const a = s.arcade.ready();
    const b = s.arcade.ready();
    s.reply(s.last().id, true, SESSION);
    await Promise.all([a, b]);
    expect(s.sent().filter((m) => m.type === "hello")).toHaveLength(1);
  });

  it("save envía un único mensaje con datos planos y progreso", async () => {
    const s = setup();
    await readyHost(s);
    s.arcade.save({ a: 1, f: () => 1, u: undefined }, { progress: { value: 4, total: 10 } });
    const msgs = s.sent().filter((m) => m.type === "save");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].payload).toEqual({ state: { a: 1 }, progress: { value: 4, total: 10 } });
  });

  it.each([
    ["undefined", undefined],
    ["función", () => 1],
  ])("save(%s) no lanza y no envía", async (_n, bad) => {
    const s = setup();
    await readyHost(s);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => s.arcade.save(bad)).not.toThrow();
    expect(s.sent().filter((m) => m.type === "save")).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it("save con estado circular no lanza y no envía", async () => {
    const s = setup();
    await readyHost(s);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c: any = {};
    c.self = c;
    expect(() => s.arcade.save(c)).not.toThrow();
    expect(s.sent().filter((m) => m.type === "save")).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it("save con más de 64 KB no se envía", async () => {
    const s = setup();
    await readyHost(s);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    s.arcade.save({ big: "x".repeat(SDK_MAX_SAVE_BYTES + 1) });
    expect(s.sent().filter((m) => m.type === "save")).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it("submitScore resuelve con la respuesta del shell", async () => {
    const s = setup();
    await readyHost(s);
    const p = s.arcade.submitScore("stars", 12, { lvl: 3 });
    const m = s.last();
    expect(m).toMatchObject({ type: "score", payload: { board: "stars", value: 12, meta: { lvl: 3 } } });
    const result = { accepted: true, best: 12, rank: { all: 1, weekly: 1 }, offline: false };
    s.reply(m.id, true, result);
    await expect(p).resolves.toEqual(result);
  });

  it("submitScore sin respuesta resuelve offline:true tras el timeout", async () => {
    const s = setup();
    await readyHost(s);
    const p = s.arcade.submitScore("stars", 7);
    await vi.advanceTimersByTimeAsync(8000);
    await expect(p).resolves.toEqual({ accepted: false, best: 7, rank: { all: null, weekly: null }, offline: true });
  });

  it("submitScore con ok:false resuelve accepted:false sin rechazar", async () => {
    const s = setup();
    await readyHost(s);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = s.arcade.submitScore("nope", 1);
    s.reply(s.last().id, false, undefined, "tablero desconocido");
    await expect(p).resolves.toMatchObject({ accepted: false, offline: false });
  });

  it.each([NaN, Infinity, -Infinity])("submitScore(%s) no se envía", async (bad) => {
    const s = setup();
    await readyHost(s);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await s.arcade.submitScore("stars", bad);
    expect(r.accepted).toBe(false);
    expect(s.sent().filter((m) => m.type === "score")).toHaveLength(0);
  });

  it("ads.rewarded: true con premio, false con ok:false y false por timeout", async () => {
    const s = setup();
    await readyHost(s);
    let p = s.arcade.ads.rewarded();
    s.reply(s.last().id, true, true);
    await expect(p).resolves.toBe(true);

    p = s.arcade.ads.rewarded();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    s.reply(s.last().id, false, undefined, "sin anuncio");
    await expect(p).resolves.toBe(false);

    p = s.arcade.ads.rewarded();
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(p).resolves.toBe(false);
  });

  it("ads.interstitial nunca rechaza (ok:false y timeout resuelven)", async () => {
    const s = setup();
    await readyHost(s);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let p = s.arcade.ads.interstitial();
    s.reply(s.last().id, false, undefined, "x");
    await expect(p).resolves.toBeUndefined();
    p = s.arcade.ads.interstitial();
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(p).resolves.toBeUndefined();
  });

  it("haptic, openLeaderboard y exit envían el mensaje correcto", async () => {
    const s = setup();
    await readyHost(s);
    s.arcade.haptic("success");
    expect(s.last()).toMatchObject({ type: "haptic", payload: { kind: "success" } });
    s.arcade.openLeaderboard("stars");
    expect(s.last()).toMatchObject({ type: "leaderboard.open", payload: { board: "stars" } });
    s.arcade.openLeaderboard();
    expect(s.last()).toMatchObject({ type: "leaderboard.open", payload: {} });
    s.arcade.exit();
    expect(s.last()).toMatchObject({ type: "exit" });
  });

  it("on('pause'|'resume'|'settings') recibe eventos y se puede desuscribir", async () => {
    const s = setup();
    await readyHost(s);
    const pause = vi.fn();
    const settings = vi.fn();
    const off = s.arcade.on("pause", pause);
    s.arcade.on("settings", settings);
    s.deliver({ arcade: 1, type: "pause" });
    expect(pause).toHaveBeenCalledTimes(1);
    s.deliver({ arcade: 1, type: "settings", payload: { sound: false, haptics: true, locale: "es" } });
    expect(settings).toHaveBeenCalledWith({ sound: false, haptics: true, locale: "es" });
    off();
    s.deliver({ arcade: 1, type: "pause" });
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("un listener que lanza no impide a los demás", async () => {
    const s = setup();
    await readyHost(s);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = vi.fn();
    s.arcade.on("pause", () => { throw new Error("boom"); });
    s.arcade.on("pause", ok);
    s.deliver({ arcade: 1, type: "pause" });
    expect(ok).toHaveBeenCalled();
  });

  it("ignora mensajes de otro origen, otra ventana, sin arcade:1 o con replyTo desconocido", async () => {
    const s = setup();
    await readyHost(s);
    const pause = vi.fn();
    s.arcade.on("pause", pause);
    s.deliver({ arcade: 1, type: "pause" }, { origin: "https://evil.example" });
    s.deliver({ arcade: 1, type: "pause" }, { source: {} });
    s.deliver({ type: "pause" });
    s.deliver("pause");
    s.deliver(null);
    s.deliver({ arcade: 1, replyTo: "no-existe", ok: true });
    expect(pause).not.toHaveBeenCalled();
  });

  it("una respuesta falsa de otro origen no resuelve una petición pendiente", async () => {
    const s = setup();
    await readyHost(s);
    const p = s.arcade.submitScore("stars", 5);
    const id = s.last().id;
    s.deliver({ arcade: 1, replyTo: id, ok: true, payload: { accepted: true, best: 999, rank: { all: 1, weekly: 1 }, offline: false } }, { origin: "https://evil.example" });
    await vi.advanceTimersByTimeAsync(8000);
    await expect(p).resolves.toMatchObject({ offline: true, best: 5 });
  });

  it("si el shell no contesta al hello, cae a modo standalone con aviso", async () => {
    const h = makeHostWin();
    const storage = memoryStorage();
    const arcade = createArcade({ win: h.win, gameId: "flechas", storage });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = arcade.ready();
    await vi.advanceTimersByTimeAsync(3000);
    const session = await p;
    expect(session.mode).toBe("standalone");
    expect(warn).toHaveBeenCalled();
    arcade.save({ x: 1 });
    expect(storage.getItem("arcade:standalone:flechas:state")).toBe('{"x":1}');
  });
});
