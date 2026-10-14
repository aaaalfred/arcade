import { startServer } from "./bootstrap";
import { loadConfig } from "./config";

async function main(): Promise<void> {
  const config = loadConfig();
  const running = await startServer(config);

  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`[api] ${signal} recibido: cerrando…`);
    // Último recurso si algo se queda colgado.
    setTimeout(() => process.exit(1), 20_000).unref();
    running.close().then(
      () => process.exit(0),
      (err) => {
        console.error("[api] error al cerrar:", err);
        process.exit(1);
      },
    );
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  // Mensaje claro, sin traza, para errores de configuración o de arranque previstos.
  console.error("[api] no se pudo arrancar:", err instanceof Error ? err.message : err);
  process.exit(1);
});
