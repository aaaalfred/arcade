import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseManifest, type Manifest } from "@arcade/protocol";
import { ZodError } from "zod";

export interface LoadCatalogOptions {
  /** Incluye los juegos con `dev: true` (solo builds de desarrollo / E2E). */
  includeDev: boolean;
  /** Devuelve un catálogo vacío si la carpeta no existe, en vez de fallar. */
  allowMissing?: boolean;
}

function formatZod(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ");
}

/**
 * Lee `games/*\/manifest.json`. Ignora `_sdk` y toda carpeta que empiece por `_` o `.`, y las carpetas sin
 * manifest.json. Un manifest.json inválido o con un `id` distinto del nombre de la carpeta es un error.
 */
export async function loadCatalog(gamesDir: string, opts: LoadCatalogOptions): Promise<Map<string, Manifest>> {
  let entries: string[];
  try {
    entries = await readdir(gamesDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      if (opts.allowMissing) return new Map();
      throw new Error(`La carpeta de juegos no existe: ${gamesDir} (configura GAMES_DIR)`);
    }
    throw err;
  }

  const catalog = new Map<string, Manifest>();
  for (const name of entries.sort()) {
    if (name.startsWith("_") || name.startsWith(".")) continue;
    const dir = path.join(gamesDir, name);
    if (!(await stat(dir)).isDirectory()) continue;

    const file = path.join(dir, "manifest.json");
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw err;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error(`games/${name}/manifest.json no es JSON válido: ${(err as Error).message}`);
    }

    let manifest: Manifest;
    try {
      manifest = parseManifest(json);
    } catch (err) {
      if (err instanceof ZodError) throw new Error(`games/${name}/manifest.json inválido: ${formatZod(err)}`);
      throw err;
    }
    if (manifest.id !== name) {
      throw new Error(`games/${name}/manifest.json: el id «${manifest.id}» no coincide con el nombre de la carpeta «${name}»`);
    }
    if (manifest.dev && !opts.includeDev) continue;
    catalog.set(manifest.id, manifest);
  }
  return catalog;
}
