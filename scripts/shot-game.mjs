// Captura un juego en un móvil virtual (Chromium headless con WebGL por software) para revisarlo sin dispositivo.
// Uso (desde la raíz, con Node 22): node scripts/shot-game.mjs <id> <carpeta-salida> [--eval "js"]... 
//   Hace: carga games/<id>/ en un servidor propio (puerto libre), captura "menu", y luego ejecuta cada --eval
//   (código JS dentro de la página; espera 1.2 s) y captura "paso-N". Claro y oscuro. Imprime errores de consola.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGamesServer } from "./serve-games.mjs";
import { buildSdk } from "./build-sdk.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, "../apps/shell/package.json"))("@playwright/test");
const [id, out, ...rest] = process.argv.slice(2);
if (!id || !out) { console.error("uso: node scripts/shot-game.mjs <id> <salida> [--eval js]..."); process.exit(1); }
const evals = []; for (let i = 0; i < rest.length; i++) if (rest[i] === "--eval") evals.push(rest[++i]);
mkdirSync(resolve(out), { recursive: true });
await buildSdk();
const srv = createGamesServer(join(here, "..", "games"));
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const scheme of ["light", "dark"]) {
  const p = await b.newPage({ viewport: { width: 393, height: 780 }, deviceScaleFactor: 2, colorScheme: scheme });
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log(`[${scheme}] ${m.type()}:`, m.text()); });
  p.on("pageerror", (e) => console.log(`[${scheme}] pageerror:`, e.message));
  await p.goto(`http://localhost:${port}/${id}/`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: join(resolve(out), `${id}-${scheme}-menu.png`) });
  let n = 1;
  for (const code of evals) {
    try { await p.evaluate(code); } catch (e) { console.log(`[${scheme}] eval falló:`, e.message); }
    await p.waitForTimeout(1200);
    await p.screenshot({ path: join(resolve(out), `${id}-${scheme}-paso-${n++}.png`) });
  }
}
await b.close(); srv.close();
console.log("listo:", resolve(out));
