import { MAX_SAVE_BYTES, SaveBody, type SaveRecord, type SaveResult } from "@arcade/protocol";
import { Hono } from "hono";
import type { AppEnv, Ctx } from "../context";
import { dbErrorCode } from "../db";
import { ApiError, gameNotFound, invalidBody } from "../errors";
import { parseWith, readJson } from "../http";

/** Profundidad máxima del estado JSON (protege al parser de jsonb de Postgres). */
const MAX_STATE_DEPTH = 64;
/** Columna `integer`: tope del progreso. */
const MAX_PROGRESS = 2_147_483_647;

const saveTooLarge = () =>
  new ApiError(413, "save_too_large", `El estado del juego supera el máximo de ${MAX_SAVE_BYTES / 1024} KB.`);

interface SaveRow {
  game_id: string;
  rev: number;
  state: unknown;
  progress_value: number;
  progress_total: number | null;
  updated_at: Date | string;
}

function toRecord(row: SaveRow): SaveRecord {
  return {
    gameId: row.game_id,
    rev: row.rev,
    state: row.state,
    progress: row.progress_total === null ? { value: row.progress_value } : { value: row.progress_value, total: row.progress_total },
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function exceedsDepth(value: unknown, max: number): boolean {
  const stack: Array<[unknown, number]> = [[value, 1]];
  while (stack.length > 0) {
    const [v, depth] = stack.pop()!;
    if (typeof v !== "object" || v === null) continue;
    if (depth > max) return true;
    for (const child of Array.isArray(v) ? v : Object.values(v)) stack.push([child, depth + 1]);
  }
  return false;
}

/** `\u0000` escapado (no precedido por una barra escapada): Postgres lo rechaza en jsonb. */
const NUL_ESCAPE = /(?<!\\)(?:\\\\)*\\u0000/;

const COLUMNS = "game_id, rev, state, progress_value, progress_total, updated_at";

export function savesRoutes(ctx: Ctx): Hono<AppEnv> {
  const r = new Hono<AppEnv>();

  r.get("/saves", ctx.requirePlayer, async (c) => {
    const rows = await ctx.db.query<SaveRow>(`SELECT ${COLUMNS} FROM saves WHERE player_id = $1 ORDER BY game_id`, [c.get("player").id]);
    return c.json(rows.map(toRecord));
  });

  r.put("/games/:id/save", ctx.requirePlayer, async (c) => {
    const player = c.get("player");
    const gameId = c.req.param("id");
    if (!ctx.catalog.has(gameId)) throw gameNotFound();

    const body = parseWith(SaveBody, await readJson(c, { tooLarge: saveTooLarge }));
    const { state, progress, baseRev } = body;
    if (state === undefined) throw invalidBody("Falta el campo «state».");
    if (progress.value > MAX_PROGRESS || (progress.total ?? 0) > MAX_PROGRESS) {
      throw invalidBody("El progreso es demasiado grande.");
    }

    let json: string;
    try {
      json = JSON.stringify(state);
    } catch {
      throw invalidBody("El estado no se puede serializar.");
    }
    if (Buffer.byteLength(json) > MAX_SAVE_BYTES) throw saveTooLarge();
    if (NUL_ESCAPE.test(json)) throw invalidBody("El estado contiene caracteres no soportados.");
    if (exceedsDepth(state, MAX_STATE_DEPTH)) throw invalidBody("El estado está demasiado anidado.");

    const nowIso = ctx.now().toISOString();
    let result: SaveResult | { stale: SaveRecord };
    try {
      result = await ctx.db.tx(async (t) => {
        // Bucle acotado: solo se repite si otra petición crea o cambia la fila entre la lectura y la escritura.
        for (let attempt = 0; attempt < 3; attempt++) {
          const existing = (
            await t.query<SaveRow>(`SELECT ${COLUMNS} FROM saves WHERE player_id = $1 AND game_id = $2 FOR UPDATE`, [player.id, gameId])
          )[0];

          if (!existing) {
            const created = await t.query<SaveRow>(
              `INSERT INTO saves (player_id, game_id, rev, state, progress_value, progress_total, updated_at)
               VALUES ($1, $2, 1, $3::jsonb, $4, $5, $6)
               ON CONFLICT (player_id, game_id) DO NOTHING
               RETURNING ${COLUMNS}`,
              [player.id, gameId, json, progress.value, progress.total ?? null, nowIso],
            );
            if (created[0]) return { rev: 1, resolution: "created" as const, save: toRecord(created[0]) };
            continue;
          }

          // Mismo punto de partida ⇒ actualización normal. Si no, gana el mayor progreso (empate: la última escritura).
          const sameBase = baseRev === existing.rev;
          if (!sameBase && progress.value < existing.progress_value) return { stale: toRecord(existing) };

          const updated = await t.query<SaveRow>(
            `UPDATE saves
                SET rev = rev + 1, state = $3::jsonb, progress_value = $4, progress_total = $5, updated_at = $6
              WHERE player_id = $1 AND game_id = $2 AND rev = $7
          RETURNING ${COLUMNS}`,
            [player.id, gameId, json, progress.value, progress.total ?? null, nowIso, existing.rev],
          );
          if (updated[0]) return { rev: updated[0].rev, resolution: "updated" as const, save: toRecord(updated[0]) };
        }
        throw new Error("Conflicto de escritura repetido al guardar la partida");
      });
    } catch (err) {
      // 22P05/22P02: jsonb rechaza el texto (p. ej. sustituto Unicode suelto). Es entrada inválida, no un fallo nuestro.
      const code = dbErrorCode(err);
      if (code === "22P05" || code === "22P02") throw invalidBody("El estado contiene caracteres no soportados.");
      throw err;
    }

    if ("stale" in result) {
      throw new ApiError(
        409,
        "stale_save",
        "Hay un guardado más avanzado en el servidor; se conserva ese.",
        { resolution: "server-wins", save: result.stale },
      );
    }
    return c.json(result);
  });

  return r;
}
