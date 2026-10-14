import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "../src/catalog";
import { makeManifest } from "./helpers";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "arcade-catalog-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function game(name: string, manifest: unknown, raw?: string) {
  await mkdir(path.join(dir, name), { recursive: true });
  await writeFile(path.join(dir, name, "manifest.json"), raw ?? JSON.stringify(manifest));
}

describe("loadCatalog", () => {
  it("carga los manifiestos válidos indexados por id", async () => {
    await game("tap-game", makeManifest());
    await game("otro-juego", makeManifest({ id: "otro-juego" }));
    const cat = await loadCatalog(dir, { includeDev: false });
    expect([...cat.keys()].sort()).toEqual(["otro-juego", "tap-game"]);
    expect(cat.get("tap-game")!.boards.map((b) => b.id)).toEqual(["taps", "fastest", "stars"]);
  });

  it("ignora _sdk, carpetas ocultas, carpetas sin manifest.json y archivos sueltos", async () => {
    await game("tap-game", makeManifest());
    await mkdir(path.join(dir, "_sdk"));
    await writeFile(path.join(dir, "_sdk", "manifest.json"), "esto ni es JSON");
    await game(".oculto", makeManifest({ id: "oculto-x" }));
    await game("_borrador", makeManifest({ id: "borrador" }));
    await mkdir(path.join(dir, "sin-manifiesto"));
    await writeFile(path.join(dir, "README.md"), "hola");
    const cat = await loadCatalog(dir, { includeDev: false });
    expect([...cat.keys()]).toEqual(["tap-game"]);
  });

  it("los juegos dev:true solo se incluyen con includeDev", async () => {
    await game("tap-game", makeManifest());
    await game("dev-game", makeManifest({ id: "dev-game", dev: true }));
    expect([...(await loadCatalog(dir, { includeDev: false })).keys()]).toEqual(["tap-game"]);
    expect([...(await loadCatalog(dir, { includeDev: true })).keys()].sort()).toEqual(["dev-game", "tap-game"]);
  });

  it("falla con un manifest.json que no es JSON, indicando la carpeta", async () => {
    await game("roto-game", null, "{ no es json");
    await expect(loadCatalog(dir, { includeDev: true })).rejects.toThrow(/roto-game.*manifest\.json.*JSON/s);
  });

  it("falla con un manifiesto inválido, indicando carpeta y campo", async () => {
    await game("malo-game", { ...makeManifest(), sdk: 2 });
    await expect(loadCatalog(dir, { includeDev: true })).rejects.toThrow(/malo-game.*sdk/s);
  });

  it("falla si el id no coincide con el nombre de la carpeta", async () => {
    await game("carpeta-a", makeManifest({ id: "carpeta-b" }));
    await expect(loadCatalog(dir, { includeDev: true })).rejects.toThrow(/carpeta-a.*carpeta-b/s);
  });

  it("un directorio vacío da un catálogo vacío", async () => {
    expect((await loadCatalog(dir, { includeDev: true })).size).toBe(0);
  });

  it("un directorio inexistente falla, salvo allowMissing", async () => {
    const missing = path.join(dir, "no-existe");
    await expect(loadCatalog(missing, { includeDev: true })).rejects.toThrow(/no existe/);
    expect((await loadCatalog(missing, { includeDev: true, allowMissing: true })).size).toBe(0);
  });
});
