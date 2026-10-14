import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/services/api";
import { createAuth } from "../src/services/auth";
import { createStore } from "../src/services/store";
import { fakeApi, memoryKV } from "./helpers";

function setup(over: Parameters<typeof fakeApi>[0] = {}) {
  const kv = memoryKV();
  const api = fakeApi(over);
  const store = createStore();
  const auth = createAuth({ api, kv, store });
  return { kv, api, store, auth };
}

describe("auth", () => {
  it("ensure() registra una sola vez aunque se llame en paralelo", async () => {
    const { auth, api, store } = setup();
    const [a, b] = await Promise.all([auth.ensure(), auth.ensure()]);
    expect([a, b]).toEqual([true, true]);
    expect(api.auth).toHaveBeenCalledTimes(1);
    expect(store.player.value).toEqual({ id: "p1", nickname: "Jugador1" });
    expect(await auth.ensure()).toBe(true);
    expect(api.auth).toHaveBeenCalledTimes(1);
  });

  it("sin red ensure() devuelve false y se puede reintentar después", async () => {
    let fail = true;
    const { auth, api } = setup({
      auth: vi.fn(async () => {
        if (fail) throw new ApiError(0, "network");
        return { playerId: "p1", secret: "s", nickname: "Jugador1" };
      }),
    });
    expect(await auth.ensure()).toBe(false);
    fail = false;
    expect(await auth.ensure()).toBe(true);
    expect(api.auth).toHaveBeenCalledTimes(2);
  });

  it("init() carga el jugador en caché", async () => {
    const { auth, kv, store } = setup();
    await kv.set("player", JSON.stringify({ id: "x", nickname: "Ana" }));
    await auth.init();
    expect(store.player.value).toEqual({ id: "x", nickname: "Ana" });
  });

  it("init() ignora una caché corrupta", async () => {
    const { auth, kv, store } = setup();
    await kv.set("player", "{no es json");
    await expect(auth.init()).resolves.toBeUndefined();
    expect(store.player.value).toBeNull();
  });

  it("setNickname actualiza store y caché", async () => {
    const { auth, store, kv } = setup();
    await auth.ensure();
    const p = await auth.setNickname("Ángel");
    expect(p.nickname).toBe("Ángel");
    expect(store.player.value?.nickname).toBe("Ángel");
    expect(JSON.parse((await kv.get("player"))!).nickname).toBe("Ángel");
  });

  it("setNickname propaga errores del servidor (apodo en uso)", async () => {
    const { auth } = setup({ setNickname: vi.fn(async () => { throw new ApiError(409, "nickname_taken"); }) });
    await expect(auth.setNickname("Ana")).rejects.toMatchObject({ code: "nickname_taken" });
  });

  it("reregister crea una cuenta nueva", async () => {
    let n = 0;
    const { auth, api, store } = setup({
      auth: vi.fn(async () => ({ playerId: `p${++n}`, secret: "s", nickname: `J${n}` })),
    });
    await auth.ensure();
    await auth.reregister();
    expect(api.clearCredentials).toHaveBeenCalled();
    expect(store.player.value?.id).toBe("p2");
  });

  it("deleteAccount borra en servidor, credenciales y jugador", async () => {
    const { auth, api, store } = setup();
    await auth.ensure();
    await auth.deleteAccount();
    expect(api.deleteMe).toHaveBeenCalled();
    expect(store.player.value).toBeNull();
    expect(await api.hasCredentials()).toBe(false);
  });

  it("deleteAccount sin red lanza y conserva la cuenta", async () => {
    const { auth, store } = setup({ deleteMe: vi.fn(async () => { throw new ApiError(0, "network"); }) });
    await auth.ensure();
    await expect(auth.deleteAccount()).rejects.toMatchObject({ code: "network" });
    expect(store.player.value).not.toBeNull();
  });

  it("deleteAccount con 401 se considera hecho", async () => {
    const { auth, store } = setup({ deleteMe: vi.fn(async () => { throw new ApiError(401, "unauthorized"); }) });
    await auth.ensure();
    await expect(auth.deleteAccount()).resolves.toBeUndefined();
    expect(store.player.value).toBeNull();
  });
});
