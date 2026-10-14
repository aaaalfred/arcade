import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createHarness, register, type Harness, type Player } from "./helpers";

describe("DELETE /v1/me (borrado de datos)", () => {
  let h: Harness;
  let a: Player;
  let b: Player;
  let c: Player;
  beforeAll(async () => {
    h = await createHarness({ config: { adminToken: "t".repeat(32) } });
  });
  afterAll(() => h.close());
  beforeEach(async () => {
    await h.reset();
    a = await register(h);
    b = await register(h);
    c = await register(h);
  });

  const submit = (p: Player, v: number) => call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, body: { board: "taps", value: v } });
  const save = (p: Player, game = "tap-game") =>
    call(h, "PUT", `/v1/games/${game}/save`, { token: p.token, body: { state: { de: p.id }, progress: { value: 3 }, baseRev: 0 } });
  const count = async (sql: string, ...params: unknown[]) => (await h.db.query<{ n: number }>(sql, params))[0]!.n;

  it("borra jugador, guardados, puntajes y reportes (hechos y recibidos); el token deja de valer", async () => {
    await save(a);
    await save(a, "other-game");
    await save(b);
    await submit(a, 100);
    await submit(b, 50);
    await submit(c, 10);
    await call(h, "POST", "/v1/reports", { token: a.token, body: { targetPlayerId: b.id, reason: "hecho por a" } });
    await call(h, "POST", "/v1/reports", { token: b.token, body: { targetPlayerId: a.id, reason: "recibido por a" } });
    await call(h, "POST", "/v1/reports", { token: b.token, body: { targetPlayerId: c.id, reason: "ajeno a a" } });

    const r = await call(h, "DELETE", "/v1/me", { token: a.token });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });

    // el jugador y todo lo suyo desaparecen
    expect(await count("SELECT count(*)::int AS n FROM players WHERE id = $1", a.id)).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM saves WHERE player_id = $1", a.id)).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM scores WHERE player_id = $1", a.id)).toBe(0);
    expect(await count("SELECT count(*)::int AS n FROM reports WHERE reporter_id = $1 OR target_id = $1", a.id)).toBe(0);

    // lo de los demás sigue ahí
    expect(await count("SELECT count(*)::int AS n FROM players")).toBe(2);
    expect(await count("SELECT count(*)::int AS n FROM saves WHERE player_id = $1", b.id)).toBe(1);
    expect(await count("SELECT count(*)::int AS n FROM scores")).toBe(4); // b y c: all + semana
    expect(await h.db.query("SELECT reason FROM reports")).toEqual([{ reason: "ajeno a a" }]);

    // su token ya no sirve, para nada
    for (const [method, path] of [["GET", "/v1/me"], ["GET", "/v1/saves"], ["DELETE", "/v1/me"]] as const) {
      expect((await call(h, method, path, { token: a.token })).status, `${method} ${path}`).toBe(401);
    }
    expect((await submit(a, 1)).status).toBe(401);
  });

  it("desaparece del ranking y los demás suben de posición", async () => {
    await submit(a, 100);
    await submit(b, 50);
    await submit(c, 10);
    const before = await call(h, "GET", "/v1/games/tap-game/boards/taps", { token: c.token });
    expect(before.json.entries.map((e: any) => e.playerId)).toEqual([a.id, b.id, c.id]);
    expect(before.json.me.rank).toBe(3);

    await call(h, "DELETE", "/v1/me", { token: a.token });

    for (const period of ["all", "weekly"]) {
      const after = await call(h, "GET", `/v1/games/tap-game/boards/taps?period=${period}`, { token: c.token });
      expect(after.json.entries.map((e: any) => e.playerId), period).toEqual([b.id, c.id]);
      expect(after.json.me, period).toEqual({ rank: 2, value: 10 });
    }
  });

  it("desaparece de los reportes de administración", async () => {
    await call(h, "POST", "/v1/reports", { token: b.token, body: { targetPlayerId: a.id, reason: "x" } });
    await call(h, "DELETE", "/v1/me", { token: a.token });
    const r = await call(h, "GET", "/v1/admin/reports", { headers: { "x-admin-token": "t".repeat(32) } });
    expect(r.json).toEqual([]);
  });

  it("borrar dos veces: la segunda ⇒ 401; sin credenciales ⇒ 401", async () => {
    expect((await call(h, "DELETE", "/v1/me", { token: a.token })).status).toBe(200);
    expect((await call(h, "DELETE", "/v1/me", { token: a.token })).status).toBe(401);
    expect((await call(h, "DELETE", "/v1/me")).status).toBe(401);
  });

  it("el apodo queda libre para otra persona", async () => {
    await call(h, "PATCH", "/v1/me", { token: a.token, body: { nickname: "Reutilizable" } });
    await call(h, "DELETE", "/v1/me", { token: a.token });
    const r = await call(h, "PATCH", "/v1/me", { token: b.token, body: { nickname: "reutilizable" } });
    expect(r.status).toBe(200);
  });
});
