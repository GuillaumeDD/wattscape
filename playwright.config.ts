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
  // Every test in Chromium; the screensaver mode's (B-021: full screen, cursor, keys)
  // in Firefox and WebKit too. The frame hashes and the scene's controls stay
  // Chromium-only until they are measured in the other two (ARCHITECTURE § Browser
  // quirks).
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
    // A cloud session has only its own Chromium (PW_CHROMIUM_PATH): there, the other
    // two engines are left to CI.
    ...(process.env.PW_CHROMIUM_PATH
      ? []
      : [
          {
            name: "firefox",
            testMatch: "screensaver.spec.ts",
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            testMatch: "screensaver.spec.ts",
            use: { ...devices["Desktop Safari"] },
          },
        ]),
  ],
  webServer: {
    command: "npx vite preview --config vite.e2e.config.ts",
    url: "http://localhost:4180/frame-hash.html",
    reuseExistingServer: !process.env.CI,
  },
});
