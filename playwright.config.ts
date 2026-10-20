import { defineConfig, devices } from '@playwright/test';

/**
 * Unit tests run o2h in Node (no DOM), as on a server. The equivalence test runs builtIns.tree
 * in each browser and checks that o2h's HTML matches what it builds.
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run serve',
    port: 8000,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
