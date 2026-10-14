import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";
import { fileURLToPath } from "node:url";
import { gamesPlugin } from "./src/vite-games-plugin";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [preact(), gamesPlugin({ gamesDir: fileURLToPath(new URL("../../games", import.meta.url)) })],
  build: { target: "es2020", outDir: "dist", sourcemap: false },
  server: { port: 5173, host: true, fs: { allow: [fileURLToPath(new URL("../..", import.meta.url)), here] } },
  preview: { port: 4173, host: true },
  test: {
    name: "shell",
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
  },
});
