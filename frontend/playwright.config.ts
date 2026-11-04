import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 180000, workers: 1,
  expect: { timeout: 30000 },
  use: { baseURL: 'http://localhost:8000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], headless: process.env.PW_HEADLESS === '1' } }],
  webServer: [
    { command: 'node ../backend/tests/serve-qa.cjs', url: 'http://localhost:3000/api-docs/', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run dev -- --host localhost', url: 'http://localhost:8000', reuseExistingServer: false, timeout: 60000 },
  ],
});
