import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const shellDir = fileURLToPath(new URL("..", import.meta.url));
const API = "http://localhost:8787";
const SHELL = "http://localhost:4173";

/** Sondea con timeout corto por intento: en algunos entornos (p. ej. WSL) un puerto cerrado no rechaza, se cuelga. */
async function waitFor(url: string, name: string, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
    } catch {
      /* aún no está */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${name} no respondió en ${url} tras ${ms / 1000} s`);
}

function start(cmd: string, args: string[], cwd: string, env: Record<string, string>): ChildProcess {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.resume();
  child.stderr?.on("data", (d) => process.stderr.write(`[e2e] ${d}`));
  return child;
}

/**
 * Arranca la API (siempre de cero: sus límites viven en el proceso) y el shell construido.
 * Devuelve el "teardown" que Playwright ejecuta al terminar.
 */
export default async function globalSetup() {
  const env = { VITE_API_URL: API, VITE_INCLUDE_DEV_GAMES: "1", VITE_SIM_AD_MS: "300", VITE_CONFIG_NATIVE_IGNORE_WARNING: "true" };
  execFileSync("pnpm", ["build"], { cwd: shellDir, env: { ...process.env, ...env }, stdio: "ignore" });

  const api = start("pnpm", ["--filter", "@arcade/api", "exec", "tsx", "src/server.ts"], root, {
    DB_MEMORY: "1", INCLUDE_DEV_GAMES: "1", PORT: "8787",
  });
  const shell = start("pnpm", ["preview", "--strictPort"], shellDir, env);

  const stop = () => {
    for (const c of [api, shell]) {
      try {
        if (c.pid) process.kill(-c.pid, "SIGTERM");
      } catch {
        /* ya terminó */
      }
    }
  };
  try {
    await Promise.all([waitFor(`${API}/v1/health`, "API"), waitFor(SHELL, "shell")]);
  } catch (e) {
    stop();
    throw e;
  }
  return stop;
}
