import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { defaultConfig } from "../src/config";
import type { Db } from "../src/db";
import { call, createHarness, makeCatalog, type Harness } from "./helpers";

describe("errores y cabeceras generales", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());

  it("GET /v1/health ⇒ {ok:true} sin autenticación", async () => {
    const r = await call(h, "GET", "/v1/health");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
  });

  it("ruta desconocida ⇒ 404 not_found en JSON", async () => {
    for (const [method, path] of [["GET", "/"], ["GET", "/v1/nada"], ["POST", "/v1/health"], ["GET", "/otra/cosa"]] as const) {
      const r = await call(h, method, path);
      expect(r.status, `${method} ${path}`).toBe(404);
      expect(r.json.error).toBe("not_found");
      expect(typeof r.json.message).toBe("string");
    }
  });

  it("las respuestas no se cachean y no se olfatea el tipo", async () => {
    const r = await call(h, "GET", "/v1/health");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-type")).toContain("application/json");
  });

  it("un error inesperado ⇒ 500 internal sin filtrar el mensaje ni la traza", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const broken: Db = {
        query: async () => {
          throw new Error("SECRETO: la conexión a postgres://user:pass@host falló");
        },
        exec: async () => {},
        tx: async (fn) => fn(broken),
        close: async () => {},
      };
      const app = createApp({ db: broken, catalog: makeCatalog(), config: defaultConfig({ trustProxy: true }) });
      const res = await app.request("/v1/auth/anonymous", { method: "POST", headers: { "x-forwarded-for": "3.3.3.3" } });
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: "internal", message: expect.any(String) });
      expect(text).not.toMatch(/SECRETO|postgres:|stack|\sat\s/);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
