// Valida carpetas de juego: manifiesto, SDK, recursos remotos y buenas prácticas.
// Uso: tsx scripts/check-games.mjs [--strict] [carpeta…]   (sin carpetas ⇒ todas las de games/)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseManifest } from "../packages/protocol/src/index.ts";

export const MAX_GAME_BYTES = 15 * 1024 * 1024;
const here = dirname(fileURLToPath(import.meta.url));
export const defaultGamesDir = resolve(here, "..", "games");

const TEXT_EXT = new Set([".html", ".htm", ".js", ".mjs", ".css", ".svg"]);
const SKIP_DIRS = new Set(["node_modules", ".git"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push({ path: p, size: st.size });
  }
  return out;
}

const REMOTE_PATTERNS = [
  /\b(?:src|href|poster|data|srcset|action)\s*=\s*["']\s*((?:https?:)?\/\/[^"']*)["']/gi,
  /\b(?:fetch|import)\s*\(\s*["'`]\s*((?:https?:)?\/\/[^"'`]*)/g,
  /\bimportScripts\s*\(\s*["'`]\s*((?:https?:)?\/\/[^"'`]*)/g,
  /new\s+(?:WebSocket|EventSource)\s*\(\s*["'`]\s*((?:wss?|https?):[^"'`]*)/g,
  /\.open\s*\(\s*["'][A-Za-z]+["']\s*,\s*["'`]\s*((?:https?:)?\/\/[^"'`]*)/g,
  /url\(\s*["']?\s*((?:https?:)?\/\/[^"')\s]*)/gi,
  /@import\s+(?:url\()?\s*["']\s*((?:https?:)?\/\/[^"']*)/gi,
];

const WARN_PATTERNS = [
  [/\b(?:localStorage|sessionStorage|indexedDB)\b/, "usa localStorage/sessionStorage/indexedDB; guarda con Arcade.save() para que el progreso se sincronice"],
  [/navigator\s*\.\s*vibrate/, "usa navigator.vibrate (no funciona en iOS); usa Arcade.haptic()"],
];

/**
 * @param {string} dir carpeta del juego
 * @param {{ strict?: boolean }} [opts]
 * @returns {Promise<{ id: string, errors: string[], warnings: string[] }>}
 */
export async function checkGame(dir, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const folder = basename(resolve(dir));
  const result = (id = folder) => {
    if (strict) {
      errors.push(...warnings.splice(0));
    }
    return { id, errors, warnings };
  };

  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    errors.push("falta manifest.json");
    return result();
  }
  let manifest;
  try {
    manifest = parseManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (e) {
    const detail = e?.issues ? e.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ") : String(e.message ?? e);
    errors.push(`manifest.json inválido: ${detail}`);
    return result();
  }
  if (manifest.id !== folder) errors.push(`el id "${manifest.id}" debe coincidir con el nombre de la carpeta "${folder}"`);

  const entryPath = resolve(dir, manifest.entry);
  if (!existsSync(entryPath)) {
    errors.push(`no existe el entry "${manifest.entry}"`);
  } else {
    const html = readFileSync(entryPath, "utf8");
    const sdkTarget = resolve(dir, "..", "_sdk", "arcade-sdk.js");
    const srcs = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1].split(/[?#]/)[0]);
    const ok = srcs.some((s) => !/^(?:https?:)?\/\//.test(s) && resolve(dirname(entryPath), s) === sdkTarget);
    if (!ok) errors.push('el entry debe cargar el SDK: <script src="../_sdk/arcade-sdk.js" data-game="' + manifest.id + '"></script>');
  }

  const files = walk(dir);
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total > MAX_GAME_BYTES) errors.push(`la carpeta pesa ${(total / 1048576).toFixed(1)} MB (máximo 15 MB)`);

  const warned = new Set();
  for (const f of files) {
    if (!TEXT_EXT.has(extname(f.path).toLowerCase())) continue;
    const text = readFileSync(f.path, "utf8");
    const rel = f.path.slice(resolve(dir).length + 1).split(sep).join("/");
    for (const re of REMOTE_PATTERNS) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        errors.push(`recurso remoto en ${rel}: ${m[1].slice(0, 80)} (el juego debe funcionar sin red)`);
      }
    }
    for (const [re, msg] of WARN_PATTERNS) {
      if (re.test(text) && !warned.has(rel + msg)) {
        warned.add(rel + msg);
        warnings.push(`${rel}: ${msg}`);
      }
    }
  }
  return result(manifest.id);
}

async function main(argv) {
  const strict = argv.includes("--strict");
  let dirs = argv.filter((a) => !a.startsWith("--")).map((d) => resolve(d));
  if (dirs.length === 0) {
    dirs = existsSync(defaultGamesDir)
      ? readdirSync(defaultGamesDir)
          .filter((n) => !n.startsWith("_") && !n.startsWith("."))
          .map((n) => join(defaultGamesDir, n))
          .filter((p) => statSync(p).isDirectory())
      : [];
  }
  let failed = 0;
  for (const dir of dirs) {
    const r = await checkGame(dir, { strict });
    const mark = r.errors.length ? "✖" : r.warnings.length ? "⚠" : "✔";
    console.log(`${mark} ${r.id}`);
    r.errors.forEach((e) => console.log(`    error: ${e}`));
    r.warnings.forEach((w) => console.log(`    aviso: ${w}`));
    if (r.errors.length) failed++;
  }
  console.log(`\n${dirs.length} juego(s) revisado(s), ${failed} con errores`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
