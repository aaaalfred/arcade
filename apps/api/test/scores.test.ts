import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createHarness, register, seedPlayer, type Harness, type Player } from "./helpers";

describe("puntajes: POST /v1/games/:id/scores", () => {
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

  const submit = (board: string, value: unknown, token = p.token, game = "tap-game") =>
    call(h, "POST", `/v1/games/${game}/scores`, { token, body: { board, value } });
  const rows = () => h.db.query<{ period: string; board_id: string; value: number }>("SELECT period, board_id, value FROM scores ORDER BY period, board_id");

  it("tablero desc: el mejor reemplaza al peor; el peor no reemplaza al mejor", async () => {
    const a = await submit("taps", 10);
    expect(a.status).toBe(200);
    expect(a.json).toEqual({ accepted: true, best: 10, rank: { all: 1, weekly: 1 }, offline: false });

    const peor = await submit("taps", 5);
    expect(peor.json).toMatchObject({ accepted: false, best: 10, rank: { all: 1, weekly: 1 } });

    const igual = await submit("taps", 10);
    expect(igual.json).toMatchObject({ accepted: false, best: 10 });

    const mejor = await submit("taps", 20);
    expect(mejor.json).toMatchObject({ accepted: true, best: 20 });
    expect(await rows()).toEqual([
      { period: "2026-W42", board_id: "taps", value: 20 },
      { period: "all", board_id: "taps", value: 20 },
    ]);
  });

  it("tablero asc: gana el valor menor (y admite decimales si integer=false)", async () => {
    expect((await submit("fastest", 30.5)).json).toMatchObject({ accepted: true, best: 30.5 });
    expect((await submit("fastest", 40)).json).toMatchObject({ accepted: false, best: 30.5 });
    expect((await submit("fastest", 12.25)).json).toMatchObject({ accepted: true, best: 12.25 });
  });

  it("guarda la versión del juego y no guarda meta", async () => {
    const r = await call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, body: { board: "taps", value: 7, meta: { moves: 12 } } });
    expect(r.status).toBe(200);
    const row = await h.db.query("SELECT game_version, to_jsonb(scores) AS j FROM scores WHERE period = 'all'");
    expect(row[0].game_version).toBe("1.2.3");
    expect(JSON.stringify(row[0].j)).not.toContain("moves");
  });

  describe("valores hostiles ⇒ 400 y no se guarda nada", () => {
    const hostiles: Array<[string, string]> = [
      ["null", '{"board":"taps","value":null}'],
      ["cadena numérica", '{"board":"taps","value":"12"}'],
      ["cadena NaN", '{"board":"taps","value":"NaN"}'],
      ["1e309 (JSON.parse → Infinity)", '{"board":"taps","value":1e309}'],
      ["-1e309", '{"board":"taps","value":-1e309}'],
      ["booleano", '{"board":"taps","value":true}'],
      ["arreglo", '{"board":"taps","value":[5]}'],
      ["objeto", '{"board":"taps","value":{"valueOf":5}}'],
      ["fraccionario en tablero integer", '{"board":"taps","value":3.5}'],
      ["max + 1", '{"board":"taps","value":100001}'],
      ["min - 1", '{"board":"taps","value":-1}'],
      ["entero inseguro", '{"board":"taps","value":9007199254740993}'],
      ["-0 en tablero con min > 0", '{"board":"stars","value":-0}'],
      ["0 en tablero con min > 0", '{"board":"stars","value":0}'],
      ["asc: bajo el mínimo", '{"board":"fastest","value":0.5}'],
      ["asc: sobre el máximo", '{"board":"fastest","value":600.01}'],
      ["1e308 (muy sobre el máximo)", '{"board":"taps","value":1e308}'],
    ];
    for (const [nombre, raw] of hostiles) {
      it(nombre, async () => {
        const r = await call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, raw });
        expect(r.status).toBe(400);
        expect(r.json.error).toBe("invalid_score");
        expect(typeof r.json.message).toBe("string");
        expect(await rows()).toHaveLength(0);
      });
    }
  });

  it("-0 se normaliza a 0 antes de validar y guardar (tablero con min = 0)", async () => {
    const r = await call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, raw: '{"board":"taps","value":-0}' });
    expect(r.status).toBe(200);
    expect(r.json.best).toBe(0);
    expect(Object.is(r.json.best, -0)).toBe(false);
    const stored = await h.db.query<{ negativo: boolean; v: number }>(
      "SELECT (1.0 / NULLIF(value, 0) < 0) AS negativo, value AS v FROM scores WHERE period = 'all'",
    );
    expect(stored[0]!.v).toBe(0);
  });

  it("los límites exactos min y max son válidos", async () => {
    expect((await submit("taps", 0)).status).toBe(200);
    expect((await submit("taps", 100000)).status).toBe(200);
    expect((await submit("fastest", 1)).status).toBe(200);
    expect((await submit("fastest", 600)).status).toBe(200);
  });

  it("cuerpo mal formado ⇒ 400 invalid_body; tablero o juego desconocido ⇒ 404", async () => {
    for (const body of [{ board: "taps" }, { value: 1 }, { board: 5, value: 1 }, { board: "", value: 1 }, { board: "taps", value: 1, meta: "x" }, []]) {
      const r = await call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, body });
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.json.error).toBe("invalid_body");
    }
    expect((await call(h, "POST", "/v1/games/tap-game/scores", { token: p.token, raw: "{x" })).json.error).toBe("invalid_body");
    const board = await submit("no-existe", 1);
    expect(board.status).toBe(404);
    expect(board.json.error).toBe("board_not_found");
    const game = await submit("taps", 1, p.token, "no-existe");
    expect(game.status).toBe(404);
    expect(game.json.error).toBe("game_not_found");
    expect(await rows()).toHaveLength(0);
  });

  it("un tablero de otro juego no sirve (los tableros pertenecen a su juego)", async () => {
    expect((await submit("fastest", 10, p.token, "other-game")).status).toBe(404);
    // y los límites son los del manifiesto de ESE juego
    expect((await submit("taps", 1001, p.token, "other-game")).json.error).toBe("invalid_score");
    expect((await submit("taps", 1000, p.token, "other-game")).status).toBe(200);
  });

  it("sin credenciales ⇒ 401", async () => {
    expect((await call(h, "POST", "/v1/games/tap-game/scores", { body: { board: "taps", value: 1 } })).status).toBe(401);
  });

  it("empates: con el mismo valor va primero quien llegó antes", async () => {
    const b = await register(h);
    const c = await register(h);
    expect((await submit("taps", 10, p.token)).json.rank).toEqual({ all: 1, weekly: 1 });
    h.clock.advance(1000);
    expect((await submit("taps", 10, b.token)).json.rank).toEqual({ all: 2, weekly: 2 });
    h.clock.advance(1000);
    expect((await submit("taps", 10, c.token)).json.rank).toEqual({ all: 3, weekly: 3 });
    // volver a enviar el mismo valor NO adelanta la marca de tiempo
    h.clock.advance(1000);
    expect((await submit("taps", 10, p.token)).json).toMatchObject({ accepted: false, rank: { all: 1, weekly: 1 } });
    // y alguien que llegue con un valor mejor pasa por delante de todos
    h.clock.advance(1000);
    expect((await submit("taps", 11, c.token)).json.rank).toEqual({ all: 1, weekly: 1 });
    expect((await submit("taps", 10, b.token)).json.rank).toEqual({ all: 3, weekly: 3 });
  });

  it("empates también en tableros asc", async () => {
    const b = await register(h);
    await submit("fastest", 20, p.token);
    h.clock.advance(1000);
    expect((await submit("fastest", 20, b.token)).json.rank.all).toBe(2);
    h.clock.advance(1000);
    expect((await submit("fastest", 19.9, b.token)).json.rank.all).toBe(1);
  });

  it("frontera semanal: domingo 23:59:59Z y lunes 00:00:00Z caen en periodos distintos y `all` conserva el mejor", async () => {
    h.clock.set("2026-10-04T23:59:59Z");
    const domingo = await submit("taps", 50);
    expect(domingo.json).toMatchObject({ accepted: true, best: 50, rank: { all: 1, weekly: 1 } });

    h.clock.set("2026-10-05T00:00:00Z");
    const lunes = await submit("taps", 30);
    // no mejora el `all`, pero sí abre la semana nueva ⇒ accepted
    expect(lunes.json).toMatchObject({ accepted: true, best: 50, rank: { all: 1, weekly: 1 } });

    expect(await rows()).toEqual([
      { period: "2026-W40", board_id: "taps", value: 50 },
      { period: "2026-W41", board_id: "taps", value: 30 },
      { period: "all", board_id: "taps", value: 50 },
    ]);

    // El ranking semanal de la semana nueva solo ve 30; el global ve 50.
    const weekly = await call(h, "GET", "/v1/games/tap-game/boards/taps?period=weekly", { token: p.token });
    expect(weekly.json.entries.map((e: any) => e.value)).toEqual([30]);
    const all = await call(h, "GET", "/v1/games/tap-game/boards/taps?period=all", { token: p.token });
    expect(all.json.entries.map((e: any) => e.value)).toEqual([50]);
  });

  it("31-dic-2026 pertenece a la semana 2026-W53 y 4-ene-2027 a 2027-W01", async () => {
    h.clock.set("2026-12-31T12:00:00Z");
    await submit("taps", 1);
    h.clock.set("2027-01-03T12:00:00Z");
    await submit("taps", 2);
    h.clock.set("2027-01-04T00:00:00Z");
    await submit("taps", 3);
    const weekly = (await rows()).filter((r) => r.period !== "all").map((r) => [r.period, r.value]);
    expect(weekly).toEqual([
      ["2026-W53", 2],
      ["2027-W01", 3],
    ]);
  });

  it("límite de 30 envíos por minuto y jugador: el 31º ⇒ 429 con Retry-After", async () => {
    const otro = await register(h);
    for (let i = 0; i < 30; i++) {
      expect((await submit("taps", i)).status, `envío ${i + 1}`).toBe(200);
      h.clock.advance(1000); // 30 envíos repartidos en 30 s
    }
    const r = await submit("taps", 99);
    expect(r.status).toBe(429);
    expect(r.json.error).toBe("rate_limited");
    expect(r.headers.get("retry-after")).toBe("30"); // el primero caduca 60 s después de t=0; han pasado 30 s
    // otro jugador no se ve afectado
    expect((await submit("taps", 1, otro.token)).status).toBe(200);
    // y pasado el tiempo vuelve a funcionar
    h.clock.advance(30_000);
    expect((await submit("taps", 99)).status).toBe(200);
    expect(await h.db.query("SELECT value FROM scores WHERE period = 'all' AND player_id = $1", [p.id])).toEqual([{ value: 99 }]);
  });

  it("los envíos inválidos también consumen el límite", async () => {
    for (let i = 0; i < 30; i++) expect((await submit("taps", "x")).status).toBe(400);
    expect((await submit("taps", 5)).status).toBe(429);
  });

  it("dos envíos simultáneos del mismo jugador: se queda el mejor", async () => {
    const [a, b] = await Promise.all([submit("taps", 5), submit("taps", 9)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await h.db.query("SELECT value FROM scores WHERE period = 'all'")).toEqual([{ value: 9 }]);
  });

  it("los puntajes de otros juegos con el mismo id de tablero son independientes", async () => {
    await submit("taps", 100);
    const r = await submit("taps", 7, p.token, "other-game");
    expect(r.json).toMatchObject({ accepted: true, best: 7, rank: { all: 1, weekly: 1 } });
  });

  it("un jugador oculto no cuenta para el rank de los demás", async () => {
    const oculto = await seedPlayer(h, "Oculto", { hidden: true });
    await submit("taps", 500, oculto.token);
    const r = await submit("taps", 10);
    expect(r.json.rank).toEqual({ all: 1, weekly: 1 });
  });
});
