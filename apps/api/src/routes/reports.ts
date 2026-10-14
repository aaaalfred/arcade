import { ReportBody } from "@arcade/protocol";
import { Hono } from "hono";
import type { AppEnv, Ctx } from "../context";
import { ApiError, playerNotFound } from "../errors";
import { parseWith, readJson } from "../http";

export function reportsRoutes(ctx: Ctx): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  /** Reportar un apodo/jugador (requisito de contenido generado por usuarios). Idempotente por (reportante, objetivo). */
  r.post("/reports", ctx.requirePlayer, async (c) => {
    const reporter = c.get("player");
    const { targetPlayerId, reason } = parseWith(ReportBody, await readJson(c));
    if (targetPlayerId === reporter.id) {
      throw new ApiError(400, "invalid_report", "No puedes reportarte a ti mismo.");
    }

    const target = (await ctx.db.query<{ nickname: string }>("SELECT nickname FROM players WHERE id = $1", [targetPlayerId]))[0];
    if (!target) throw playerNotFound();

    await ctx.db.query(
      `INSERT INTO reports (reporter_id, target_id, target_nickname, reason, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (reporter_id, target_id) DO NOTHING`,
      [reporter.id, targetPlayerId, target.nickname, reason.trim(), ctx.now().toISOString()],
    );
    return c.json({ ok: true });
  });

  return r;
}
