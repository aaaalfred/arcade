import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_SAVE_BYTES } from "@arcade/protocol";
import { call, createHarness, register, type Harness, type Player } from "./helpers";

describe("guardados: PUT /v1/games/:id/save y GET /v1/saves", () => {
  let h: Harness;
  let p: Player;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());
  beforeEach(async () => {
    await h.reset();
    p = await register(h);
  });

  const put = (body: unknown, token = p.token, game = "tap-game") => call(h, "PUT", `/v1/games/${game}/save`, { token, body });
  const save = (state: unknown, value: number, baseRev: number, total?: number) =>
    put({ state, progress: total === undefined ? { value } : { value, total }, baseRev });

  it("sin registro previo ⇒ created con rev 1 y el SaveRecord completo", async () => {
    const r = await save({ level: 3 }, 3, 0, 10);
    expect(r.status).toBe(200);
    expect(r.json).toEqual({
      rev: 1,
      resolution: "created",
      save: {
        gameId: "tap-game",
        rev: 1,
        state: { level: 3 },
        progress: { value: 3, total: 10 },
        updatedAt: "2026-10-14T12:00:00.000Z",
      },
    });
  });

  it("baseRev === rev ⇒ updated (rev+1), incluso con progreso menor", async () => {
    await save({ a: 1 }, 5, 0);
    h.clock.advance(1000);
    const r = await save({ a: 2 }, 2, 1);
    expect(r.status).toBe(200);
    expect(r.json.resolution).toBe("updated");
    expect(r.json.rev).toBe(2);
    expect(r.json.save.state).toEqual({ a: 2 });
    expect(r.json.save.progress).toEqual({ value: 2 });
    expect(r.json.save.updatedAt).toBe("2026-10-14T12:00:01.000Z");
  });

  it("baseRev desfasado con progreso MAYOR ⇒ updated", async () => {
    await save({ a: 1 }, 3, 0); // rev 1
    await save({ a: 2 }, 4, 1); // rev 2
    const r = await save({ from: "otro dispositivo" }, 9, 1); // baseRev 1 ≠ 2, pero 9 > 4
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ rev: 3, resolution: "updated" });
  });

  it("baseRev desfasado con progreso IGUAL ⇒ updated (empata la última escritura)", async () => {
    await save({ a: 1 }, 4, 0);
    await save({ a: 2 }, 4, 1);
    const r = await save({ a: "tercero" }, 4, 0);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ rev: 3, resolution: "updated" });
    expect(r.json.save.state).toEqual({ a: "tercero" });
  });

  it("baseRev desfasado con progreso MENOR ⇒ 409 stale_save con el guardado del servidor", async () => {
    await save({ servidor: true }, 7, 0, 10);
    const r = await save({ viejo: true }, 2, 0);
    expect(r.status).toBe(409);
    expect(r.json.error).toBe("stale_save");
    expect(typeof r.json.message).toBe("string");
    expect(r.json.resolution).toBe("server-wins");
    expect(r.json.save).toMatchObject({
      gameId: "tap-game",
      rev: 1,
      state: { servidor: true },
      progress: { value: 7, total: 10 },
    });
    // el servidor no cambió
    const stored = await h.db.query("SELECT rev, state FROM saves WHERE player_id = $1", [p.id]);
    expect(stored).toEqual([{ rev: 1, state: { servidor: true } }]);
  });

  it("un baseRev inventado mayor que rev se trata como desfasado", async () => {
    await save({ a: 1 }, 5, 0);
    expect((await save({ a: 2 }, 1, 99)).status).toBe(409);
    expect((await save({ a: 3 }, 6, 99)).json.resolution).toBe("updated");
  });

  it("acepta cualquier JSON como estado: null, número, cadena, arreglo", async () => {
    for (const [i, state] of [null, 42, "texto", [1, 2, 3]].entries()) {
      const r = await save(state, 1, i);
      expect(r.status, JSON.stringify(state)).toBe(200);
      expect(r.json.save.state).toEqual(state);
    }
  });

  it("el estado se devuelve idéntico (claves, unicode, números)", async () => {
    const state = { nivel: 3, estrellas: [3, 2, 1], nombre: "Ángel 😀", ratio: 0.25, anidado: { ok: true, nada: null } };
    await save(state, 3, 0);
    const list = await call(h, "GET", "/v1/saves", { token: p.token });
    expect(list.json[0].state).toEqual(state);
  });

  it("estado de exactamente 64 KB ⇒ ok; de 64 KB + 1 byte ⇒ 413 save_too_large", async () => {
    const exact = "a".repeat(MAX_SAVE_BYTES - 2); // con las comillas, JSON de 65 536 bytes
    expect(Buffer.byteLength(JSON.stringify(exact))).toBe(MAX_SAVE_BYTES);
    expect((await save(exact, 1, 0)).status).toBe(200);
    const r = await save("a".repeat(MAX_SAVE_BYTES - 1), 1, 1);
    expect(r.status).toBe(413);
    expect(r.json.error).toBe("save_too_large");
    expect(typeof r.json.message).toBe("string");
  });

  it("el límite se mide en BYTES, no en caracteres", async () => {
    const euros = "€".repeat(21_846); // 3 bytes cada uno ⇒ 65 538 bytes + comillas
    expect(euros.length).toBeLessThan(MAX_SAVE_BYTES);
    expect((await save(euros, 1, 0)).status).toBe(413);
  });

  it("estado de 65 KB ⇒ 413 y no se guarda nada", async () => {
    const r = await save({ blob: "x".repeat(65 * 1024) }, 1, 0);
    expect(r.status).toBe(413);
    expect(await h.db.query("SELECT 1 FROM saves")).toHaveLength(0);
  });

  it("un cuerpo de más de 128 KB ⇒ 413 save_too_large (también si lo declara Content-Length)", async () => {
    const r = await call(h, "PUT", "/v1/games/tap-game/save", {
      token: p.token,
      raw: JSON.stringify({ state: "x".repeat(200_000), progress: { value: 1 }, baseRev: 0 }),
    });
    expect(r.status).toBe(413);
    expect(r.json.error).toBe("save_too_large");
    const declarado = await call(h, "PUT", "/v1/games/tap-game/save", {
      token: p.token,
      raw: "{}",
      headers: { "content-length": "999999" },
    });
    expect(declarado.status).toBe(413);
  });

  it("juego desconocido ⇒ 404 game_not_found", async () => {
    for (const game of ["no-existe", "..%2Fetc", "TAP-GAME", "x"]) {
      const r = await put({ state: {}, progress: { value: 0 }, baseRev: 0 }, p.token, game);
      expect(r.status, game).toBe(404);
      expect(r.json.error).toBe("game_not_found");
    }
  });

  it("sin credenciales ⇒ 401 (antes de mirar el juego o el cuerpo)", async () => {
    const r = await call(h, "PUT", "/v1/games/no-existe/save", { raw: "no json" });
    expect(r.status).toBe(401);
  });

  it("cuerpos inválidos ⇒ 400 invalid_body", async () => {
    const malos: unknown[] = [
      {},
      { progress: { value: 1 }, baseRev: 0 }, // sin state
      { state: {}, baseRev: 0 }, // sin progress
      { state: {}, progress: { value: 1 } }, // sin baseRev
      { state: {}, progress: { value: -1 }, baseRev: 0 },
      { state: {}, progress: { value: 1.5 }, baseRev: 0 },
      { state: {}, progress: { value: "3" }, baseRev: 0 },
      { state: {}, progress: { value: 1, total: -2 }, baseRev: 0 },
      { state: {}, progress: { value: 2 ** 31 }, baseRev: 0 }, // no cabe en la columna
      { state: {}, progress: { value: 1, total: 2 ** 31 }, baseRev: 0 },
      { state: {}, progress: { value: 1 }, baseRev: -1 },
      { state: {}, progress: { value: 1 }, baseRev: 1.2 },
      { state: {}, progress: { value: 1 }, baseRev: "0" },
      [],
      "texto",
      null,
    ];
    for (const body of malos) {
      const r = await put(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.error).toBe("invalid_body");
    }
    expect((await call(h, "PUT", "/v1/games/tap-game/save", { token: p.token, raw: "{roto" })).json.error).toBe("invalid_body");
    expect((await call(h, "PUT", "/v1/games/tap-game/save", { token: p.token })).json.error).toBe("invalid_body");
    expect(await h.db.query("SELECT 1 FROM saves")).toHaveLength(0);
  });

  it("rechaza un estado con NUL (Postgres no lo admite en jsonb) con 400, no 500", async () => {
    const raw = '{"state":{"x":"a\\u0000b"},"progress":{"value":1},"baseRev":0}';
    const r = await call(h, "PUT", "/v1/games/tap-game/save", { token: p.token, raw });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_body");
    // pero un backslash literal seguido de «u0000» es texto normal y se acepta
    const ok = await save({ x: "\\u0000" }, 1, 0);
    expect(ok.status).toBe(200);
  });

  it("rechaza un sustituto Unicode suelto (jsonb no lo admite) con 400, no 500", async () => {
    const raw = '{"state":{"x":"\\ud800"},"progress":{"value":1},"baseRev":0}';
    const r = await call(h, "PUT", "/v1/games/tap-game/save", { token: p.token, raw });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_body");
    expect(await h.db.query("SELECT 1 FROM saves")).toHaveLength(0);
  });

  it("rechaza estados anidados de forma abusiva con 400", async () => {
    let state: unknown = 1;
    for (let i = 0; i < 500; i++) state = [state];
    const r = await save(state, 1, 0);
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_body");
  });

  it("dos guardados simultáneos sobre un registro nuevo no rompen nada", async () => {
    const [a, b] = await Promise.all([save({ n: 1 }, 2, 0), save({ n: 2 }, 2, 0)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.json.resolution, b.json.resolution].sort()).toEqual(["created", "updated"]);
    expect((await h.db.query("SELECT rev FROM saves"))[0]).toEqual({ rev: 2 });
  });

  it("GET /saves devuelve solo los guardados del jugador autenticado", async () => {
    const q = await register(h);
    await save({ a: 1 }, 1, 0);
    await put({ state: { b: 2 }, progress: { value: 2, total: 10 }, baseRev: 0 }, p.token, "other-game");
    await put({ state: { c: 3 }, progress: { value: 3 }, baseRev: 0 }, q.token);
    const mine = await call(h, "GET", "/v1/saves", { token: p.token });
    expect(mine.status).toBe(200);
    expect(mine.json).toHaveLength(2);
    expect(mine.json.map((s: any) => s.gameId).sort()).toEqual(["other-game", "tap-game"]);
    expect(mine.json.find((s: any) => s.gameId === "other-game")).toEqual({
      gameId: "other-game",
      rev: 1,
      state: { b: 2 },
      progress: { value: 2, total: 10 },
      updatedAt: "2026-10-14T12:00:00.000Z",
    });
    const theirs = await call(h, "GET", "/v1/saves", { token: q.token });
    expect(theirs.json).toHaveLength(1);
    expect(theirs.json[0].state).toEqual({ c: 3 });
  });

  it("GET /saves sin guardados ⇒ [] y sin credenciales ⇒ 401", async () => {
    expect((await call(h, "GET", "/v1/saves", { token: p.token })).json).toEqual([]);
    expect((await call(h, "GET", "/v1/saves")).status).toBe(401);
  });

  it("los guardados de jugadores distintos no se pisan en el mismo juego", async () => {
    const q = await register(h);
    await save({ de: "p" }, 1, 0);
    const r = await put({ state: { de: "q" }, progress: { value: 1 }, baseRev: 0 }, q.token);
    expect(r.json.resolution).toBe("created");
    expect(await h.db.query("SELECT count(*)::int AS n FROM saves")).toEqual([{ n: 2 }]);
  });
});
