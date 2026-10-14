import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashSecret } from "../src/auth";
import { call, createHarness, register, type Harness } from "./helpers";

describe("hashSecret", () => {
  it("es SHA-256 en hexadecimal", () => {
    expect(hashSecret("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("POST /v1/auth/anonymous y GET /v1/me", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it("crea un jugador: playerId, secreto ≥ 32 caracteres y apodo Jugador####", async () => {
    const r = await call(h, "POST", "/v1/auth/anonymous", { ip: "1.1.1.1" });
    expect(r.status).toBe(201);
    expect(Object.keys(r.json).sort()).toEqual(["nickname", "playerId", "secret"]);
    expect(r.json.playerId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(r.json.secret.length).toBeGreaterThanOrEqual(32);
    expect(r.json.secret).toMatch(/^[A-Za-z0-9_-]+$/); // sin '.', que separa id y secreto
    expect(r.json.nickname).toMatch(/^Jugador\d{4,}$/);
  });

  it("el secreto NO se guarda en claro: solo su SHA-256", async () => {
    const r = await call(h, "POST", "/v1/auth/anonymous", { ip: "1.1.1.2" });
    const rows = await h.db.query<{ token_hash: string; nickname: string; nickname_ci: string }>(
      "SELECT token_hash, nickname, nickname_ci FROM players WHERE id = $1",
      [r.json.playerId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).toBe(hashSecret(r.json.secret));
    expect(rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.token_hash).not.toContain(r.json.secret);
    expect(rows[0]!.nickname_ci).toBe(r.json.nickname.toLowerCase());
    const todo = JSON.stringify(await h.db.query("SELECT * FROM players"));
    expect(todo).not.toContain(r.json.secret);
  });

  it("dos registros dan ids, secretos y apodos distintos", async () => {
    const a = await register(h);
    const b = await register(h);
    expect(a.id).not.toBe(b.id);
    expect(a.secret).not.toBe(b.secret);
    expect(a.nickname).not.toBe(b.nickname);
  });

  it("si el apodo generado ya existe, reintenta y acaba ampliando los dígitos", async () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.1234); // siempre «Jugador1234»
    try {
      const a = await register(h);
      const b = await register(h);
      expect(a.nickname).toBe("Jugador1234");
      expect(b.nickname).toBe("Jugador12340000");
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /me con credenciales correctas", async () => {
    const p = await register(h);
    const r = await call(h, "GET", "/v1/me", { token: p.token });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ id: p.id, nickname: p.nickname });
  });

  it("GET /me rechaza secreto erróneo, sin cabecera y formatos raros con 401 unauthorized", async () => {
    const p = await register(h);
    const casos: Array<Record<string, string>> = [
      { authorization: `Bearer ${p.id}.${p.secret}x` },
      { authorization: `Bearer ${p.id}.${p.secret.slice(1)}` },
      { authorization: `Bearer ${p.id}.` },
      { authorization: `Bearer ${p.id}` },
      { authorization: `Bearer ${p.secret}` },
      { authorization: `Bearer nadie.${p.secret}` },
      { authorization: `Basic ${p.id}.${p.secret}` },
      { authorization: `bearer ${p.id}.${p.secret}x` },
      { authorization: "Bearer" },
      { authorization: "" },
      {},
    ];
    for (const headers of casos) {
      const r = await call(h, "GET", "/v1/me", { headers });
      expect(r.status, JSON.stringify(headers)).toBe(401);
      expect(r.json.error).toBe("unauthorized");
      expect(typeof r.json.message).toBe("string");
    }
  });

  it("el esquema Bearer no distingue mayúsculas (RFC 7235)", async () => {
    const p = await register(h);
    const r = await call(h, "GET", "/v1/me", { headers: { authorization: `bearer ${p.token}` } });
    expect(r.status).toBe(200);
  });

  it("actualiza last_seen_at como máximo una vez por minuto", async () => {
    const p = await register(h);
    const seen = async () =>
      (await h.db.query<{ t: string }>("SELECT last_seen_at::text AS t FROM players WHERE id = $1", [p.id]))[0]!.t;
    const t0 = await seen();
    h.clock.advance(30_000);
    await call(h, "GET", "/v1/me", { token: p.token });
    expect(await seen()).toBe(t0);
    h.clock.advance(31_000); // 61 s desde el registro
    await call(h, "GET", "/v1/me", { token: p.token });
    const t1 = await seen();
    expect(t1).not.toBe(t0);
    h.clock.advance(10_000);
    await call(h, "GET", "/v1/me", { token: p.token });
    expect(await seen()).toBe(t1);
  });

  it("límite de 10 registros/hora/IP: el 11º da 429 con Retry-After", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await call(h, "POST", "/v1/auth/anonymous", { ip: "9.9.9.9" });
      expect(r.status).toBe(201);
      h.clock.advance(1000);
    }
    const r = await call(h, "POST", "/v1/auth/anonymous", { ip: "9.9.9.9" });
    expect(r.status).toBe(429);
    expect(r.json.error).toBe("rate_limited");
    expect(typeof r.json.message).toBe("string");
    // el primero fue hace 10 s ⇒ caduca en 3590 s
    expect(r.headers.get("retry-after")).toBe("3590");
    // otra IP no se ve afectada
    expect((await call(h, "POST", "/v1/auth/anonymous", { ip: "9.9.9.10" })).status).toBe(201);
    // pasada la hora, vuelve a funcionar
    h.clock.advance(3_600_000);
    expect((await call(h, "POST", "/v1/auth/anonymous", { ip: "9.9.9.9" })).status).toBe(201);
  });

  it("el rechazo por límite no crea jugadores", async () => {
    for (let i = 0; i < 12; i++) await call(h, "POST", "/v1/auth/anonymous", { ip: "7.7.7.7" });
    expect((await h.db.query("SELECT count(*)::int AS n FROM players"))[0]).toEqual({ n: 10 });
  });
});

describe("IP del cliente sin TRUST_PROXY", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ config: { trustProxy: false } });
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it("ignora x-forwarded-for: un cliente no puede esquivar el límite cambiando la cabecera", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await call(h, "POST", "/v1/auth/anonymous", { ip: `5.5.5.${i}` })).status).toBe(201);
    }
    expect((await call(h, "POST", "/v1/auth/anonymous", { ip: "5.5.5.99" })).status).toBe(429);
  });
});

describe("IP del cliente con TRUST_PROXY=1", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ config: { trustProxy: true } });
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  it("usa el primer valor de x-forwarded-for", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await call(h, "POST", "/v1/auth/anonymous", { ip: "8.8.8.8, 10.0.0.1" })).status).toBe(201);
    }
    // misma IP de origen aunque cambie el resto de la cadena
    expect((await call(h, "POST", "/v1/auth/anonymous", { ip: "8.8.8.8, 10.0.0.2" })).status).toBe(429);
    expect((await call(h, "POST", "/v1/auth/anonymous", { ip: "8.8.4.4, 10.0.0.1" })).status).toBe(201);
  });
});
