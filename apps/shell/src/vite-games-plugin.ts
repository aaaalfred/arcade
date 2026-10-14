import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { Plugin } from "vite";
// @ts-expect-error — módulos .mjs sin tipos
import { checkGame } from "../../../scripts/check-games.mjs";
// @ts-expect-error — módulos .mjs sin tipos
import { mimeFor } from "../../../scripts/serve-games.mjs";

/**
 * Sirve `games/` en `/games/*` durante el desarrollo y lo copia a `dist/games` al construir,
 * validando cada juego con `check-games` (un juego con errores rompe el build).
 */
export function gamesPlugin(opts: { gamesDir: string }): Plugin {
  const gamesDir = resolve(opts.gamesDir);
  let includeDev = true;
  let isBuild = false;
  let outDir = "";

  const gameFolders = () =>
    readdirSync(gamesDir).filter((n) => !n.startsWith("_") && !n.startsWith(".") && statSync(join(gamesDir, n)).isDirectory());

  const isDevGame = (id: string): boolean => {
    try {
      return JSON.parse(readFileSync(join(gamesDir, id, "manifest.json"), "utf8")).dev === true;
    } catch {
      return false;
    }
  };

  return {
    name: "arcade-games",
    configResolved(config) {
      isBuild = config.command === "build";
      includeDev = !isBuild || config.env.VITE_INCLUDE_DEV_GAMES === "1";
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use("/games", (req, res, next) => {
        try {
          const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
          let file = resolve(gamesDir, "." + normalize(pathname));
          if (file !== gamesDir && !file.startsWith(gamesDir + sep)) return next();
          if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
          if (!existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader("content-type", mimeFor(extname(file)));
          res.setHeader("cache-control", "no-store");
          res.end(readFileSync(file));
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      if (!isBuild) return;
      const target = join(outDir, "games");
      mkdirSync(target, { recursive: true });
      cpSync(join(gamesDir, "_sdk"), join(target, "_sdk"), { recursive: true });
      for (const id of gameFolders()) {
        if (!includeDev && isDevGame(id)) continue;
        const result = await checkGame(join(gamesDir, id));
        if (result.errors.length) throw new Error(`El juego "${id}" no pasa check-games:\n  - ${result.errors.join("\n  - ")}`);
        cpSync(join(gamesDir, id), join(target, id), {
          recursive: true,
          filter: (p) => !/(^|[\\/])(\.DS_Store|node_modules|\.git)([\\/]|$)|\.md$/.test(p),
        });
      }
    },
  };
}
