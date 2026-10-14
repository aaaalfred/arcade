import type { BoardResponse } from "@arcade/protocol";
import { Hono } from "hono";
import type { AppEnv, Ctx } from "../context";
import { ApiError, gameNotFound, invalidBody } from "../errors";
import { isoWeekKey } from "../period";
import { playerStanding, topEntries } from "../ranking";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function boardsRoutes(ctx: Ctx): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  r.get("/games/:id/boards/:board", ctx.requirePlayer, async (c) => {
    const player = c.get("player");
    const gameId = c.req.param("id");
    const game = ctx.catalog.get(gameId);
    if (!game) throw gameNotFound();
    const board = game.boards.find((b) => b.id === c.req.param("board"));
    if (!board) throw new ApiError(404, "board_not_found", "Ese tablero no existe en este juego.");

    const periodParam = c.req.query("period") ?? "all";
    if (periodParam !== "all" && periodParam !== "weekly") {
      throw invalidBody("«period» debe ser «all» o «weekly».");
    }
    const limitParam = c.req.query("limit");
    let limit = DEFAULT_LIMIT;
    if (limitParam !== undefined) {
      limit = /^\d{1,4}$/.test(limitParam) ? Number(limitParam) : 0;
      if (limit < 1 || limit > MAX_LIMIT) throw invalidBody(`«limit» debe ser un entero entre 1 y ${MAX_LIMIT}.`);
    }

    const period = periodParam === "weekly" ? isoWeekKey(ctx.now()) : "all";
    const where = { gameId, boardId: board.id, period, sort: board.sort };
    const [entries, me] = await Promise.all([
      topEntries(ctx.db, { ...where, limit }),
      playerStanding(ctx.db, { ...where, playerId: player.id }),
    ]);

    const body: BoardResponse = {
      entries: entries.map((e) => ({ ...e, isMe: e.playerId === player.id })),
      me,
    };
    return c.json(body);
  });

  return r;
}
