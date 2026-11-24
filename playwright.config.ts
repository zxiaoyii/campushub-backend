import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration for CampusHub.
 *
 * Playwright owns both halves of the stack: `e2e/support/start-stack.ts`
 * seeds an ephemeral MongoDB and starts the API on port 3100, and the Vite
 * dev server runs on 5174 with its `/api` proxy pointed at that API. Both
 * ports are deliberately not the development ones, so a run is isolated from
 * a stack the developer already has open, and neither server is reused: a
 * suite that asserts on booking counts must start from a known database.
 */
const API_PORT = 3100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  // One database backs the whole run, so the scenarios execute one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${String(WEB_PORT)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // WebKit is left out on purpose: on macOS 14 Playwright can only install the
  // "special" WebKit build, whose remote protocol this version cannot drive
  // (`Page.overrideSetting: Unknown setting`). Adding the project would mean a
  // suite that is red on the machine it was written on.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],

  webServer: [
    {
      command: 'node e2e/support/start-stack.ts',
      url: `http://127.0.0.1:${String(API_PORT)}/api/v1/health`,
      reuseExistingServer: false,
      // The first run downloads the in-memory MongoDB binary.
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --port ${String(WEB_PORT)} --strictPort`,
      cwd: 'client',
      url: `http://localhost:${String(WEB_PORT)}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${String(API_PORT)}` },
    },
  ],
});
