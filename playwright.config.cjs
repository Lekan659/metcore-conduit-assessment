const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run start -w backend",
      url: "http://127.0.0.1:3101/",
      env: { NODE_ENV: "test", PORT: "3101" },
      reuseExistingServer: false,
      timeout: 120_000,
      name: "backend-test",
    },
    {
      command: "npm run dev -w frontend -- --host 127.0.0.1 --port 3100 --strictPort",
      url: "http://127.0.0.1:3100/",
      env: { API_PORT: "3101" },
      reuseExistingServer: false,
      timeout: 120_000,
      name: "frontend-test",
    },
  ],
});
