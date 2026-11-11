import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// The hashes Node draws (tests/render.test.ts): the browser must draw the same frames.
const expected = JSON.parse(
  readFileSync(new URL("../tests/fixtures/frames/hashes.json", import.meta.url), "utf8"),
) as Record<string, string>;

test("draws the same frames as Node", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/frame-hash.html");
  await expect(page.locator("#hashes")).not.toBeEmpty();
  const hashes = JSON.parse((await page.locator("#hashes").textContent()) ?? "{}") as Record<
    string,
    string
  >;
  expect(hashes["test-card"]).toBe(expected["test-card"]);
  expect(errors).toEqual([]);
});
