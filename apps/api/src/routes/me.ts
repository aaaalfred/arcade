import { SetNicknameBody, type PlayerInfo } from "@arcade/protocol";
import { Hono } from "hono";
import type { AppEnv, Ctx } from "../context";
import { dbErrorCode, UNIQUE_VIOLATION } from "../db";
import { ApiError } from "../errors";
import { parseWith, readJson } from "../http";
import { NICKNAME_MESSAGES, nicknameKey, normalizeNickname, validateNickname } from "../nickname";

export function meRoutes(ctx: Ctx): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  r.get("/me", ctx.requirePlayer, (c) => {
    const p = c.get("player");
    const body: PlayerInfo = { id: p.id, nickname: p.nickname };
    return c.json(body);
  });

  r.patch("/me", ctx.requirePlayer, async (c) => {
    const player = c.get("player");
    const { nickname: raw } = parseWith(SetNicknameBody, await readJson(c));

    const nickname = normalizeNickname(raw);
    const check = validateNickname(nickname);
    if (!check.ok) throw new ApiError(400, check.reason, NICKNAME_MESSAGES[check.reason]);

    try {
      // La unicidad la garantiza el índice único sobre nickname_ci: sin carreras entre dos peticiones.
      await ctx.db.query("UPDATE players SET nickname = $2, nickname_ci = $3 WHERE id = $1", [
        player.id,
        nickname,
        nicknameKey(nickname),
      ]);
    } catch (err) {
      if (dbErrorCode(err) === UNIQUE_VIOLATION) {
        throw new ApiError(409, "nickname_taken", NICKNAME_MESSAGES.nickname_taken);
      }
      throw err;
    }
    const body: PlayerInfo = { id: player.id, nickname };
    return c.json(body);
  });

  return r;
}
