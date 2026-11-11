/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";

/**
 * The dev server's live reload talks to the page over a WebSocket on the dev origin,
 * which the production CSP (connect-src = the two API hosts only) blocks. Only while
 * serving, allow it; `vite build` ships the CSP of index.html unchanged.
 */
function devCsp(): Plugin {
  return {
    name: "wattscape-dev-csp",
    apply: "serve",
    transformIndexHtml(html) {
      return html.replace("connect-src ", "connect-src 'self' ws: ");
    },
  };
}

export default defineConfig({
  // Served from https://<user>.github.io/wattscape/
  base: "/wattscape/",
  plugins: [devCsp()],
  build: {
    target: "es2022",
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
