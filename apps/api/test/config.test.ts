import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig, loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("aplica los valores por defecto", () => {
    const c = loadConfig({}, { cwd: "/srv/arcade/apps/api" });
    expect(c.port).toBe(8787);
    expect(c.databaseUrl).toBeUndefined();
    expect(c.dbMemory).toBe(false);
    expect(c.pgliteDir).toBe(path.resolve("/srv/arcade/apps/api", ".data/pglite"));
    expect(c.includeDevGames).toBe(false);
    expect(c.trustProxy).toBe(false);
    expect(c.adminToken).toBeUndefined();
    expect(c.corsOrigins).toEqual([]);
    expect(c.production).toBe(false);
  });

  it("lee y valida las variables", () => {
    const c = loadConfig(
      {
        PORT: "9000",
        DATABASE_URL: "postgres://u:p@db:5432/arcade",
        DB_MEMORY: "1",
        INCLUDE_DEV_GAMES: "1",
        TRUST_PROXY: "1",
        ADMIN_TOKEN: "x".repeat(24),
        CORS_ORIGINS: " https://a.example.com , https://b.example.com ,, ",
        NODE_ENV: "production",
        PGLITE_DIR: "datos/pg",
        GAMES_DIR: "juegos",
      },
      { cwd: "/srv/x" },
    );
    expect(c.port).toBe(9000);
    expect(c.databaseUrl).toBe("postgres://u:p@db:5432/arcade");
    expect(c.dbMemory).toBe(true);
    expect(c.includeDevGames).toBe(true);
    expect(c.trustProxy).toBe(true);
    expect(c.adminToken).toBe("x".repeat(24));
    expect(c.corsOrigins).toEqual(["https://a.example.com", "https://b.example.com"]);
    expect(c.production).toBe(true);
    expect(c.pgliteDir).toBe(path.resolve("/srv/x", "datos/pg"));
    expect(c.gamesDir).toBe(path.resolve("/srv/x", "juegos"));
  });

  it("trata las cadenas vacías como no definidas", () => {
    const c = loadConfig({ ADMIN_TOKEN: "", DATABASE_URL: "", PORT: "", CORS_ORIGINS: "" }, { cwd: "/tmp" });
    expect(c.adminToken).toBeUndefined();
    expect(c.databaseUrl).toBeUndefined();
    expect(c.port).toBe(8787);
    expect(c.corsOrigins).toEqual([]);
  });

  it("falla con mensajes claros ante valores inválidos", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/PORT/);
    expect(() => loadConfig({ TRUST_PROXY: "si" })).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig({ INCLUDE_DEV_GAMES: "2" })).toThrow(/INCLUDE_DEV_GAMES/);
    expect(() => loadConfig({ ADMIN_TOKEN: "corto" })).toThrow(/ADMIN_TOKEN/);
    expect(() => loadConfig({ CORS_ORIGINS: "no-es-una-url" })).toThrow(/CORS_ORIGINS/);
  });

  it("acepta 0/1/true/false en los interruptores", () => {
    expect(loadConfig({ DB_MEMORY: "true" }).dbMemory).toBe(true);
    expect(loadConfig({ DB_MEMORY: "false" }).dbMemory).toBe(false);
    expect(loadConfig({ DB_MEMORY: "0" }).dbMemory).toBe(false);
  });

  it("normaliza los orígenes CORS (sin barra final)", () => {
    expect(loadConfig({ CORS_ORIGINS: "https://a.example.com/" }).corsOrigins).toEqual(["https://a.example.com"]);
  });

  it("defaultConfig permite sobreescribir campos", () => {
    expect(defaultConfig({ port: 1234 }).port).toBe(1234);
  });
});
