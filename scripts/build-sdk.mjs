// Construye el SDK de juegos como IIFE minificado en games/_sdk/arcade-sdk.js
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SDK_MAX_BYTES = 12 * 1024;

/** @param {{ write?: boolean }} [opts] */
export async function buildSdk({ write = true } = {}) {
  const result = await build({
    entryPoints: [resolve(root, "packages/game-sdk/src/entry.ts")],
    bundle: true,
    format: "iife",
    minify: true,
    target: "es2019",
    write: false,
    legalComments: "none",
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  const bytes = Buffer.byteLength(code);
  if (bytes > SDK_MAX_BYTES) throw new Error(`arcade-sdk.js pesa ${bytes} B (> ${SDK_MAX_BYTES} B)`);
  if (write) {
    const out = resolve(root, "games/_sdk/arcade-sdk.js");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, code);
  }
  return { code, bytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { bytes } = await buildSdk();
  console.log(`games/_sdk/arcade-sdk.js (${bytes} B)`);
}
