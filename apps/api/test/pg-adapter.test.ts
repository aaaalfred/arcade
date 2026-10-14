import { describe, expect, it } from "vitest";
import { createPg } from "../src/db/pg";

/** Pool falso que registra las sentencias; comprueba la semántica de transacciones del adaptador `pg`. */
function fakePool(failOn?: string) {
  const log: string[] = [];
  let released = 0;
  const client = {
    async query(sql: string, params?: unknown[]) {
      log.push(params ? `${sql} ${JSON.stringify(params)}` : sql);
      if (failOn && sql.includes(failOn)) throw new Error("fallo simulado");
      return { rows: [{ ok: 1 }] };
    },
    release() {
      released += 1;
    },
  };
  const pool = {
    async query(sql: string, params?: unknown[]) {
      log.push(`pool:${sql} ${JSON.stringify(params ?? [])}`);
      return { rows: [{ ok: 1 }] };
    },
    async connect() {
      return client;
    },
    async end() {
      log.push("end");
    },
    on() {
      return pool;
    },
  };
  return { pool, log, released: () => released };
}

describe("createPg (adaptador de pg)", () => {
  it("query usa el pool con parámetros", async () => {
    const f = fakePool();
    const db = createPg("postgres://x", { pool: f.pool as any });
    expect(await db.query("SELECT $1", [1])).toEqual([{ ok: 1 }]);
    expect(f.log).toEqual(["pool:SELECT $1 [1]"]);
  });

  it("tx hace BEGIN/COMMIT en una sola conexión y la libera", async () => {
    const f = fakePool();
    const db = createPg("postgres://x", { pool: f.pool as any });
    const out = await db.tx(async (t) => {
      await t.query("INSERT 1");
      await t.tx(async (t2) => {
        await t2.query("INSERT 2"); // tx anidada: mismo cliente, sin BEGIN extra
      });
      return 42;
    });
    expect(out).toBe(42);
    expect(f.log).toEqual(["BEGIN", "INSERT 1", "INSERT 2", "COMMIT"]);
    expect(f.released()).toBe(1);
  });

  it("tx hace ROLLBACK si la función lanza, relanza el error y libera la conexión", async () => {
    const f = fakePool();
    const db = createPg("postgres://x", { pool: f.pool as any });
    await expect(
      db.tx(async (t) => {
        await t.query("INSERT 1");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(f.log).toEqual(["BEGIN", "INSERT 1", "ROLLBACK"]);
    expect(f.released()).toBe(1);
  });

  it("close cierra el pool", async () => {
    const f = fakePool();
    await createPg("postgres://x", { pool: f.pool as any }).close();
    expect(f.log).toEqual(["end"]);
  });
});
