import { mkdir } from "node:fs/promises";
import type { Db } from "./index";

interface Queryable {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

function wrap(q: Queryable, tx: Db["tx"], close: () => Promise<void>): Db {
  return {
    async query<T = any>(sql: string, params?: unknown[]) {
      const res = await q.query<T>(sql, params);
      return res.rows;
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
    tx,
    close,
  };
}

/** Postgres real en proceso (WASM). En memoria si no se pasa `dataDir`. */
export async function createPglite(dataDir?: string): Promise<Db> {
  // Import dinámico: con DATABASE_URL (producción) ni siquiera se carga el WASM.
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) await mkdir(dataDir, { recursive: true });
  const pg = await PGlite.create(dataDir);

  const inTx = (q: Queryable): Db => {
    const db: Db = wrap(q, (fn) => fn(db), async () => {});
    return db;
  };
  return wrap(
    pg as unknown as Queryable,
    (fn) => pg.transaction((t) => fn(inTx(t as unknown as Queryable))),
    () => pg.close(),
  );
}
