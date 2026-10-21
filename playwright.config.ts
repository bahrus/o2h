import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

/**
 * Unit tests run o2h in Node (no DOM), as on a server. The equivalence test runs builtIns.tree
 * in each browser and checks that o2h's HTML matches what it builds, and that it adopts o2h's HTML.
 *
 * Inside the beGingerly workspace (a parent folder with spa-ssi installed), the browser tests are
 * served from the workspace, so /imports.html maps assign-gingerly to the sibling repo: no
 * publishing needed to test against its current source. Otherwise, o2h serves itself and
 * uses the published package. See https://playwright.dev/docs/test-configuration.
 */
const workspace = fs.existsSync('../node_modules/spa-ssi/serve.js');
const port = workspace ? 8090 : 8000;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: workspace ? `http://localhost:${port}/o2h/` : `http://localhost:${port}/`,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run serve',
    cwd: workspace ? '..' : '.',
    env: { PORT: String(port) },
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
