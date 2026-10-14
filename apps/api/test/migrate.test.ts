import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { migrate } from "../src/db/migrate";
import { createPglite } from "../src/db/pglite";

let db: Db;
beforeAll(async () => {
  db = await createPglite();
});
afterAll(async () => {
  await db.close();
});

describe("migrate", () => {
  it("aplica 001_init y es idempotente", async () => {
    await migrate(db);
    await migrate(db);
    const applied = await db.query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
    expect(applied.map((r) => r.version)).toEqual(["001_init.sql"]);
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    expect(tables.map((t) => t.table_name)).toEqual(["players", "reports", "saves", "schema_migrations", "scores"]);
  });

  it("el apodo es único sin distinguir mayúsculas a nivel de base de datos", async () => {
    await db.query(
      "INSERT INTO players (id, token_hash, nickname, nickname_ci) VALUES ('p1', 'h', 'Ángel', 'ángel')",
    );
    await expect(
      db.query("INSERT INTO players (id, token_hash, nickname, nickname_ci) VALUES ('p2', 'h', 'ÁNGEL', 'ángel')"),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("borrar un jugador borra en cascada guardados, puntajes y reportes", async () => {
    await db.query("INSERT INTO players (id, token_hash, nickname, nickname_ci) VALUES ('p3', 'h', 'Tres', 'tres')");
    await db.query("INSERT INTO saves (player_id, game_id, rev, state, progress_value) VALUES ('p3','g',1,'{}',0)");
    await db.query(
      "INSERT INTO scores (player_id, game_id, board_id, period, value, achieved_at, game_version) VALUES ('p3','g','b','all',1,now(),'1.0.0')",
    );
    await db.query("INSERT INTO reports (reporter_id, target_id, reason) VALUES ('p3','p1','x')");
    await db.query("DELETE FROM players WHERE id = 'p3'");
    for (const t of ["saves", "scores", "reports"]) {
      expect(await db.query(`SELECT 1 FROM ${t} WHERE ${t === "reports" ? "reporter_id" : "player_id"} = 'p3'`)).toHaveLength(0);
    }
  });

  it("aplica varios archivos por orden, registra cada uno y revierte uno que falla", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "arcade-mig-"));
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "001_a.sql"), "CREATE TABLE ta (id int);");
      await writeFile(path.join(dir, "002_b.sql"), "CREATE TABLE tb (id int);");
      await writeFile(path.join(dir, "notas.txt"), "se ignora");
      const fresh = await createPglite();
      try {
        await migrate(fresh, { dir });
        expect((await fresh.query("SELECT version FROM schema_migrations ORDER BY version")).map((r: any) => r.version)).toEqual([
          "001_a.sql",
          "002_b.sql",
        ]);
        // una migración que falla a medias no deja nada
        await writeFile(path.join(dir, "003_mala.sql"), "CREATE TABLE tc (id int); SELECT * FROM no_existe;");
        await expect(migrate(fresh, { dir })).rejects.toThrow();
        expect(await fresh.query("SELECT to_regclass('tc') AS t")).toEqual([{ t: null }]);
        expect(await fresh.query("SELECT 1 FROM schema_migrations WHERE version = '003_mala.sql'")).toHaveLength(0);
      } finally {
        await fresh.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
