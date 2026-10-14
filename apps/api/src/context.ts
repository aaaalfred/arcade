import type { Manifest } from "@arcade/protocol";
import type { MiddlewareHandler } from "hono";
import type { Config } from "./config";
import type { Db } from "./db";
import type { RateLimiter } from "./ratelimit";

export interface AuthedPlayer {
  id: string;
  nickname: string;
  hidden: boolean;
}

/** Variables que `requirePlayer` deja en el contexto de Hono. */
export type AppEnv = { Variables: { player: AuthedPlayer } };

/** Dependencias compartidas por todas las rutas. */
export interface Ctx {
  db: Db;
  catalog: Map<string, Manifest>;
  config: Config;
  now: () => Date;
  limiters: { register: RateLimiter; score: RateLimiter };
  requirePlayer: MiddlewareHandler<AppEnv>;
}
