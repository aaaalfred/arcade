import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./helpers";

async function preflight(h: Harness, origin: string, method = "PUT", path = "/v1/games/tap-game/save") {
  return h.app.request(path, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": method,
      "access-control-request-headers": "authorization,content-type",
    },
  });
}

describe("CORS (WebViews de Capacitor)", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ config: { corsOrigins: ["https://app.example.com"], production: false } });
  });
  afterAll(() => h.close());

  for (const origin of ["https://localhost", "capacitor://localhost", "http://localhost:5173", "http://localhost", "https://app.example.com"]) {
    it(`preflight desde ${origin}: 204 y cabeceras permitidas`, async () => {
      const res = await preflight(h, origin);
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe(origin);
      const methods = (res.headers.get("access-control-allow-methods") ?? "").split(",").map((m) => m.trim());
      for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) expect(methods).toContain(m);
      const headers = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
      expect(headers).toContain("authorization");
      expect(headers).toContain("content-type");
      expect(res.headers.get("vary") ?? "").toContain("Origin");
    });
  }

  it("el preflight no exige autenticación", async () => {
    expect((await preflight(h, "https://localhost", "GET", "/v1/me")).status).toBe(204);
  });

  it("un origen desconocido no recibe Access-Control-Allow-Origin", async () => {
    for (const origin of ["https://evil.example", "http://localhost.evil.example", "https://localhost.evil.example", "capacitor://evil", "null"]) {
      const res = await preflight(h, origin);
      expect(res.headers.get("access-control-allow-origin"), origin).toBeNull();
    }
  });

  it("las respuestas normales también llevan la cabecera y exponen Retry-After", async () => {
    const res = await h.app.request("/v1/health", { headers: { origin: "capacitor://localhost" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    expect(res.headers.get("access-control-expose-headers") ?? "").toContain("Retry-After");
  });

  it("sin cabecera Origin (curl, servidor a servidor) funciona igual", async () => {
    expect((await h.app.request("/v1/health")).status).toBe(200);
  });
});

describe("CORS en producción", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ config: { production: true } });
  });
  afterAll(() => h.close());

  it("http://localhost:* deja de estar permitido, pero los orígenes de Capacitor siguen", async () => {
    expect((await preflight(h, "http://localhost:5173")).headers.get("access-control-allow-origin")).toBeNull();
    expect((await preflight(h, "https://localhost")).headers.get("access-control-allow-origin")).toBe("https://localhost");
    expect((await preflight(h, "capacitor://localhost")).headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
  });
});
