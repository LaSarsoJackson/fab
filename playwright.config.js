const { defineConfig } = require("@playwright/test");

const TEST_APP_PORT = process.env.PLAYWRIGHT_APP_PORT || "4173";
const TEST_IMAGE_PORT = process.env.PLAYWRIGHT_IMAGE_PORT || "8173";
const TEST_BASE_URL = `http://127.0.0.1:${TEST_APP_PORT}`;

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: TEST_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1440, height: 960 },
  },
  webServer: {
    command: `PORT=${TEST_APP_PORT} IMAGE_SERVER_PORT=${TEST_IMAGE_PORT} bash ./scripts/start-test-server.sh`,
    url: TEST_BASE_URL,
    reuseExistingServer: process.env.PW_REUSE_EXISTING_SERVER === "1",
    timeout: 120_000,
  },
});
