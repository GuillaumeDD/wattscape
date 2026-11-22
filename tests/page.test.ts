/**
 * The page itself (index.html): its CSP and its links out (ARCHITECTURE § Security),
 * read as text, so that a link added to the panel (B-031) never loosens either.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("index.html", () => {
  it("keeps the strict CSP: the two API hosts only, nothing inline", () => {
    const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1];
    expect(csp).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
        "connect-src https://odre.opendatasoft.com https://api.open-meteo.com; " +
        "object-src 'none'; base-uri 'self'; form-action 'none'",
    );
  });

  it("links to the repository from the panel (B-031)", () => {
    const panel = html.slice(html.indexOf('<div id="panel-body">'), html.indexOf("</main>"));
    expect(panel).toMatch(
      /<a\s+id="repo-link"\s+href="https:\/\/github\.com\/GuillaumeDD\/wattscape"/,
    );
  });

  it("links to the repository from the credits too (B-040)", () => {
    const credits = html.slice(html.indexOf('<footer id="credits">'), html.indexOf("</footer>"));
    expect(credits).toMatch(
      /<a\s+id="credits-repo"\s+href="https:\/\/github\.com\/GuillaumeDD\/wattscape"\s+rel="noopener noreferrer"/,
    );
  });

  it("opens every link out without handing the page to it", () => {
    const links = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
    const out = links.filter((a) => /href="https?:/.test(a));
    expect(out.length).toBeGreaterThan(5);
    for (const a of out) expect(a, a).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });
});
