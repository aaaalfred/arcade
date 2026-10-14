import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGamesServer } from "../serve-games.mjs";

let root, server, base;
beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "arcade-serve-"));
  mkdirSync(join(root, "_sdk"));
  mkdirSync(join(root, "demo"));
  writeFileSync(join(root, "_sdk", "arcade-sdk.js"), "window.x=1");
  writeFileSync(join(root, "demo", "index.html"), "<h1>hola</h1>");
  writeFileSync(join(tmpdir(), "secreto-arcade.txt"), "secreto");
  server = createGamesServer(root);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  rmSync(root, { recursive: true, force: true });
});

describe("servidor de juegos", () => {
  it("sirve archivos con el tipo MIME correcto", async () => {
    const js = await fetch(`${base}/_sdk/arcade-sdk.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get("content-type")).toMatch(/javascript/);
    const idx = await fetch(`${base}/demo/`);
    expect(idx.headers.get("content-type")).toMatch(/text\/html/);
    expect(await idx.text()).toContain("hola");
  });
  it("lista los juegos en la raíz", async () => {
    const r = await fetch(`${base}/`);
    expect(await r.text()).toContain("demo/");
  });
  it("404 para inexistentes y bloquea path traversal", async () => {
    expect((await fetch(`${base}/nada.js`)).status).toBe(404);
    const raw = await new Promise((resolve) => {
      import("node:net").then(({ default: net }) => {
        const s = net.connect(server.address().port, "127.0.0.1", () => s.write("GET /../secreto-arcade.txt HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n"));
        let buf = ""; s.on("data", (d) => (buf += d)); s.on("close", () => resolve(buf));
      });
    });
    expect(raw).not.toContain("secreto");
    expect(raw).toMatch(/HTTP\/1\.1 (403|404)/);
  });
});
