import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board, SaveRecord } from "@arcade/protocol";
import { ApiError } from "../src/services/api";
import { createAuth } from "../src/services/auth";
import { createStore } from "../src/services/store";
import { createSyncEngine } from "../src/services/sync";
import { fakeApi, memoryKV } from "./helpers";

const stars: Board = { id: "stars", name: "Estrellas", sort: "desc", min: 0, max: 30, integer: true };
const fastest: Board = { id: "fastest", name: "Tiempo", sort: "asc", min: 1, max: 600, integer: true };

function setup(over: Parameters<typeof fakeApi>[0] = {}) {
  const kv = memoryKV();
  const api = fakeApi(over);
  const store = createStore();
  const auth = createAuth({ api, kv, store });
  const sync = createSyncEngine({ kv, api, store, auth });
  return { kv, api, store, auth, sync };
}
const net = () => new ApiError(0, "network");
const serverSave = (over: Partial<SaveRecord> = {}): SaveRecord => ({
  gameId: "flechas", rev: 5, state: { from: "server" }, progress: { value: 7, total: 10 }, updatedAt: "2026-10-14T00:00:00Z", ...over,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("guardados", () => {
  it("loadLocal sin datos devuelve vacío", async () => {
    const { sync } = setup();
    expect(await sync.loadLocal("flechas")).toEqual({ state: null, rev: 0, progress: null });
  });

  it("saveLocal ×5 se coalesce: una sola subida con el último estado", async () => {
    const { sync, api } = setup();
    for (let i = 1; i <= 5; i++) await sync.saveLocal("flechas", { n: i }, { value: i, total: 10 });
    await sync.flush();
    expect(api.putSave).toHaveBeenCalledTimes(1);
    expect(api.putSave).toHaveBeenCalledWith("flechas", { state: { n: 5 }, progress: { value: 5, total: 10 }, baseRev: 0 });
  });

  it("tras subir, el siguiente guardado usa el rev del servidor como baseRev", async () => {
    const { sync, api } = setup();
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await sync.flush();
    await sync.saveLocal("flechas", { n: 2 }, { value: 2 });
    await sync.flush();
    expect(api.putSave.mock.calls[1]![1].baseRev).toBe(1);
  });

  it("sin progreso explícito usa value 0", async () => {
    const { sync, api } = setup();
    await sync.saveLocal("flechas", { n: 1 });
    await sync.flush();
    expect(api.putSave.mock.calls[0]![1].progress).toEqual({ value: 0 });
  });

  it("offline conserva el guardado y lo sube cuando vuelve la red", async () => {
    let offline = true;
    const { sync, api, kv } = setup({
      putSave: vi.fn(async (_g: string, b: any) => {
        if (offline) throw net();
        return { rev: b.baseRev + 1, resolution: "updated", save: {} };
      }),
    });
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await sync.flush();
    expect(JSON.parse((await kv.get("save:flechas"))!).dirty).toBe(true);
    offline = false;
    await sync.flush();
    expect(JSON.parse((await kv.get("save:flechas"))!)).toMatchObject({ dirty: false, rev: 1 });
    expect(api.putSave).toHaveBeenCalledTimes(2);
  });

  it("409 adopta el guardado del servidor", async () => {
    const { sync, store } = setup({
      putSave: vi.fn(async () => { throw new ApiError(409, "stale_save", "x", { error: "stale_save", resolution: "server-wins", save: serverSave() }); }),
    });
    await sync.saveLocal("flechas", { from: "local" }, { value: 2, total: 10 });
    await sync.flush();
    expect(await sync.loadLocal("flechas")).toEqual({ state: { from: "server" }, rev: 5, progress: { value: 7, total: 10 } });
    expect(store.progress.value.flechas).toEqual({ value: 7, total: 10 });
  });

  it("401 vuelve a registrar una vez y reintenta con todo sucio y rev 0", async () => {
    let first = true;
    const { sync, api } = setup({
      putSave: vi.fn(async (_g: string, b: any) => {
        if (first) { first = false; throw new ApiError(401, "unauthorized"); }
        return { rev: 1, resolution: "created", save: {} };
      }),
    });
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await sync.flush();
    expect(api.clearCredentials).toHaveBeenCalledTimes(1);
    expect(api.auth).toHaveBeenCalledTimes(2);
    expect(api.putSave).toHaveBeenCalledTimes(2);
    expect(api.putSave.mock.calls[1]![1].baseRev).toBe(0);
  });

  it("si la cuenta no se puede crear (sin red) no pierde nada", async () => {
    const { sync, kv } = setup({ auth: vi.fn(async () => { throw net(); }) });
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await expect(sync.flush()).resolves.toBeUndefined();
    expect(JSON.parse((await kv.get("save:flechas"))!)).toMatchObject({ dirty: true, state: { n: 1 } });
  });

  it("rechaza estados de más de 64 KB", async () => {
    const { sync } = setup();
    await expect(sync.saveLocal("flechas", { big: "x".repeat(65 * 1024) })).rejects.toThrow(/64 KB/);
  });

  it("un guardado hecho durante la subida no se marca como limpio", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { sync, kv } = setup({
      putSave: vi.fn(async (_g: string, b: any) => { await gate; return { rev: b.baseRev + 1, resolution: "updated", save: {} }; }),
    });
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    const flushing = sync.flush();
    await vi.advanceTimersByTimeAsync(0);
    await sync.saveLocal("flechas", { n: 2 }, { value: 2 });
    release();
    await flushing;
    const rec = JSON.parse((await kv.get("save:flechas"))!);
    expect(rec).toMatchObject({ state: { n: 2 }, dirty: true, rev: 1 });
  });
});

describe("pull", () => {
  it("adopta guardados del servidor más nuevos si lo local está limpio", async () => {
    const { sync, store } = setup({ getSaves: vi.fn(async () => [serverSave()]) });
    await sync.pull(1500);
    expect(await sync.loadLocal("flechas")).toMatchObject({ state: { from: "server" }, rev: 5 });
    expect(store.progress.value.flechas).toEqual({ value: 7, total: 10 });
  });

  it("no pisa lo local sucio", async () => {
    const { sync } = setup({ getSaves: vi.fn(async () => [serverSave()]) });
    await sync.saveLocal("flechas", { from: "local" }, { value: 3 });
    await sync.pull(1500);
    expect((await sync.loadLocal("flechas")).state).toEqual({ from: "local" });
  });

  it("no lanza sin red", async () => {
    const { sync } = setup({ getSaves: vi.fn(async () => { throw net(); }) });
    await expect(sync.pull(1500)).resolves.toBeUndefined();
  });

  it("respeta el tope de tiempo", async () => {
    const { sync } = setup({ getSaves: vi.fn(() => new Promise(() => {})) });
    let done = false;
    void sync.pull(1500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
  });
});

describe("puntajes", () => {
  it("online devuelve el resultado del servidor y cachea el ranking", async () => {
    const { sync, store, api } = setup({
      postScore: vi.fn(async () => ({ accepted: true, best: 12, rank: { all: 3, weekly: 1 }, offline: false })),
    });
    const r = await sync.recordScore("flechas", stars, 12);
    expect(r).toEqual({ accepted: true, best: 12, rank: { all: 3, weekly: 1 }, offline: false });
    expect(store.bests.value["flechas:stars"]).toBe(12);
    expect(store.ranks.value["flechas:stars"]).toEqual({ all: 3, weekly: 1 });
    expect(api.postScore).toHaveBeenCalledWith("flechas", { board: "stars", value: 12 });
  });

  it("offline responde offline:true y conserva el mejor", async () => {
    const { sync, api } = setup({ postScore: vi.fn(async () => { throw net(); }) });
    const a = await sync.recordScore("flechas", stars, 3);
    expect(a).toMatchObject({ accepted: true, best: 3, offline: true, rank: { all: null, weekly: null } });
    await sync.recordScore("flechas", stars, 7);
    await sync.recordScore("flechas", stars, 5);
    api.postScore.mockClear();
    api.postScore.mockImplementation(async (_g: string, b: any) => ({ accepted: true, best: b.value, rank: { all: 1, weekly: 1 }, offline: false }));
    await sync.flush();
    expect(api.postScore).toHaveBeenCalledTimes(1);
    expect(api.postScore).toHaveBeenCalledWith("flechas", { board: "stars", value: 7 });
  });

  it("tablero asc conserva el menor", async () => {
    const { sync, store } = setup({ postScore: vi.fn(async () => { throw net(); }) });
    await sync.recordScore("flechas", fastest, 40);
    await sync.recordScore("flechas", fastest, 55);
    await sync.recordScore("flechas", fastest, 30);
    expect(store.bests.value["flechas:fastest"]).toBe(30);
  });

  it("un puntaje que no mejora no llama a la API", async () => {
    const { sync, api } = setup();
    await sync.recordScore("flechas", stars, 10);
    api.postScore.mockClear();
    const r = await sync.recordScore("flechas", stars, 4);
    expect(r).toMatchObject({ accepted: false, best: 10 });
    expect(api.postScore).not.toHaveBeenCalled();
  });

  it("si el servidor rechaza el valor (400) deja de reintentarlo", async () => {
    const { sync, api } = setup({ postScore: vi.fn(async () => { throw new ApiError(400, "invalid_score"); }) });
    const r = await sync.recordScore("flechas", stars, 99);
    expect(r.accepted).toBe(false);
    await sync.flush();
    await sync.flush();
    expect(api.postScore).toHaveBeenCalledTimes(1);
  });

  it("no envía valores no finitos", async () => {
    const { sync, api } = setup();
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect((await sync.recordScore("flechas", stars, bad)).accepted).toBe(false);
    }
    expect(api.postScore).not.toHaveBeenCalled();
  });

  it("normaliza -0 a 0", async () => {
    const { sync, api } = setup();
    await sync.recordScore("flechas", stars, -0);
    expect(Object.is(api.postScore.mock.calls[0]![1].value, -0)).toBe(false);
  });
});

describe("reintentos y ciclo de vida", () => {
  it("flush fallido reintenta con backoff 2 s, 4 s", async () => {
    const { sync, api } = setup({ putSave: vi.fn(async () => { throw net(); }) });
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await sync.flush();
    expect(api.putSave).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(api.putSave).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2);
    expect(api.putSave).toHaveBeenCalledTimes(2);
    // el 2.º intento ocurrió en t=2000; el siguiente vence a los 4000 ms ⇒ t=6000
    await vi.advanceTimersByTimeAsync(3998); // t=5999
    expect(api.putSave).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2); // t=6001
    expect(api.putSave).toHaveBeenCalledTimes(3);
  });

  it("saveLocal programa una subida con debounce de 2 s", async () => {
    const { sync, api } = setup();
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await sync.saveLocal("flechas", { n: 2 }, { value: 2 });
    expect(api.putSave).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2100);
    expect(api.putSave).toHaveBeenCalledTimes(1);
    expect(api.putSave.mock.calls[0]![1].state).toEqual({ n: 2 });
  });

  it("start(): el evento online dispara un flush", async () => {
    const { sync, api } = setup({ putSave: vi.fn(async () => { throw net(); }) });
    const stop = sync.start();
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await sync.flush();
    api.putSave.mockClear();
    api.putSave.mockImplementation(async () => ({ rev: 1, resolution: "created", save: {} }));
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.putSave).toHaveBeenCalledTimes(1);
    stop();
  });

  it("init() hidrata la store con progreso y mejores locales", async () => {
    const { sync, store, kv } = setup();
    await sync.saveLocal("flechas", { n: 1 }, { value: 4, total: 10 });
    await sync.recordScore("flechas", stars, 9);
    const fresh = createStore();
    const sync2 = createSyncEngine({ kv, api: fakeApi(), store: fresh, auth: createAuth({ api: fakeApi(), kv, store: fresh }) });
    await sync2.init();
    expect(fresh.progress.value.flechas).toEqual({ value: 4, total: 10 });
    expect(fresh.bests.value["flechas:stars"]).toBe(9);
    void store;
  });

  it("wipe() elimina todo lo local y reinicia la store", async () => {
    const { sync, kv, store } = setup();
    await sync.saveLocal("flechas", { n: 1 }, { value: 1 });
    await sync.recordScore("flechas", stars, 5);
    await kv.set("settings", "{}");
    await sync.wipe();
    expect(kv.dump()).toEqual({});
    expect(store.progress.value).toEqual({});
    expect(store.bests.value).toEqual({});
    expect(store.player.value).toBeNull();
  });
});
