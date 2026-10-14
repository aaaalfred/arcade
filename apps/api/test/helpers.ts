import { randomBytes, randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { parseManifest, type Manifest } from "@arcade/protocol";
import { createApp } from "../src/app";
import { hashSecret } from "../src/auth";
import { defaultConfig, type Config } from "../src/config";
import type { Db } from "../src/db";
import { migrate } from "../src/db/migrate";
import { createPglite } from "../src/db/pglite";
import { nicknameKey } from "../src/nickname";

/** Reloj controlable que se inyecta como `now` en la app. */
export class Clock {
  private t: number;
  constructor(private readonly start: string) {
    this.t = Date.parse(start);
  }
  now = (): Date => new Date(this.t);
  set(value: string | Date): void {
    this.t = typeof value === "string" ? Date.parse(value) : value.getTime();
  }
  advance(ms: number): void {
    this.t += ms;
  }
  reset(): void {
    this.t = Date.parse(this.start);
  }
}

export function makeManifest(overrides: Record<string, unknown> = {}): Manifest {
  return parseManifest({
    id: "tap-game",
    name: "Tap Game",
    version: "1.2.3",
    sdk: 1,
    theme: { accent: "#3f8a52", background: "#f3f7f1", ink: "#2e473f" },
    icon: "🎮",
    progress: { unit: "niveles", total: 10 },
    boards: [
      { id: "taps", name: "Toques", sort: "desc", min: 0, max: 100000, integer: true },
      { id: "fastest", name: "Más rápido", sort: "asc", min: 1, max: 600, integer: false, unit: "s" },
      { id: "stars", name: "Estrellas", sort: "desc", min: 1, max: 30, integer: true, unit: "★" },
    ],
    ...overrides,
  });
}

export function makeCatalog(): Map<string, Manifest> {
  const a = makeManifest();
  const b = makeManifest({ id: "other-game", name: "Otro", boards: [{ id: "taps", name: "Toques", sort: "desc", max: 1000 }] });
  const dev = makeManifest({ id: "dev-game", name: "Dev", dev: true, boards: [] });
  return new Map([a, b, dev].map((m) => [m.id, m]));
}

export interface Harness {
  db: Db;
  clock: Clock;
  config: Config;
  catalog: Map<string, Manifest>;
  app: Hono<any>;
  /** Vacía las tablas, reinicia el reloj y crea una app nueva (límites de ritmo limpios). */
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function createHarness(
  opts: { config?: Partial<Config>; catalog?: Map<string, Manifest>; start?: string } = {},
): Promise<Harness> {
  const db = await createPglite();
  await migrate(db);
  const clock = new Clock(opts.start ?? "2026-10-14T12:00:00.000Z");
  const config = defaultConfig({ trustProxy: true, ...opts.config });
  const catalog = opts.catalog ?? makeCatalog();
  const h: Harness = {
    db,
    clock,
    config,
    catalog,
    app: createApp({ db, catalog, config, now: clock.now }),
    async reset() {
      await db.query("TRUNCATE players CASCADE");
      clock.reset();
      h.app = createApp({ db, catalog, config, now: clock.now });
    },
    close: () => db.close(),
  };
  return h;
}

export interface CallOptions {
  token?: string;
  body?: unknown;
  /** Cuerpo en crudo (para JSON inválido o números que `JSON.stringify` no puede producir). */
  raw?: string;
  headers?: Record<string, string>;
  ip?: string;
}
export interface CallResult {
  status: number;
  json: any;
  text: string;
  headers: Headers;
}

export async function call(h: Harness, method: string, path: string, o: CallOptions = {}): Promise<CallResult> {
  const headers = new Headers(o.headers);
  if (o.token) headers.set("authorization", `Bearer ${o.token}`);
  if (o.ip) headers.set("x-forwarded-for", o.ip);
  let body: string | undefined = o.raw;
  if (o.body !== undefined) body = JSON.stringify(o.body);
  if (body !== undefined) headers.set("content-type", "application/json");
  const res = await h.app.request(path, { method, headers, body });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* no es JSON */
  }
  return { status: res.status, json, text, headers: res.headers };
}

export interface Player {
  id: string;
  secret: string;
  token: string;
  nickname: string;
}

let ipSeq = 0;
/** Registra por la API (cada llamada con una IP distinta para no chocar con el límite de registros). */
export async function register(h: Harness, ip?: string): Promise<Player> {
  ipSeq += 1;
  const res = await call(h, "POST", "/v1/auth/anonymous", { ip: ip ?? `10.1.${(ipSeq >> 8) & 255}.${ipSeq & 255}` });
  if (res.status !== 201) throw new Error(`registro falló: ${res.status} ${res.text}`);
  const { playerId, secret, nickname } = res.json;
  return { id: playerId, secret, token: `${playerId}.${secret}`, nickname };
}

let seedSeq = 0;
/** Inserta un jugador directamente en la base (rápido, para escenarios con muchos jugadores). */
export async function seedPlayer(h: Harness, nickname?: string, opts: { hidden?: boolean } = {}): Promise<Player> {
  seedSeq += 1;
  const id = `seed-${seedSeq}-${randomUUID().slice(0, 8)}`;
  const secret = randomBytes(24).toString("base64url");
  const nick = nickname ?? `Seed${seedSeq}`;
  await h.db.query(
    `INSERT INTO players (id, token_hash, nickname, nickname_ci, hidden, created_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [id, hashSecret(secret), nick, nicknameKey(nick), opts.hidden ?? false, h.clock.now().toISOString()],
  );
  return { id, secret, token: `${id}.${secret}`, nickname: nick };
}
