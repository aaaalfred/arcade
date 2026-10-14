import { describe, expect, it, vi } from "vitest";
import { createApiClient, ApiError } from "../src/services/api";
import { memoryKV } from "./helpers";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setup(fetchImpl: (url: string, init: RequestInit) => Promise<Response>) {
  const kv = memoryKV();
  const fetch = vi.fn(fetchImpl);
  const api = createApiClient({ baseUrl: "https://api.test", kv, fetch: fetch as any, timeoutMs: 50 });
  return { kv, fetch, api };
}

describe("ApiClient", () => {
  it("auth() guarda credenciales y las usa como Bearer", async () => {
    const { api, kv, fetch } = setup(async (url) => {
      if (url.endsWith("/v1/auth/anonymous")) return json(200, { playerId: "p1", secret: "s3", nickname: "Jugador1" });
      return json(200, { id: "p1", nickname: "Jugador1" });
    });
    await api.auth();
    expect(JSON.parse((await kv.get("creds"))!)).toEqual({ playerId: "p1", secret: "s3" });
    await api.me();
    const init = fetch.mock.calls[1]![1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer p1.s3");
  });

  it("errores HTTP se convierten en ApiError con código y estado", async () => {
    const { api } = setup(async () => json(409, { error: "nickname_taken", message: "en uso" }));
    await expect(api.auth()).rejects.toMatchObject({ name: "ApiError", status: 409, code: "nickname_taken" });
  });

  it("un fallo de red se convierte en ApiError network", async () => {
    const { api } = setup(async () => { throw new TypeError("Failed to fetch"); });
    await expect(api.auth()).rejects.toMatchObject({ code: "network", status: 0 });
  });

  it("timeout ⇒ ApiError network", async () => {
    const { api } = setup((_u, init) => new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("x", "AbortError")))));
    await expect(api.auth()).rejects.toMatchObject({ code: "network" });
  });

  it("respuesta no JSON ⇒ ApiError invalid_response", async () => {
    const { api } = setup(async () => new Response("<html>", { status: 200 }));
    await expect(api.auth()).rejects.toBeInstanceOf(ApiError);
  });

  it("getBoard arma la URL con periodo y límite", async () => {
    const { api, fetch, kv } = setup(async () => json(200, { entries: [], me: null }));
    await kv.set("creds", JSON.stringify({ playerId: "p1", secret: "s" }));
    await api.getBoard("flechas", "stars", "weekly", 20);
    expect(fetch.mock.calls[0]![0]).toBe("https://api.test/v1/games/flechas/boards/stars?period=weekly&limit=20");
  });
});
