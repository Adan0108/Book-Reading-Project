import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./compose-tests",
  timeout: 180000,
  workers: 1,
  expect: { timeout: 30000 },
  outputDir: "compose-results",
  use: {
    baseURL: process.env.COMPOSE_QA_URL || "http://localhost:8087",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: process.env.PW_HEADLESS === "1",
      },
    },
  ],
});
