import { parseManifest, type Manifest } from "@arcade/protocol";

export interface CatalogGame {
  manifest: Manifest;
  /** Carpeta del juego relativa al documento del shell: `games/<id>/`. */
  baseUrl: string;
  entryUrl: string;
}

export function buildCatalog(raw: unknown[], opts: { includeDev: boolean }): CatalogGame[] {
  const seen = new Set<string>();
  const games: CatalogGame[] = [];
  for (const item of raw) {
    let manifest: Manifest;
    try {
      manifest = parseManifest(item);
    } catch (e) {
      const id = (item as { id?: unknown } | null)?.id;
      throw new Error(`manifest.json inválido (${String(id ?? "sin id")}): ${(e as Error).message}`);
    }
    if (seen.has(manifest.id)) throw new Error(`id de juego duplicado: ${manifest.id}`);
    seen.add(manifest.id);
    if (manifest.dev && !opts.includeDev) continue;
    const baseUrl = `games/${manifest.id}/`;
    games.push({ manifest, baseUrl, entryUrl: baseUrl + manifest.entry });
  }
  return games.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, "es"));
}

const modules = import.meta.glob("../../../../games/*/manifest.json", { eager: true, import: "default" });

export const INCLUDE_DEV_GAMES = import.meta.env.DEV || import.meta.env.VITE_INCLUDE_DEV_GAMES === "1";

let cached: CatalogGame[] | null = null;
export function getCatalog(): CatalogGame[] {
  cached ??= buildCatalog(Object.values(modules), { includeDev: INCLUDE_DEV_GAMES });
  return cached;
}

export function getGame(id: string): CatalogGame | undefined {
  return getCatalog().find((g) => g.manifest.id === id);
}
