import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:18787", reducedMotion: "reduce", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && node test/fixtures/local-stack.js",
    env: { VITE_API_BASE_URL: "" },
    url: "http://127.0.0.1:18787/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
