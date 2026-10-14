import { randomUUID } from "node:crypto";
import type { AuthResponse } from "@arcade/protocol";
import { Hono } from "hono";
import { generateSecret, hashSecret } from "../auth";
import type { Ctx } from "../context";
import { rateLimited } from "../errors";
import { clientIp } from "../http";
import { generateNickname, nicknameKey } from "../nickname";

const MAX_NICKNAME_ATTEMPTS = 12;

export function authRoutes(ctx: Ctx): Hono {
  const r = new Hono();

  /** Crea una cuenta anónima: el servidor emite playerId + secreto (solo se guarda el hash). */
  r.post("/auth/anonymous", async (c) => {
    const limit = ctx.limiters.register.hit(clientIp(c, ctx.config));
    if (!limit.ok) {
      throw rateLimited(limit.retryAfterSec, "Demasiados registros desde esta red. Inténtalo de nuevo más tarde.");
    }

    const secret = generateSecret();
    const id = randomUUID();
    const nowIso = ctx.now().toISOString();

    // Jugador#### colisiona poco, pero el apodo es único: si choca se reintenta (y se amplían los dígitos).
    for (let attempt = 0; attempt < MAX_NICKNAME_ATTEMPTS; attempt++) {
      const nickname = generateNickname(Math.random, attempt < 8 ? 4 : 8);
      const rows = await ctx.db.query(
        `INSERT INTO players (id, token_hash, nickname, nickname_ci, created_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $5)
         ON CONFLICT (nickname_ci) DO NOTHING
         RETURNING id`,
        [id, hashSecret(secret), nickname, nicknameKey(nickname), nowIso],
      );
      if (rows.length > 0) {
        const body: AuthResponse = { playerId: id, secret, nickname };
        return c.json(body, 201);
      }
    }
    throw new Error("No se pudo asignar un apodo único tras varios intentos");
  });

  return r;
}
