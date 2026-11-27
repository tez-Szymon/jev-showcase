import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  projects: [
    { name: "manual", use: { baseURL: "http://127.0.0.1:3101" } },
    { name: "jev", use: { baseURL: "http://127.0.0.1:3102" } },
  ],
  webServer: [
    {
      command: "node --import tsx tests/fixtures/transport-server.ts",
      url: "http://127.0.0.1:3199/health",
      reuseExistingServer: false,
    },
    {
      command: "node --import tsx tests/fixtures/start-app.ts manual",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
    },
    {
      command: "node --import tsx tests/fixtures/start-app.ts jev",
      url: "http://127.0.0.1:3102",
      reuseExistingServer: false,
    },
  ],
});
