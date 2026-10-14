import { ScoreBody, type ScoreResult } from "@arcade/protocol";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Ctx } from "../context";
import { ApiError, gameNotFound, rateLimited } from "../errors";
import { parseWith, readJson } from "../http";
import { isoWeekKey } from "../period";
import { playerStanding } from "../ranking";

/** Igual que `ScoreBody`, pero `value` se valida a mano para devolver `invalid_score` (y no `invalid_body`). */
const ScoreEnvelope = ScoreBody.extend({ value: z.unknown() });

const invalidScore = (message: string) => new ApiError(400, "invalid_score", message);

export function scoresRoutes(ctx: Ctx): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  r.post("/games/:id/scores", ctx.requirePlayer, async (c) => {
    const player = c.get("player");
    const gameId = c.req.param("id");
    const game = ctx.catalog.get(gameId);
    if (!game) throw gameNotFound();

    // Antiabuso: 30 envíos/min/jugador. Cuentan también los inválidos.
    const limit = ctx.limiters.score.hit(player.id);
    if (!limit.ok) throw rateLimited(limit.retryAfterSec, "Estás enviando puntajes demasiado rápido. Espera un momento.");

    const body = parseWith(ScoreEnvelope, await readJson(c));
    const board = game.boards.find((b) => b.id === body.board);
    if (!board) throw new ApiError(404, "board_not_found", "Ese tablero no existe en este juego.");

    // Valor hostil: null, cadenas, Infinity (1e309 llega así tras JSON.parse), enteros inseguros, fuera de rango…
    const sent = body.value;
    if (typeof sent !== "number" || !Number.isFinite(sent)) throw invalidScore("El puntaje debe ser un número finito.");
    const value = sent === 0 ? 0 : sent; // normaliza -0 a 0
    if (board.integer && !Number.isSafeInteger(value)) throw invalidScore("El puntaje de este tablero debe ser un entero.");
    if (value < board.min || value > board.max) {
      throw invalidScore(`El puntaje debe estar entre ${board.min} y ${board.max}.`);
    }

    const now = ctx.now();
    const nowIso = now.toISOString();
    const periods = ["all", isoWeekKey(now)] as const;
    // El nuevo valor reemplaza al guardado solo si es mejor según el sentido del tablero.
    const worseThanNew = board.sort === "desc" ? "<" : ">";

    const result = await ctx.db.tx(async (t) => {
      let accepted = false;
      for (const period of periods) {
        const changed = await t.query(
          `INSERT INTO scores (player_id, game_id, board_id, period, value, achieved_at, game_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (player_id, game_id, board_id, period) DO UPDATE
              SET value = EXCLUDED.value, achieved_at = EXCLUDED.achieved_at, game_version = EXCLUDED.game_version
            WHERE scores.value ${worseThanNew} EXCLUDED.value
           RETURNING 1`,
          [player.id, gameId, board.id, period, value, nowIso, game.version],
        );
        if (changed.length > 0) accepted = true;
      }
      const standing = { gameId, boardId: board.id, sort: board.sort, playerId: player.id };
      const all = await playerStanding(t, { ...standing, period: "all" });
      const weekly = await playerStanding(t, { ...standing, period: periods[1] });
      return { accepted, all, weekly };
    });

    const out: ScoreResult = {
      accepted: result.accepted,
      best: result.all?.value ?? value,
      rank: { all: result.all?.rank ?? null, weekly: result.weekly?.rank ?? null },
      offline: false,
    };
    return c.json(out);
  });

  return r;
}
