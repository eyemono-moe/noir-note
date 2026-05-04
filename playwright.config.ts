import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 *
 * Tests live in e2e/*.e2e.ts to keep them separate from Vitest unit tests
 * (which only pick up *.test.ts / *.spec.ts).
 *
 * Each test gets an isolated browser context, so OPFS storage is always
 * fresh — no manual clean-up between tests is required.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // Run tests serially to keep a single dev-server instance stable.
  workers: 1,
  // Retry once on CI to reduce flakiness from startup timing.
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173",
    // Keep a trace on first retry so failures are debuggable.
    trace: "retain-on-failure",
    // Screenshot on failure.
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // OPFS has the best support in Chromium.
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "vp dev",
    url: "http://localhost:5173",
    // Re-use a running dev server in local dev; always start fresh on CI.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
