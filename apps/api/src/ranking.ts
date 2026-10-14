import type { Board } from "@arcade/protocol";
import type { Db } from "./db";

export interface RankedEntry {
  rank: number;
  playerId: string;
  nickname: string;
  value: number;
}

interface Where {
  gameId: string;
  boardId: string;
  /** 'all' o semana ISO ('2026-W41') */
  period: string;
  sort: Board["sort"];
}

/*
 * Orden TOTAL del ranking: valor (según `sort`), luego `achieved_at` ascendente (quien llegó antes va primero) y,
 * por último, `player_id` para que dos filas nunca empaten. Así los rangos son consecutivos y coinciden en todas
 * las consultas. Los jugadores `hidden` ni aparecen ni cuentan. Las direcciones salen de una lista fija, nunca
 * de la entrada del usuario; los valores siempre van como parámetros.
 */

/** Top `limit` del tablero, ya con el rango asignado (1, 2, 3…). */
export async function topEntries(db: Db, w: Where & { limit: number }): Promise<RankedEntry[]> {
  const dir = w.sort === "asc" ? "ASC" : "DESC";
  const rows = await db.query<{ player_id: string; nickname: string; value: number }>(
    `SELECT s.player_id, p.nickname, s.value
       FROM scores s JOIN players p ON p.id = s.player_id
      WHERE s.game_id = $1 AND s.board_id = $2 AND s.period = $3 AND NOT p.hidden
      ORDER BY s.value ${dir}, s.achieved_at ASC, s.player_id ASC
      LIMIT $4`,
    [w.gameId, w.boardId, w.period, w.limit],
  );
  return rows.map((r, i) => ({ rank: i + 1, playerId: r.player_id, nickname: r.nickname, value: Number(r.value) }));
}

/**
 * Valor y posición de un jugador en el tablero (aunque esté fuera del top, y aunque esté oculto: en ese caso se
 * calcula entre los visibles). `null` si no tiene puntaje en ese periodo.
 * rank = 1 + visibles con mejor valor, o igual valor y logrado antes.
 */
export async function playerStanding(db: Db, w: Where & { playerId: string }): Promise<{ rank: number; value: number } | null> {
  const better = w.sort === "asc" ? "<" : ">";
  const rows = await db.query<{ value: number; pos: number }>(
    `SELECT m.value AS value,
            1 + (SELECT COUNT(*)::int
                   FROM scores s JOIN players p ON p.id = s.player_id
                  WHERE s.game_id = m.game_id AND s.board_id = m.board_id AND s.period = m.period AND NOT p.hidden
                    AND (s.value ${better} m.value
                         OR (s.value = m.value AND (s.achieved_at < m.achieved_at
                              OR (s.achieved_at = m.achieved_at AND s.player_id < m.player_id))))) AS pos
       FROM scores m
      WHERE m.player_id = $1 AND m.game_id = $2 AND m.board_id = $3 AND m.period = $4`,
    [w.playerId, w.gameId, w.boardId, w.period],
  );
  const row = rows[0];
  return row ? { rank: Number(row.pos), value: Number(row.value) } : null;
}
