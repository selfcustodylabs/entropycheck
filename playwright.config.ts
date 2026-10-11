import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: 'list',
  use: { headless: true, trace: process.env.CI ? 'retain-on-failure' : 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'firefox', use: { browserName: 'firefox' } }],
  webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173', timeout: 120_000, reuseExistingServer: false },
});
