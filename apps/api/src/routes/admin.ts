import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Ctx } from "../context";
import { ApiError, playerNotFound, unauthorized } from "../errors";

/** Comparación en tiempo constante (y de longitud fija: se comparan los SHA-256). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function adminRoutes(ctx: Ctx): Hono {
  const r = new Hono();

  r.use(
    "*",
    createMiddleware(async (c, next) => {
      const expected = ctx.config.adminToken;
      // Sin ADMIN_TOKEN la moderación está apagada y las rutas ni existen.
      if (!expected) throw new ApiError(404, "not_found", "Ruta no encontrada.");
      if (!safeEqual(c.req.header("x-admin-token") ?? "", expected)) throw unauthorized();
      await next();
    }),
  );

  const setHidden = (hidden: boolean) => async (c: import("hono").Context) => {
    const rows = await ctx.db.query("UPDATE players SET hidden = $2 WHERE id = $1 RETURNING id", [c.req.param("id"), hidden]);
    if (rows.length === 0) throw playerNotFound();
    return c.json({ ok: true, hidden });
  };
  r.post("/players/:id/hide", setHidden(true));
  r.post("/players/:id/unhide", setHidden(false));

  r.get("/reports", async (c) => {
    const rows = await ctx.db.query<{
      id: number;
      reporter_id: string;
      reporter_nickname: string;
      target_id: string;
      target_nickname: string;
      target_nickname_at_report: string;
      target_hidden: boolean;
      reason: string;
      created_at: Date | string;
    }>(
      `SELECT r.id::int AS id, r.reporter_id, rp.nickname AS reporter_nickname,
              r.target_id, tp.nickname AS target_nickname, r.target_nickname AS target_nickname_at_report,
              tp.hidden AS target_hidden, r.reason, r.created_at
         FROM reports r
         JOIN players rp ON rp.id = r.reporter_id
         JOIN players tp ON tp.id = r.target_id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 200`,
    );
    return c.json(
      rows.map((x) => ({
        id: x.id,
        reporterId: x.reporter_id,
        reporterNickname: x.reporter_nickname,
        targetId: x.target_id,
        targetNickname: x.target_nickname,
        targetNicknameAtReport: x.target_nickname_at_report,
        targetHidden: x.target_hidden,
        reason: x.reason,
        createdAt: new Date(x.created_at).toISOString(),
      })),
    );
  });

  return r;
}
