import { cpSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  clean: true,
  // @arcade/protocol es TypeScript sin compilar dentro del workspace: se incluye en el bundle.
  // Las demás dependencias (hono, pg, pglite, zod…) quedan externas y se instalan en la imagen.
  noExternal: ["@arcade/protocol"],
  // Las migraciones SQL se leen del disco en tiempo de ejecución: dist/migrations junto a dist/server.js.
  onSuccess: async () => {
    cpSync("src/db/migrations", "dist/migrations", { recursive: true });
  },
});
