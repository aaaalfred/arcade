import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createHarness, register, type Harness, type Player } from "./helpers";

describe("POST /v1/reports", () => {
  let h: Harness;
  let a: Player;
  let b: Player;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());
  beforeEach(async () => {
    await h.reset();
    a = await register(h);
    b = await register(h);
  });

  const report = (token: string, body: unknown) => call(h, "POST", "/v1/reports", { token, body });

  it("registra el reporte con el apodo del reportado en ese momento", async () => {
    const r = await report(a.token, { targetPlayerId: b.id, reason: "Apodo ofensivo" });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
    const rows = await h.db.query("SELECT reporter_id, target_id, target_nickname, reason FROM reports");
    expect(rows).toEqual([{ reporter_id: a.id, target_id: b.id, target_nickname: b.nickname, reason: "Apodo ofensivo" }]);
  });

  it("no puede reportarse a sí mismo", async () => {
    const r = await report(a.token, { targetPlayerId: a.id, reason: "x" });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_report");
    expect(await h.db.query("SELECT 1 FROM reports")).toHaveLength(0);
  });

  it("jugador inexistente ⇒ 404 player_not_found", async () => {
    const r = await report(a.token, { targetPlayerId: "no-existe", reason: "x" });
    expect(r.status).toBe(404);
    expect(r.json.error).toBe("player_not_found");
  });

  it("un reporte por objetivo y reportante: el duplicado devuelve 200 y no crea otra fila", async () => {
    expect((await report(a.token, { targetPlayerId: b.id, reason: "primero" })).status).toBe(200);
    const dup = await report(a.token, { targetPlayerId: b.id, reason: "segundo" });
    expect(dup.status).toBe(200);
    expect(dup.json).toEqual({ ok: true });
    expect(await h.db.query("SELECT reason FROM reports")).toEqual([{ reason: "primero" }]);
  });

  it("dos reportantes distintos sobre el mismo objetivo cuentan por separado", async () => {
    await report(a.token, { targetPlayerId: b.id, reason: "x" });
    const c = await register(h);
    await report(c.token, { targetPlayerId: b.id, reason: "y" });
    expect(await h.db.query("SELECT 1 FROM reports")).toHaveLength(2);
  });

  it("valida el cuerpo: motivo ≤ 200, campos presentes", async () => {
    expect((await report(a.token, { targetPlayerId: b.id, reason: "x".repeat(200) })).status).toBe(200);
    for (const body of [{ targetPlayerId: b.id, reason: "x".repeat(201) }, { targetPlayerId: b.id }, { reason: "x" }, { targetPlayerId: "", reason: "x" }, { targetPlayerId: 5, reason: "x" }]) {
      const r = await report(a.token, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.error).toBe("invalid_body");
    }
  });

  it("exige credenciales", async () => {
    expect((await call(h, "POST", "/v1/reports", { body: { targetPlayerId: b.id, reason: "x" } })).status).toBe(401);
  });
});
