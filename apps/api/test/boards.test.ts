import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createHarness, register, seedPlayer, type Harness, type Player } from "./helpers";

describe("rankings: GET /v1/games/:id/boards/:board", () => {
  let h: Harness;
  let me: Player;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());
  beforeEach(async () => {
    await h.reset();
    me = await register(h);
  });

  const board = (qs = "", token = me.token, b = "taps", game = "tap-game") =>
    call(h, "GET", `/v1/games/${game}/boards/${b}${qs}`, { token });
  const submit = (p: Player, value: number, b = "taps") =>
    call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, body: { board: b, value } });
  /** Inserta un puntaje directamente (para escenarios grandes). */
  const insert = (p: Player, value: number, period = "all", at = "2026-10-14T11:00:00Z", b = "taps") =>
    h.db.query(
      "INSERT INTO scores (player_id, game_id, board_id, period, value, achieved_at, game_version) VALUES ($1,'tap-game',$2,$3,$4,$5,'1.2.3')",
      [p.id, b, period, value, at],
    );

  it("tablero vacío ⇒ entries [] y me null", async () => {
    const r = await board();
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ entries: [], me: null });
  });

  it("entries ordenadas desc con rank, playerId, nickname, value e isMe", async () => {
    const b = await register(h);
    const c = await register(h);
    await submit(me, 20);
    h.clock.advance(1000);
    await submit(b, 50);
    h.clock.advance(1000);
    await submit(c, 35);
    const r = await board();
    expect(r.json.entries).toEqual([
      { rank: 1, playerId: b.id, nickname: b.nickname, value: 50, isMe: false },
      { rank: 2, playerId: c.id, nickname: c.nickname, value: 35, isMe: false },
      { rank: 3, playerId: me.id, nickname: me.nickname, value: 20, isMe: true },
    ]);
    expect(r.json.me).toEqual({ rank: 3, value: 20 });
  });

  it("tablero asc: orden ascendente", async () => {
    const b = await register(h);
    await submit(me, 30.5, "fastest");
    await submit(b, 12.25, "fastest");
    const r = await board("", me.token, "fastest");
    expect(r.json.entries.map((e: any) => [e.rank, e.value])).toEqual([
      [1, 12.25],
      [2, 30.5],
    ]);
    expect(r.json.me).toEqual({ rank: 2, value: 30.5 });
  });

  it("empates por valor: va antes quien lo logró antes", async () => {
    const b = await register(h);
    const c = await register(h);
    await submit(c, 10);
    h.clock.advance(1000);
    await submit(me, 10);
    h.clock.advance(1000);
    await submit(b, 10);
    const r = await board();
    expect(r.json.entries.map((e: any) => e.nickname)).toEqual([c.nickname, me.nickname, b.nickname]);
    expect(r.json.entries.map((e: any) => e.rank)).toEqual([1, 2, 3]);
    expect(r.json.me.rank).toBe(2);
  });

  it("`me` aparece aunque esté fuera del top: 120 jugadores y limit=10", async () => {
    for (let v = 1; v <= 120; v++) {
      const q = await seedPlayer(h);
      await insert(q, v);
    }
    h.clock.advance(60_000);
    await submit(me, 50); // llega después del jugador sembrado con 50 ⇒ pierde el empate
    const r = await board("?limit=10");
    expect(r.status).toBe(200);
    expect(r.json.entries).toHaveLength(10);
    expect(r.json.entries.map((e: any) => e.value)).toEqual([120, 119, 118, 117, 116, 115, 114, 113, 112, 111]);
    expect(r.json.entries.map((e: any) => e.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.json.entries.some((e: any) => e.isMe)).toBe(false);
    // 70 jugadores con más de 50 + 1 empatado que llegó antes ⇒ rank 72
    expect(r.json.me).toEqual({ rank: 72, value: 50 });
    // y su rank coincide con el de la respuesta de submitScore
    const again = await submit(me, 40);
    expect(again.json.rank.all).toBe(72);
  });

  it("limit: por defecto 50, entre 1 y 100; fuera de rango ⇒ 400 invalid_body", async () => {
    for (let v = 1; v <= 120; v++) await insert(await seedPlayer(h), v);
    expect((await board()).json.entries).toHaveLength(50);
    expect((await board("?limit=1")).json.entries).toHaveLength(1);
    expect((await board("?limit=100")).json.entries).toHaveLength(100);
    for (const bad of ["0", "101", "-1", "abc", "1.5", "", "1e2", "0x10", "10abc"]) {
      const r = await board(`?limit=${bad}`);
      expect(r.status, `limit=${bad}`).toBe(400);
      expect(r.json.error).toBe("invalid_body");
    }
  });

  it("period: all por defecto, weekly usa la semana actual; otro valor ⇒ 400", async () => {
    await insert(me, 90, "all");
    await insert(me, 40, "2026-W42"); // semana de 2026-10-14
    await insert(me, 70, "2026-W41"); // semana anterior: no debe verse
    expect((await board()).json.entries[0].value).toBe(90);
    expect((await board("?period=all")).json.entries[0].value).toBe(90);
    const w = await board("?period=weekly");
    expect(w.json.entries.map((e: any) => e.value)).toEqual([40]);
    expect(w.json.me).toEqual({ rank: 1, value: 40 });
    for (const bad of ["monthly", "", "ALL", "2026-W42"]) {
      const r = await board(`?period=${bad}`);
      expect(r.status, `period=${bad}`).toBe(400);
      expect(r.json.error).toBe("invalid_body");
    }
  });

  it("weekly cambia con el reloj: la semana siguiente el tablero está vacío y me es null", async () => {
    await submit(me, 40);
    expect((await board("?period=weekly")).json.entries).toHaveLength(1);
    h.clock.set("2026-10-19T00:00:00Z"); // lunes de la semana siguiente
    const r = await board("?period=weekly");
    expect(r.json).toEqual({ entries: [], me: null });
    expect((await board("?period=all")).json.entries).toHaveLength(1);
  });

  it("jugador oculto: no aparece ni cuenta para el rank de otros", async () => {
    const oculto = await register(h);
    const otro = await register(h);
    await submit(oculto, 900);
    await submit(otro, 100);
    await submit(me, 50);
    await h.db.query("UPDATE players SET hidden = true WHERE id = $1", [oculto.id]);

    const r = await board();
    expect(r.json.entries.map((e: any) => e.playerId)).toEqual([otro.id, me.id]);
    expect(r.json.entries.map((e: any) => e.rank)).toEqual([1, 2]);
    expect(r.json.me).toEqual({ rank: 2, value: 50 });
    // el oculto sigue viendo su propio valor, con el rank que tendría entre los visibles
    // (así no se entera de que lo han ocultado)
    const suyo = await board("", oculto.token);
    expect(suyo.json.entries.map((e: any) => e.playerId)).toEqual([otro.id, me.id]);
    expect(suyo.json.me).toEqual({ rank: 1, value: 900 });
  });

  it("`me` es null si el jugador no tiene puntaje en ese tablero, aunque haya otros", async () => {
    const b = await register(h);
    await submit(b, 10);
    const r = await board();
    expect(r.json.me).toBeNull();
    expect(r.json.entries).toHaveLength(1);
  });

  it("404 para tablero o juego desconocidos; 401 sin credenciales", async () => {
    const t = await board("", me.token, "no-existe");
    expect(t.status).toBe(404);
    expect(t.json.error).toBe("board_not_found");
    const g = await board("", me.token, "taps", "no-existe");
    expect(g.status).toBe(404);
    expect(g.json.error).toBe("game_not_found");
    expect((await call(h, "GET", "/v1/games/tap-game/boards/taps")).status).toBe(401);
  });

  it("los tableros de un mismo juego son independientes entre sí", async () => {
    await submit(me, 5, "taps");
    await submit(me, 20, "fastest");
    expect((await board("", me.token, "taps")).json.entries.map((e: any) => e.value)).toEqual([5]);
    expect((await board("", me.token, "fastest")).json.entries.map((e: any) => e.value)).toEqual([20]);
  });
});
