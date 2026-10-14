import pg from "pg";
import type { Db } from "./index";

interface PoolLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
  connect(): Promise<ClientLike>;
  end(): Promise<void>;
  on(event: "error", fn: (err: Error) => void): unknown;
}
interface ClientLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
  release(err?: Error | boolean): void;
}

/** Postgres de producción mediante un pool de `pg`. `opts.pool` existe solo para pruebas. */
export function createPg(url: string, opts: { pool?: PoolLike } = {}): Db {
  const pool: PoolLike =
    opts.pool ?? (new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 }) as unknown as PoolLike);
  // Un error en un cliente inactivo no debe tumbar el proceso.
  pool.on("error", (err) => console.error("[db] error en cliente inactivo del pool:", err.message));

  const clientDb = (client: ClientLike): Db => {
    const db: Db = {
      async query<T = any>(sql: string, params?: unknown[]) {
        return (await client.query(sql, params)).rows as T[];
      },
      async exec(sql: string) {
        await client.query(sql);
      },
      tx: (fn) => fn(db), // ya estamos dentro de una transacción
      async close() {},
    };
    return db;
  };

  return {
    async query<T = any>(sql: string, params?: unknown[]) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query("BEGIN");
        const result = await fn(clientDb(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          broken = true; // la conexión quedó en mal estado: se descarta en vez de devolverla al pool
        }
        throw err;
      } finally {
        client.release(broken);
      }
    },
    close: () => pool.end(),
  };
}
