import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "./context";
import type { Db } from "./db";
import { unauthorized } from "./errors";

/** SHA-256 en hexadecimal: lo único del secreto que se guarda en la base de datos. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Secreto opaco de 256 bits en base64url (sin '.', que separa playerId y secreto). */
export function generateSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** Comparación en tiempo constante del hash del secreto presentado con el guardado. */
export function verifySecret(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashSecret(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** `Authorization: Bearer <playerId>.<secret>` */
export function parseBearer(header: string | undefined): { playerId: string; secret: string } | null {
  if (!header) return null;
  const m = /^Bearer ([^ ]+)$/i.exec(header.trim());
  if (!m) return null;
  const token = m[1]!;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const playerId = token.slice(0, dot);
  const secret = token.slice(dot + 1);
  if (!ID_RE.test(playerId) || !SECRET_RE.test(secret)) return null;
  return { playerId, secret };
}

/** Hash de relleno para que "jugador inexistente" tarde lo mismo que "secreto erróneo". */
const DUMMY_HASH = hashSecret("arcade-dummy-secret");
const LAST_SEEN_INTERVAL_MS = 60_000;

interface PlayerRow {
  id: string;
  token_hash: string;
  nickname: string;
  hidden: boolean;
  last_seen_at: Date;
}

/** Middleware `requirePlayer`: exige credenciales válidas y refresca `last_seen_at` como máximo 1 vez por minuto. */
export function createRequirePlayer(deps: { db: Db; now: () => Date }) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const cred = parseBearer(c.req.header("authorization"));
    if (!cred) throw unauthorized();

    const rows = await deps.db.query<PlayerRow>(
      "SELECT id, token_hash, nickname, hidden, last_seen_at FROM players WHERE id = $1",
      [cred.playerId],
    );
    const row = rows[0];
    const valid = verifySecret(cred.secret, row?.token_hash ?? DUMMY_HASH);
    if (!row || !valid) throw unauthorized();

    const now = deps.now();
    if (now.getTime() - new Date(row.last_seen_at).getTime() >= LAST_SEEN_INTERVAL_MS) {
      await deps.db.query("UPDATE players SET last_seen_at = $2 WHERE id = $1", [row.id, now.toISOString()]);
    }
    c.set("player", { id: row.id, nickname: row.nickname, hidden: row.hidden });
    await next();
  });
}
