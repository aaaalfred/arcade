// Importa un juego HTML existente a games/<id>/ (copia, manifiesto base e inyección del SDK).
// Uso: tsx scripts/import-game.mjs <carpeta-origen> <id> [--force]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GameIdSchema, parseManifest } from "../packages/protocol/src/index.ts";
import { checkGame, defaultGamesDir } from "./check-games.mjs";

const SKIP = (name) =>
  name === "node_modules" || name === ".git" || name === ".DS_Store" || /^gen-.*\.js$/.test(name) || /\.(md|xlsx|log)$/i.test(name);

function sdkTag(id) {
  return `<script src="../_sdk/arcade-sdk.js" data-game="${id}"></script>`;
}

function injectSdk(file, id) {
  const html = readFileSync(file, "utf8");
  if (/arcade-sdk\.js/.test(html)) return false;
  const tag = sdkTag(id);
  let out;
  const firstScript = html.search(/<script\b/i);
  if (firstScript >= 0) out = html.slice(0, firstScript) + tag + "\n" + html.slice(firstScript);
  else if (/<\/body>/i.test(html)) out = html.replace(/<\/body>/i, `${tag}\n</body>`);
  else out = html + "\n" + tag + "\n";
  writeFileSync(file, out);
  return true;
}

/**
 * @param {{ src: string, id: string, gamesDir?: string, force?: boolean, name?: string }} o
 */
export async function importGame({ src, id, gamesDir = defaultGamesDir, force = false, name }) {
  const idCheck = GameIdSchema.safeParse(id);
  if (!idCheck.success) throw new Error(`id inválido "${id}": usa [a-z0-9-], 3–32 caracteres`);
  const from = resolve(src);
  if (!existsSync(join(from, "index.html"))) throw new Error(`${from} no contiene index.html`);

  const dest = join(gamesDir, id);
  if (existsSync(dest)) {
    if (!force) throw new Error(`games/${id} ya existe; usa --force para sobrescribir los archivos (se conserva manifest.json)`);
    for (const n of readdirSync(dest)) if (n !== "manifest.json") rmSync(join(dest, n), { recursive: true, force: true });
  }
  mkdirSync(dest, { recursive: true });
  cpSync(from, dest, { recursive: true, filter: (p) => p === from || !SKIP(basename(p)) });

  const entry = join(dest, "index.html");
  const injected = injectSdk(entry, id);

  let createdManifest = false;
  const manifestPath = join(dest, "manifest.json");
  if (!existsSync(manifestPath)) {
    const html = readFileSync(entry, "utf8");
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    const manifest = parseManifest({
      id,
      name: name ?? title ?? id,
      tagline: "",
      version: "0.1.0",
      sdk: 1,
      entry: "index.html",
      orientation: "portrait",
      theme: { accent: "#4cc9f0", background: "#0f1b2d", ink: "#f1f5fb" },
      icon: "🎮",
      progress: { unit: "niveles", total: 10 },
      boards: [],
      ads: { interstitial: true, rewarded: true },
      dev: false,
    });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    createdManifest = true;
  }
  const check = await checkGame(dest);
  return { dest, createdManifest, injected, check };
}

async function main(argv) {
  const force = argv.includes("--force");
  const [src, id] = argv.filter((a) => !a.startsWith("--"));
  if (!src || !id) {
    console.error("Uso: tsx scripts/import-game.mjs <carpeta-origen> <id> [--force]");
    process.exit(2);
  }
  const r = await importGame({ src, id, force });
  console.log(`Importado en ${r.dest}`);
  if (r.injected) console.log("  · se añadió la etiqueta <script> del SDK al index.html");
  if (r.createdManifest) console.log("  · se creó manifest.json con valores por defecto: REVÍSALO (nombre, colores, icono, progress.total, tableros)");
  r.check.errors.forEach((e) => console.log(`  error: ${e}`));
  r.check.warnings.forEach((w) => console.log(`  aviso: ${w}`));
  console.log("Siguiente paso: docs/integrar-un-juego.md (reemplazar localStorage/anuncios por Arcade.*)");
  process.exit(r.check.errors.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
