import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (AGENTS.md § Determinism: frame hashes in a second engine). Run with
 * `npm run e2e`, which builds the test pages first (vite.e2e.config.ts).
 */
export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: { baseURL: "http://localhost:4180" },
  // Chromium only for now: Firefox and WebKit join when the scene renders (B-021).
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // A machine whose Chromium does not match this Playwright (a cloud session)
        // points to its own with PW_CHROMIUM_PATH; CI installs the matching one.
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "npx vite preview --config vite.e2e.config.ts",
    url: "http://localhost:4180/frame-hash.html",
    reuseExistingServer: !process.env.CI,
  },
});
