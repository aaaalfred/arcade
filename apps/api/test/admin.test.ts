import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createHarness, register, type Harness, type Player } from "./helpers";

const TOKEN = "t".repeat(32);

describe("administración: con ADMIN_TOKEN", () => {
  let h: Harness;
  let a: Player;
  let b: Player;
  beforeAll(async () => {
    h = await createHarness({ config: { adminToken: TOKEN } });
  });
  afterAll(() => h.close());
  beforeEach(async () => {
    await h.reset();
    a = await register(h);
    b = await register(h);
  });

  const admin = (method: string, path: string, token: string | null = TOKEN) =>
    call(h, method, `/v1/admin${path}`, { headers: token === null ? {} : ({ "x-admin-token": token } as Record<string, string>) });

  it("sin token o con token incorrecto ⇒ 401 unauthorized", async () => {
    for (const t of [null, "", "otra-cosa", TOKEN.slice(1), TOKEN + "x", "t".repeat(32).toUpperCase()]) {
      for (const [method, path] of [["POST", `/players/${b.id}/hide`], ["POST", `/players/${b.id}/unhide`], ["GET", "/reports"]] as const) {
        const r = await admin(method, path, t);
        expect(r.status, `${method} ${path} token=${t}`).toBe(401);
        expect(r.json.error).toBe("unauthorized");
      }
    }
    expect((await h.db.query("SELECT hidden FROM players WHERE id = $1", [b.id]))[0]).toEqual({ hidden: false });
  });

  it("el token de un jugador no sirve como token de administración", async () => {
    const r = await call(h, "GET", "/v1/admin/reports", { token: a.token, headers: { "x-admin-token": a.token } });
    expect(r.status).toBe(401);
    const bearer = await call(h, "GET", "/v1/admin/reports", { token: a.token });
    expect(bearer.status).toBe(401);
  });

  it("oculta y des-oculta a un jugador, y el ranking lo refleja", async () => {
    const put = (p: Player, v: number) => call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, body: { board: "taps", value: v } });
    await put(b, 100);
    await put(a, 10);
    const entries = async () => (await call(h, "GET", "/v1/games/tap-game/boards/taps", { token: a.token })).json.entries.map((e: any) => e.playerId);
    expect(await entries()).toEqual([b.id, a.id]);

    const hide = await admin("POST", `/players/${b.id}/hide`);
    expect(hide.status).toBe(200);
    expect(hide.json).toEqual({ ok: true, hidden: true });
    expect(await entries()).toEqual([a.id]);

    const unhide = await admin("POST", `/players/${b.id}/unhide`);
    expect(unhide.json).toEqual({ ok: true, hidden: false });
    expect(await entries()).toEqual([b.id, a.id]);
  });

  it("ocultar a un jugador inexistente ⇒ 404 player_not_found", async () => {
    const r = await admin("POST", "/players/no-existe/hide");
    expect(r.status).toBe(404);
    expect(r.json.error).toBe("player_not_found");
  });

  it("GET /admin/reports lista los reportes con apodos y estado", async () => {
    await call(h, "POST", "/v1/reports", { token: a.token, body: { targetPlayerId: b.id, reason: "Apodo ofensivo" } });
    h.clock.advance(5000);
    await call(h, "PATCH", "/v1/me", { token: b.token, body: { nickname: "NuevoNombre" } });
    await admin("POST", `/players/${b.id}/hide`);
    const r = await admin("GET", "/reports");
    expect(r.status).toBe(200);
    expect(r.json).toHaveLength(1);
    expect(r.json[0]).toEqual({
      id: expect.any(Number),
      reporterId: a.id,
      reporterNickname: a.nickname,
      targetId: b.id,
      targetNickname: "NuevoNombre",
      targetNicknameAtReport: b.nickname,
      targetHidden: true,
      reason: "Apodo ofensivo",
      createdAt: "2026-10-14T12:00:00.000Z",
    });
  });

  it("GET /admin/reports ordena del más reciente al más antiguo", async () => {
    const c = await register(h);
    await call(h, "POST", "/v1/reports", { token: a.token, body: { targetPlayerId: b.id, reason: "uno" } });
    h.clock.advance(1000);
    await call(h, "POST", "/v1/reports", { token: c.token, body: { targetPlayerId: b.id, reason: "dos" } });
    const r = await admin("GET", "/reports");
    expect(r.json.map((x: any) => x.reason)).toEqual(["dos", "uno"]);
  });
});

describe("administración: sin ADMIN_TOKEN configurado", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness({ config: { adminToken: undefined } });
  });
  afterAll(() => h.close());

  it("las rutas /admin no existen (404), tampoco con cabecera", async () => {
    for (const [method, path] of [["POST", "/v1/admin/players/x/hide"], ["POST", "/v1/admin/players/x/unhide"], ["GET", "/v1/admin/reports"]] as const) {
      for (const headers of [{}, { "x-admin-token": "cualquiera-cualquiera" }] as Array<Record<string, string>>) {
        const r = await call(h, method, path, { headers });
        expect(r.status).toBe(404);
        expect(r.json.error).toBe("not_found");
      }
    }
  });
});
