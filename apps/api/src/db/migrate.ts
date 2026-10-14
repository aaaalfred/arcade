import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Db } from "./index";

/**
 * Carpeta de migraciones. En desarrollo/tests vive junto a este archivo (`src/db/migrations`);
 * en el build de tsup se copia a `dist/migrations`, que queda junto a `dist/server.js`.
 */
function defaultMigrationsDir(): string {
  const candidates = [new URL("./migrations/", import.meta.url), new URL("./db/migrations/", import.meta.url)];
  for (const url of candidates) {
    const dir = fileURLToPath(url);
    if (existsSync(dir)) return dir;
  }
  throw new Error(`No se encontró la carpeta de migraciones (probé: ${candidates.map((u) => fileURLToPath(u)).join(", ")})`);
}

/** Clave del candado consultivo que serializa migraciones concurrentes entre instancias. */
const MIGRATION_LOCK = 727_274;

/**
 * Aplica por orden alfabético los `*.sql` pendientes, cada uno en su propia transacción,
 * y los registra en `schema_migrations`. Idempotente.
 */
export async function migrate(db: Db, opts: { dir?: string } = {}): Promise<void> {
  const dir = opts.dir ?? defaultMigrationsDir();
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );

  for (const file of files) {
    const sql = await readFile(`${dir}/${file}`, "utf8");
    await db.tx(async (t) => {
      await t.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK]);
      const done = await t.query("SELECT 1 FROM schema_migrations WHERE version = $1", [file]);
      if (done.length > 0) return;
      await t.exec(sql);
      await t.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
    });
  }
}
