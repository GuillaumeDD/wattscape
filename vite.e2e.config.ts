import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Builds the pages the browser tests open (e2e/*.html) into dist-e2e/, apart from the
 * site's own build. `npm run e2e` builds them, then Playwright serves and opens them.
 */
export default defineConfig({
  root: "e2e",
  base: "./",
  build: {
    target: "es2022",
    outDir: "../dist-e2e",
    emptyOutDir: true,
    // Resolved from this file, so the build works from any working directory.
    rolldownOptions: {
      input: { "frame-hash": fileURLToPath(new URL("./e2e/frame-hash.html", import.meta.url)) },
    },
  },
  preview: { port: 4180, strictPort: true },
});
