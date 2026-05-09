import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Stage B E2E tests.
 *
 * In CI the BASE_URL env var is set to the Vercel Preview URL by the
 * `patrickedqvist/wait-for-vercel-preview` action before Playwright runs.
 * Locally you can override it: BASE_URL=http://localhost:4321 npx playwright test
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4321';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // SSE tests can be chatty — run serially to keep logs readable
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    // Give SSE streams time to produce their first event
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer block — in CI we point at the live Vercel Preview.
  // For local use: start `npm run dev` in a separate terminal first.
});
