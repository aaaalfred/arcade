import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importGame } from "../import-game.mjs";

let tmp, src, games;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "arcade-import-"));
  src = join(tmp, "origen");
  games = join(tmp, "games");
  mkdirSync(src);
  mkdirSync(join(games, "_sdk"), { recursive: true });
  writeFileSync(join(games, "_sdk", "arcade-sdk.js"), "");
  writeFileSync(join(src, "index.html"), '<!doctype html><html><head><title>Mi Puzzle</title></head><body><script src="logic.js"></script></body></html>');
  writeFileSync(join(src, "logic.js"), "var a=1");
  writeFileSync(join(src, "gen-levels.js"), "// generador");
  writeFileSync(join(src, "README.md"), "# x");
  mkdirSync(join(src, "node_modules"));
  writeFileSync(join(src, "node_modules", "x.js"), "");
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("importGame", () => {
  it("copia el juego sin archivos de desarrollo y genera un manifiesto válido", async () => {
    const r = await importGame({ src, id: "mi-puzzle", gamesDir: games });
    const dest = join(games, "mi-puzzle");
    expect(existsSync(join(dest, "index.html"))).toBe(true);
    expect(existsSync(join(dest, "logic.js"))).toBe(true);
    expect(existsSync(join(dest, "gen-levels.js"))).toBe(false);
    expect(existsSync(join(dest, "README.md"))).toBe(false);
    expect(existsSync(join(dest, "node_modules"))).toBe(false);
    const m = JSON.parse(readFileSync(join(dest, "manifest.json"), "utf8"));
    expect(m).toMatchObject({ id: "mi-puzzle", name: "Mi Puzzle", sdk: 1 });
    expect(r.createdManifest).toBe(true);
  });

  it("inyecta el SDK antes del primer <script> y es idempotente", async () => {
    await importGame({ src, id: "mi-puzzle", gamesDir: games });
    const html1 = readFileSync(join(games, "mi-puzzle", "index.html"), "utf8");
    expect(html1).toContain('<script src="../_sdk/arcade-sdk.js" data-game="mi-puzzle"></script>');
    expect(html1.indexOf("arcade-sdk.js")).toBeLessThan(html1.indexOf("logic.js"));
    await importGame({ src, id: "mi-puzzle", gamesDir: games, force: true });
    const html2 = readFileSync(join(games, "mi-puzzle", "index.html"), "utf8");
    expect(html2.match(/arcade-sdk\.js/g)).toHaveLength(1);
  });

  it("nunca sobrescribe un manifest.json existente al reimportar", async () => {
    await importGame({ src, id: "mi-puzzle", gamesDir: games });
    const p = join(games, "mi-puzzle", "manifest.json");
    const m = JSON.parse(readFileSync(p, "utf8"));
    m.name = "Nombre editado a mano";
    writeFileSync(p, JSON.stringify(m));
    const r = await importGame({ src, id: "mi-puzzle", gamesDir: games, force: true });
    expect(JSON.parse(readFileSync(p, "utf8")).name).toBe("Nombre editado a mano");
    expect(r.createdManifest).toBe(false);
  });

  it("se niega a sobrescribir sin force", async () => {
    await importGame({ src, id: "mi-puzzle", gamesDir: games });
    await expect(importGame({ src, id: "mi-puzzle", gamesDir: games })).rejects.toThrow(/force/);
  });

  it("rechaza ids inválidos y orígenes sin index.html", async () => {
    await expect(importGame({ src, id: "Mal Id", gamesDir: games })).rejects.toThrow(/id/);
    await expect(importGame({ src: tmp, id: "ok-id", gamesDir: games })).rejects.toThrow(/index\.html/);
  });
});
