import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer, type RunningServer } from "../src/bootstrap";
import { defaultConfig } from "../src/config";
import { makeManifest } from "./helpers";

const quiet = { log: () => {} };
let gamesDir: string;
beforeAll(async () => {
  gamesDir = await mkdtemp(path.join(tmpdir(), "arcade-games-"));
  for (const m of [makeManifest(), makeManifest({ id: "dev-game", dev: true })]) {
    await mkdir(path.join(gamesDir, m.id));
    await writeFile(path.join(gamesDir, m.id, "manifest.json"), JSON.stringify(m));
  }
  await mkdir(path.join(gamesDir, "_sdk"));
  await mkdir(path.join(gamesDir, "sin-manifiesto"));
});
afterAll(async () => {
  await rm(gamesDir, { recursive: true, force: true });
});

const json = (r: Response) => r.json() as Promise<any>;
const base = (srv: RunningServer) => `http://127.0.0.1:${srv.port}`;

describe("startServer (servidor HTTP real con PGlite en memoria)", () => {
  let srv: RunningServer;
  beforeAll(async () => {
    srv = await startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir, includeDevGames: false, trustProxy: false }), quiet);
  });
  afterAll(() => srv.close());

  it("responde a /v1/health y carga el catálogo sin los juegos dev", async () => {
    const res = await fetch(`${base(srv)}/v1/health`);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
    expect([...srv.catalog.keys()]).toEqual(["tap-game"]);
  });

  it("usa la IP real de la conexión: sin TRUST_PROXY, 10 registros/h/IP y el 11º da 429", async () => {
    const reg = (xff: string) => fetch(`${base(srv)}/v1/auth/anonymous`, { method: "POST", headers: { "x-forwarded-for": xff } });
    for (let i = 0; i < 10; i++) expect((await reg(`1.2.3.${i}`)).status).toBe(201);
    const limited = await reg("9.9.9.9");
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("flujo completo por HTTP: guardar, puntuar y leer el ranking", async () => {
    const srv2 = await startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir, trustProxy: true }), quiet);
    try {
      const u = base(srv2);
      const auth = await json(await fetch(`${u}/v1/auth/anonymous`, { method: "POST" }));
      const headers = { authorization: `Bearer ${auth.playerId}.${auth.secret}`, "content-type": "application/json" };
      const put = await fetch(`${u}/v1/games/tap-game/save`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ state: { n: 1 }, progress: { value: 1, total: 10 }, baseRev: 0 }),
      });
      expect(put.status).toBe(200);
      const score = await fetch(`${u}/v1/games/tap-game/scores`, { method: "POST", headers, body: JSON.stringify({ board: "taps", value: 42 }) });
      expect(await json(score)).toMatchObject({ accepted: true, best: 42, rank: { all: 1, weekly: 1 } });
      const board = await json(await fetch(`${u}/v1/games/tap-game/boards/taps`, { headers }));
      expect(board.entries).toEqual([{ rank: 1, playerId: auth.playerId, nickname: auth.nickname, value: 42, isMe: true }]);
      expect(board.me).toEqual({ rank: 1, value: 42 });
    } finally {
      await srv2.close();
    }
  });

  it("un guardado de más de 128 KB (cuerpo en streaming, sin Content-Length fiable) ⇒ 413", async () => {
    const srv2 = await startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir, trustProxy: true }), quiet);
    try {
      const u = base(srv2);
      const auth = await json(await fetch(`${u}/v1/auth/anonymous`, { method: "POST" }));
      const big = JSON.stringify({ state: "x".repeat(300_000), progress: { value: 1 }, baseRev: 0 });
      const res = await fetch(`${u}/v1/games/tap-game/save`, {
        method: "PUT",
        headers: { authorization: `Bearer ${auth.playerId}.${auth.secret}`, "content-type": "application/json" },
        body: big,
      });
      expect(res.status).toBe(413);
      expect((await json(res)).error).toBe("save_too_large");
    } finally {
      await srv2.close();
    }
  });

  it("CORS por HTTP real: preflight desde capacitor://localhost", async () => {
    const res = await fetch(`${base(srv)}/v1/me`, {
      method: "OPTIONS",
      headers: { origin: "capacitor://localhost", "access-control-request-method": "GET", "access-control-request-headers": "authorization" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
  });
});

describe("startServer: catálogo y cierre", () => {
  it("con includeDevGames incluye los juegos dev", async () => {
    const srv = await startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir, includeDevGames: true }), quiet);
    try {
      expect([...srv.catalog.keys()].sort()).toEqual(["dev-game", "tap-game"]);
    } finally {
      await srv.close();
    }
  });

  it("arranca con games/ vacío, con solo carpetas sin manifiesto o inexistente (fuera de producción)", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "arcade-empty-"));
    try {
      await mkdir(path.join(empty, "_sdk"));
      await mkdir(path.join(empty, "carpeta-sin-manifiesto"));
      for (const dir of [empty, path.join(empty, "no-existe")]) {
        const srv = await startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir: dir, includeDevGames: true }), quiet);
        try {
          expect(srv.catalog.size).toBe(0);
          expect((await fetch(`${base(srv)}/v1/health`)).status).toBe(200);
        } finally {
          await srv.close();
        }
      }
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });

  it("falla con un manifest.json inválido (mensaje claro) y no deja nada abierto", async () => {
    const bad = await mkdtemp(path.join(tmpdir(), "arcade-bad-"));
    try {
      await mkdir(path.join(bad, "roto-game"));
      await writeFile(path.join(bad, "roto-game", "manifest.json"), "{ no es json");
      await expect(startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir: bad }), quiet)).rejects.toThrow(/roto-game.*JSON/s);
    } finally {
      await rm(bad, { recursive: true, force: true });
    }
  });

  it("en producción un GAMES_DIR inexistente es un error", async () => {
    await expect(
      startServer(defaultConfig({ port: 0, dbMemory: true, production: true, gamesDir: path.join(gamesDir, "no-existe") }), quiet),
    ).rejects.toThrow(/no existe/);
  });

  it("close() es idempotente y libera el puerto", async () => {
    const srv = await startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir }), quiet);
    const port = srv.port;
    await Promise.all([srv.close(), srv.close()]);
    await srv.close();
    await expect(fetch(`http://127.0.0.1:${port}/v1/health`)).rejects.toThrow();
  });

  it("si el puerto está ocupado falla en vez de quedarse colgado", async () => {
    const first = await startServer(defaultConfig({ port: 0, dbMemory: true, gamesDir }), quiet);
    try {
      await expect(startServer(defaultConfig({ port: first.port, dbMemory: true, gamesDir }), quiet)).rejects.toThrow(/EADDRINUSE/);
    } finally {
      await first.close();
    }
  });
});
