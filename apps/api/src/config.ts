import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export interface Config {
  port: number;
  /** Si existe, se usa Postgres real con `pg`. */
  databaseUrl: string | undefined;
  /** Carpeta de datos de PGlite cuando no hay `DATABASE_URL` ni `DB_MEMORY`. */
  pgliteDir: string;
  /** PGlite en memoria (E2E y tests de integración). Tiene prioridad sobre `pgliteDir`. */
  dbMemory: boolean;
  gamesDir: string;
  includeDevGames: boolean;
  adminToken: string | undefined;
  /** Orígenes extra permitidos por CORS (los de Capacitor siempre lo están). */
  corsOrigins: string[];
  /** Si es true, la IP del cliente es el primer valor de `x-forwarded-for`. */
  trustProxy: boolean;
  /** `NODE_ENV=production`: desactiva los orígenes `http://localhost:*` de desarrollo. */
  production: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const flag = (name: string) =>
  z.enum(["0", "1", "true", "false"], { error: `${name} debe ser 0, 1, true o false` }).transform((v) => v === "1" || v === "true");

const Origin = z.string().transform((raw, ctx) => {
  try {
    const u = new URL(raw);
    if (!u.host && !u.hostname) throw new Error("sin host");
    return u.origin === "null" ? `${u.protocol}//${u.host}` : u.origin; // esquemas no estándar (capacitor://)
  } catch {
    ctx.addIssue({ code: "custom", message: `«${raw}» no es un origen válido (p. ej. https://app.ejemplo.com)` });
    return z.NEVER;
  }
});

const EnvSchema = z.object({
  PORT: z.coerce
    .number({ error: "PORT debe ser un número" })
    .int("PORT debe ser un entero")
    .min(1, "PORT fuera de rango (1–65535)")
    .max(65535, "PORT fuera de rango (1–65535)")
    .default(8787),
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().optional(),
  DB_MEMORY: flag("DB_MEMORY").default(false),
  GAMES_DIR: z.string().optional(),
  INCLUDE_DEV_GAMES: flag("INCLUDE_DEV_GAMES").default(false),
  ADMIN_TOKEN: z.string().min(16, "ADMIN_TOKEN debe tener al menos 16 caracteres").optional(),
  CORS_ORIGINS: z.array(Origin).default([]),
  TRUST_PROXY: flag("TRUST_PROXY").default(false),
  NODE_ENV: z.string().optional(),
});

/** Carpeta del módulo actual: `src/` (tsx, vitest) o `dist/` (build). */
function moduleDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

/**
 * Localiza la carpeta `games/` sin depender de desde dónde se lanza el proceso:
 * junto al cwd (Docker: /app/games), dos niveles arriba del cwd (`pnpm --filter @arcade/api dev`
 * ⇒ cwd = apps/api) o relativa al código (src/ o dist/ de apps/api).
 */
function findGamesDir(cwd: string): string {
  const here = moduleDir();
  const candidates = [
    path.resolve(cwd, "games"),
    path.resolve(cwd, "../../games"),
    path.resolve(here, "../games"),
    path.resolve(here, "../../../games"),
    path.resolve(here, "../../../../games"),
  ];
  return candidates.find((c) => existsSync(c)) ?? path.resolve(cwd, "../../games");
}

/** Convierte "" en undefined para que `ADMIN_TOKEN=` en un .env cuente como no definido. */
function clean(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) out[k] = v === undefined || v.trim() === "" ? undefined : v.trim();
  return out;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, opts: { cwd?: string } = {}): Config {
  const cwd = opts.cwd ?? process.cwd();
  const e = clean(env);
  const parsed = EnvSchema.safeParse({
    ...e,
    CORS_ORIGINS: e.CORS_ORIGINS ? e.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
  });
  if (!parsed.success) {
    const detalle = parsed.error.issues.map((i) => `${i.path.join(".") || "(env)"}: ${i.message}`).join("; ");
    throw new ConfigError(`Configuración inválida: ${detalle}`);
  }
  const v = parsed.data;
  return {
    port: v.PORT,
    databaseUrl: v.DATABASE_URL,
    pgliteDir: path.resolve(cwd, v.PGLITE_DIR ?? ".data/pglite"),
    dbMemory: v.DB_MEMORY,
    gamesDir: v.GAMES_DIR ? path.resolve(cwd, v.GAMES_DIR) : findGamesDir(cwd),
    includeDevGames: v.INCLUDE_DEV_GAMES,
    adminToken: v.ADMIN_TOKEN,
    corsOrigins: [...new Set(v.CORS_ORIGINS)],
    trustProxy: v.TRUST_PROXY,
    production: v.NODE_ENV === "production",
  };
}

/** Configuración de pruebas: valores por defecto sin leer el entorno. */
export function defaultConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 8787,
    databaseUrl: undefined,
    pgliteDir: path.resolve(".data/pglite"),
    dbMemory: true,
    gamesDir: path.resolve("games"),
    includeDevGames: false,
    adminToken: undefined,
    corsOrigins: [],
    trustProxy: false,
    production: false,
    ...overrides,
  };
}
