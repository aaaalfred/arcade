import type { Manifest } from "@arcade/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createRequirePlayer } from "./auth";
import type { Config } from "./config";
import type { Ctx } from "./context";
import type { Db } from "./db";
import { ApiError } from "./errors";
import { createRateLimiter } from "./ratelimit";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { boardsRoutes } from "./routes/boards";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { reportsRoutes } from "./routes/reports";
import { savesRoutes } from "./routes/saves";
import { scoresRoutes } from "./routes/scores";

export interface AppDeps {
  db: Db;
  catalog: Map<string, Manifest>;
  config: Config;
  /** Reloj inyectable (tests): fija marcas de tiempo, semanas de ranking y límites de ritmo. */
  now?: () => Date;
}

/** WebViews de Capacitor: Android sirve la app desde https://localhost, iOS desde capacitor://localhost. */
const CAPACITOR_ORIGINS = ["https://localhost", "capacitor://localhost"];
const DEV_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

export function isAllowedOrigin(origin: string, config: Pick<Config, "corsOrigins" | "production">): boolean {
  if (CAPACITOR_ORIGINS.includes(origin)) return true;
  if (config.corsOrigins.includes(origin)) return true;
  return !config.production && DEV_ORIGIN.test(origin);
}

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Construye la app Hono con todo montado bajo `/v1`. */
export function createApp(deps: AppDeps): Hono {
  const now = deps.now ?? (() => new Date());
  const clock = () => now().getTime();

  const ctx: Ctx = {
    db: deps.db,
    catalog: deps.catalog,
    config: deps.config,
    now,
    limiters: {
      // Antiabuso (spec §7): 10 registros/h/IP y 30 envíos de puntaje/min/jugador.
      register: createRateLimiter({ limit: 10, windowMs: HOUR_MS, now: clock }),
      score: createRateLimiter({ limit: 30, windowMs: MINUTE_MS, now: clock }),
    },
    requirePlayer: createRequirePlayer({ db: deps.db, now }),
  };

  const app = new Hono();

  app.use("*", async (c, next) => {
    // Datos privados por jugador: nada de cachés intermedias.
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    await next();
  });

  app.use(
    "*",
    cors({
      origin: (origin) => (origin && isAllowedOrigin(origin, deps.config) ? origin : null),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      exposeHeaders: ["Retry-After"],
      maxAge: 600,
    }),
  );

  const v1 = new Hono();
  v1.route("/", healthRoutes());
  v1.route("/", authRoutes(ctx));
  v1.route("/", meRoutes(ctx));
  v1.route("/", savesRoutes(ctx));
  v1.route("/", scoresRoutes(ctx));
  v1.route("/", boardsRoutes(ctx));
  v1.route("/", reportsRoutes(ctx));
  v1.route("/admin", adminRoutes(ctx));
  app.route("/v1", v1);

  app.notFound((c) => c.json({ error: "not_found", message: "Ruta no encontrada." }, 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      for (const [k, v] of Object.entries(err.headers)) c.header(k, v);
      return c.json({ error: err.code, message: err.message, ...err.extra }, err.status);
    }
    // Error no previsto: se registra para el operador pero al cliente no se le cuenta nada interno.
    console.error("[api] error no controlado:", err);
    return c.json({ error: "internal", message: "Error interno del servidor." }, 500);
  });

  return app;
}
