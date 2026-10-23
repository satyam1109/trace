import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 40_000,
  fullyParallel: true,
  use: {
    channel: 'chrome',
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run web',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});
