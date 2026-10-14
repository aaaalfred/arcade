import { defineConfig, devices } from "@playwright/test";

const API = "http://localhost:8787";
const SHELL = "http://localhost:4173";

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: SHELL, ...devices["Pixel 7"], locale: "es-MX", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium-movil" }],
  webServer: [
    {
      // Los límites de la API viven en el proceso: siempre arrancarla de cero.
      command: "pnpm --filter @arcade/api exec tsx src/server.ts",
      cwd: "../..",
      url: `${API}/v1/health`,
      reuseExistingServer: false,
      env: { DB_MEMORY: "1", INCLUDE_DEV_GAMES: "1", PORT: "8787" },
      timeout: 60_000,
    },
    {
      command: "pnpm build && pnpm preview --strictPort",
      cwd: ".",
      url: SHELL,
      reuseExistingServer: false,
      env: { VITE_API_URL: API, VITE_INCLUDE_DEV_GAMES: "1", VITE_SIM_AD_MS: "300" },
      timeout: 120_000,
    },
  ],
});
