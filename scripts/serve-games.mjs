// Servidor estático de games/ para probar un juego en modo standalone.
// Uso: pnpm dev:game   → http://localhost:5174/<id>/
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSdk } from "./build-sdk.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
};

export function createGamesServer(root) {
  const base = resolve(root);
  return createServer((req, res) => {
    const send = (code, body, type = "text/plain; charset=utf-8") => {
      res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
      res.end(body);
    };
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    } catch {
      return send(400, "petición inválida");
    }
    if (pathname === "/") {
      const games = readdirSync(base).filter((n) => !n.startsWith(".") && !n.startsWith("_") && statSync(join(base, n)).isDirectory());
      const items = games.map((g) => `<li><a href="${g}/">${g}/</a></li>`).join("");
      return send(200, `<!doctype html><meta charset="utf-8"><title>Juegos</title><h1>Juegos</h1><ul>${items}</ul>`, MIME[".html"]);
    }
    let file = resolve(base, "." + normalize(pathname));
    if (file !== base && !file.startsWith(base + sep)) return send(403, "prohibido");
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file) || !statSync(file).isFile()) return send(404, "no encontrado");
    send(200, readFileSync(file), MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { bytes } = await buildSdk();
  const port = Number(process.env.PORT ?? 5174);
  createGamesServer(join(here, "..", "games")).listen(port, () => {
    console.log(`SDK construido (${bytes} B). Juegos en http://localhost:${port}/`);
  });
}
