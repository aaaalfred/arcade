import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import type { Manifest } from "@arcade/protocol";
import type { Hono } from "hono";
import { createApp } from "./app";
import { loadCatalog } from "./catalog";
import type { Config } from "./config";
import type { Db } from "./db";
import { migrate } from "./db/migrate";
import { createPg } from "./db/pg";
import { createPglite } from "./db/pglite";

export interface RunningServer {
  app: Hono;
  db: Db;
  catalog: Map<string, Manifest>;
  config: Config;
  /** Puerto real (útil con `port: 0`). */
  port: number;
  /** Cierra el servidor HTTP y la base de datos. Idempotente. */
  close(): Promise<void>;
}

/** Cuánto esperar a que terminen las peticiones en curso antes de cortar las conexiones. */
const GRACE_MS = 10_000;

async function openDb(config: Config, log: (msg: string) => void): Promise<Db> {
  if (config.dbMemory) {
    log("Base de datos: PGlite EN MEMORIA (los datos se pierden al parar; solo para E2E/pruebas)");
    return createPglite();
  }
  if (config.databaseUrl) {
    log("Base de datos: Postgres (DATABASE_URL)");
    return createPg(config.databaseUrl);
  }
  if (config.production) log("AVISO: sin DATABASE_URL se usa PGlite en disco; en producción se recomienda Postgres");
  log(`Base de datos: PGlite en ${config.pgliteDir}`);
  return createPglite(config.pgliteDir);
}

/** Abre la base de datos, migra, carga el catálogo y empieza a escuchar. */
export async function startServer(config: Config, opts: { log?: (msg: string) => void } = {}): Promise<RunningServer> {
  const log = opts.log ?? ((msg: string) => console.log(`[api] ${msg}`));

  const db = await openDb(config, log);
  let server: Server | undefined;
  try {
    await migrate(db);

    // En producción un GAMES_DIR inexistente es un error de despliegue; en desarrollo se arranca con catálogo vacío.
    const catalog = await loadCatalog(config.gamesDir, { includeDev: config.includeDevGames, allowMissing: !config.production });
    log(`Catálogo: ${catalog.size} juego(s) desde ${config.gamesDir}${config.includeDevGames ? " (incluye juegos dev)" : ""}`);
    if (catalog.size === 0) log("AVISO: el catálogo está vacío; todas las rutas de juegos devolverán 404");

    const app = createApp({ db, catalog, config });

    const port = await new Promise<number>((resolve, reject) => {
      const s = serve({ fetch: app.fetch, port: config.port }, (info) => resolve(info.port)) as unknown as Server;
      server = s;
      s.once("error", reject);
    });
    log(
      `Escuchando en el puerto ${port} · CORS extra: ${config.corsOrigins.length} · TRUST_PROXY=${config.trustProxy ? 1 : 0} · ` +
        `moderación ${config.adminToken ? "activada" : "desactivada"}`,
    );

    let closing: Promise<void> | undefined;
    const close = () =>
      (closing ??= (async () => {
        const srv = server!;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => srv.closeAllConnections(), GRACE_MS);
          timer.unref();
          srv.close(() => {
            clearTimeout(timer);
            resolve();
          });
          srv.closeIdleConnections();
        });
        await db.close();
      })());

    return { app, db, catalog, config, port: (server!.address() as AddressInfo | null)?.port ?? port, close };
  } catch (err) {
    server?.close();
    await db.close().catch(() => {});
    throw err;
  }
}
