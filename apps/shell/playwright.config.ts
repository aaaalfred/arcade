import { defineConfig, devices } from "@playwright/test";

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
  globalSetup: "./e2e/global-setup.ts",
});
