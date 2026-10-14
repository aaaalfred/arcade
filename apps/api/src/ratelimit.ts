export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export interface RateLimiter {
  /** Registra un intento de `key`. Los rechazados no se cuentan (no alargan el bloqueo). */
  hit(key: string): RateLimitResult;
  /** Elimina las claves cuyos intentos ya caducaron. */
  prune(): void;
  /** Número de claves en memoria (para pruebas). */
  size(): number;
}

/** Límite de ventana deslizante en memoria. `now` (ms) se inyecta para poder probarlo sin esperas. */
export function createRateLimiter(opts: { limit: number; windowMs: number; now: () => number }): RateLimiter {
  const { limit, windowMs, now } = opts;
  const hits = new Map<string, number[]>();
  let sinceLastPrune = 0;

  const fresh = (list: number[], t: number) => {
    let i = 0;
    while (i < list.length && list[i]! <= t - windowMs) i++;
    if (i > 0) list.splice(0, i);
    return list;
  };

  const prune = () => {
    const t = now();
    for (const [key, list] of hits) {
      if (fresh(list, t).length === 0) hits.delete(key);
    }
  };

  return {
    hit(key) {
      const t = now();
      if (++sinceLastPrune >= 1000) {
        sinceLastPrune = 0;
        prune();
      }
      const list = fresh(hits.get(key) ?? [], t);
      if (list.length >= limit) {
        hits.set(key, list);
        const retryMs = list[0]! + windowMs - t;
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)) };
      }
      list.push(t);
      hits.set(key, list);
      return { ok: true };
    },
    prune,
    size: () => hits.size,
  };
}
