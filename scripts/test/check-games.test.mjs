import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkGame } from "../check-games.mjs";

let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "arcade-games-"));
  mkdirSync(join(root, "_sdk"));
  writeFileSync(join(root, "_sdk", "arcade-sdk.js"), "/* sdk */");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const manifest = (over = {}) => ({
  id: "mi-juego", name: "Mi juego", version: "1.0.0", sdk: 1,
  theme: { accent: "#3f8a52", background: "#f3f7f1", ink: "#2e473f" },
  icon: "🎮", progress: { unit: "niveles", total: 5 }, boards: [], ...over,
});
const html = (body = "", head = '<script src="../_sdk/arcade-sdk.js" data-game="mi-juego"></script>') =>
  `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

function mk(files, id = "mi-juego") {
  const dir = join(root, id);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}
const good = () => ({ "manifest.json": manifest(), "index.html": html("<canvas></canvas>") });

describe("checkGame", () => {
  it("un juego correcto no tiene errores ni avisos", async () => {
    const r = await checkGame(mk(good()));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("manifiesto ausente o inválido ⇒ error", async () => {
    expect((await checkGame(mk({ "index.html": html() }))).errors.join()).toMatch(/manifest\.json/);
    const bad = mk({ "manifest.json": manifest({ sdk: 9 }), "index.html": html() }, "otro-juego");
    expect((await checkGame(bad)).errors.length).toBeGreaterThan(0);
  });

  it("manifest.json con JSON roto ⇒ error legible", async () => {
    const dir = mk({ "manifest.json": "{roto", "index.html": html() });
    expect((await checkGame(dir)).errors.join()).toMatch(/manifest\.json/);
  });

  it("id distinto del nombre de carpeta ⇒ error", async () => {
    const dir = mk({ "manifest.json": manifest({ id: "otro-id" }), "index.html": html() });
    expect((await checkGame(dir)).errors.join()).toMatch(/carpeta/);
  });

  it("entry inexistente ⇒ error", async () => {
    const dir = mk({ "manifest.json": manifest({ entry: "main.html" }) });
    expect((await checkGame(dir)).errors.join()).toMatch(/main\.html/);
  });

  it("falta el SDK o apunta a otra ruta ⇒ error", async () => {
    const sin = mk({ "manifest.json": manifest(), "index.html": html("", "") });
    expect((await checkGame(sin)).errors.join()).toMatch(/arcade-sdk\.js/);
    const mal = mk({ "manifest.json": manifest({ id: "mal-sdk" }), "index.html": html("", '<script src="sdk.js"></script>') }, "mal-sdk");
    expect((await checkGame(mal)).errors.join()).toMatch(/arcade-sdk\.js/);
  });

  it.each([
    ["script remoto", html("", '<script src="https://cdn.example.com/x.js"></script><script src="../_sdk/arcade-sdk.js"></script>')],
    ["css remoto", html("", '<link rel="stylesheet" href="//fonts.example.com/a.css"><script src="../_sdk/arcade-sdk.js"></script>')],
    ["enlace externo", html('<a href="http://example.com">x</a>')],
    ["imagen remota", html('<img src="https://x.test/a.png">')],
  ])("recurso remoto en HTML (%s) ⇒ error", async (_n, content) => {
    const dir = mk({ "manifest.json": manifest(), "index.html": content });
    expect((await checkGame(dir)).errors.join()).toMatch(/remoto/);
  });

  it.each([
    ["fetch", "fetch('https://api.example.com/x')"],
    ["import dinámico", "import(`https://esm.sh/x`)"],
    ["WebSocket", "new WebSocket('wss://x.test')"],
    ["XHR", "x.open('GET', 'https://x.test/a')"],
    ["css url()", "a{background:url(https://x.test/a.png)}"],
    ["css @import", "@import 'https://x.test/a.css';"],
  ])("recurso remoto en JS/CSS (%s) ⇒ error", async (_n, code) => {
    const dir = mk({ "manifest.json": manifest(), "index.html": html(), "game.js": code });
    expect((await checkGame(dir)).errors.join()).toMatch(/remoto/);
  });

  it("permite data:, blob:, rutas relativas y el namespace SVG", async () => {
    const dir = mk({
      "manifest.json": manifest(),
      "index.html": html('<img src="data:image/png;base64,AAAA"><img src="a.png"><svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      "game.js": 'document.createElementNS("http://www.w3.org/2000/svg","svg"); fetch("levels.json");',
    });
    const r = await checkGame(dir);
    expect(r.errors).toEqual([]);
  });

  it("localStorage / navigator.vibrate ⇒ aviso (error con strict)", async () => {
    const dir = mk({ "manifest.json": manifest(), "index.html": html(), "g.js": "localStorage.setItem('a','b'); navigator.vibrate(20)" });
    const r = await checkGame(dir);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join("\n")).toMatch(/localStorage/);
    expect(r.warnings.join("\n")).toMatch(/vibrate/);
    const s = await checkGame(dir, { strict: true });
    expect(s.errors.length).toBe(2);
    expect(s.warnings).toEqual([]);
  });

  it("carpeta mayor de 15 MB ⇒ error", async () => {
    const dir = mk(good());
    writeFileSync(join(dir, "big.bin"), Buffer.alloc(15 * 1024 * 1024 + 1));
    expect((await checkGame(dir)).errors.join()).toMatch(/15 MB/);
  });
});
