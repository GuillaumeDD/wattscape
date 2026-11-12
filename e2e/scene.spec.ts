import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// The scene on a page (B-011): it draws, and the wheel, a drag, the keys and a
// double-click move the camera. Measured in Chromium only for now (ARCHITECTURE §
// Browser quirks).

/** A hash of the canvas's pixels, read back from the page. */
async function picture(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.getElementById("scene");
    if (!(canvas instanceof HTMLCanvasElement)) return "";
    const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 0x811c9dc5;
    for (const byte of data ?? []) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    return `${String(canvas.width)}x${String(canvas.height)}:${h.toString(16)}`;
  });
}

/** Waits until the picture stops changing (a flight or a crossfade has ended). */
async function settled(page: Page): Promise<string> {
  let last = await picture(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const now = await picture(page);
    if (now === last) return now;
    last = now;
  }
  return last;
}

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("fills the window with a crisp buffer, an integer factor of the screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/scene.html");
  const size = await page.evaluate(() => {
    const c = document.getElementById("scene") as HTMLCanvasElement;
    return { w: c.width, h: c.height, cssW: c.getBoundingClientRect().width };
  });
  // 720 / 270 rounds to a factor of 3: 427 × 240 buffer pixels.
  expect(size).toEqual({ w: 427, h: 240, cssW: 1281 });
  expect(await settled(page)).not.toBe("");
});

test("zooms with the wheel and the keys, pans with a drag, and goes home", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html");
  const france = await settled(page);

  await page.mouse.move(480, 270);
  await page.mouse.wheel(0, -300);
  const zoomed = await settled(page);
  expect(zoomed).not.toBe(france);

  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(300, 250, { steps: 5 });
  await page.mouse.up();
  const dragged = await settled(page);
  expect(dragged).not.toBe(zoomed);

  await page.keyboard.press("Home");
  expect(await settled(page)).toBe(france);

  await page.keyboard.press("+");
  expect(await settled(page)).not.toBe(france);
  await page.keyboard.press("Home");
  expect(await settled(page)).toBe(france);

  await page.mouse.dblclick(480, 270);
  expect(await settled(page)).not.toBe(france);
});

test("flies from France to the viewer's region, with the 1 km relief", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  const relief: string[] = [];
  page.on("request", (request) => {
    if (/relief/.test(request.url())) relief.push(request.url());
  });
  await page.goto("/scene.html?area=28");
  // France first, for 1.5 s, then the flight.
  await page.waitForTimeout(500);
  const intro = await picture(page);
  await page.waitForTimeout(1500);
  const region = await settled(page);
  expect(region).not.toBe(intro);
  expect(relief.length).toBe(1);
  // Zooming out to France crossfades back to the 4 km layer, without a new download.
  await page.keyboard.press("-");
  await page.keyboard.press("-");
  await page.keyboard.press("-");
  expect(await settled(page)).not.toBe(region);
  expect(relief.length).toBe(1);
});

test("a wheel turn during a flight zooms from where the camera is, not from where it left", async ({
  page,
}) => {
  // Regression: the wheel zoomed from the flight's start, and the view jumped back.
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html");
  await settled(page);
  await page.mouse.move(480, 270);
  await page.mouse.wheel(0, -100);
  const wheelOnly = await settled(page);

  await page.keyboard.press("Home");
  await settled(page);
  await page.keyboard.press("+");
  await page.waitForTimeout(250); // mid-flight
  await page.mouse.wheel(0, -100);
  const duringFlight = await settled(page);
  expect(duringFlight).not.toBe(wheelOnly);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("a double-tap zooms in once, and a mouse double-click still works after a tap", async ({
    page,
  }) => {
    // Regression: the double-tap could zoom twice (the browser's own dblclick), and
    // after one tap a mouse double-click never zoomed again.
    await page.setViewportSize({ width: 960, height: 540 });
    await page.goto("/scene.html");
    const france = await settled(page);
    await page.mouse.dblclick(480, 270);
    const doubleClicked = await settled(page);
    expect(doubleClicked).not.toBe(france);

    await page.keyboard.press("Home");
    expect(await settled(page)).toBe(france);
    await page.touchscreen.tap(480, 270);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(480, 270);
    expect(await settled(page)).toBe(doubleClicked);

    await page.keyboard.press("Home");
    expect(await settled(page)).toBe(france);
    await page.touchscreen.tap(200, 200);
    await page.waitForTimeout(500);
    await page.mouse.dblclick(480, 270);
    expect(await settled(page)).toBe(doubleClicked);
  });
});

// The plants (B-012): one request for every region, then motion while the camera is still.
const DAY_STEP = readFileSync(
  new URL("../tests/fixtures/eco2mix/2026-11-12-all-regions.json", import.meta.url),
  "utf8",
);

test("animates the plants from one answer for every region, the camera still", async ({ page }) => {
  const asked: string[] = [];
  await page.route("https://odre.opendatasoft.com/**", (route) => {
    asked.push(route.request().url());
    return route.fulfill({ body: DAY_STEP, contentType: "application/json" });
  });
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html?area=28&plants=live");
  await expect(page.locator("#plants-note")).toHaveText("live");
  // Past the intro flight, the picture still changes: the plants move.
  await page.waitForTimeout(3500);
  const pictures = new Set<string>();
  for (let i = 0; i < 6; i++) {
    pictures.add(await picture(page));
    await page.waitForTimeout(170);
  }
  expect(pictures.size).toBeGreaterThan(1);
  expect(asked).toHaveLength(1);
  expect(asked[0]).toContain("eco2mix-regional-tr/records");
  expect(new URL(asked[0] ?? "").searchParams.get("limit")).toBe("24");
});

test("leaves the plants idle and still when the data is unavailable", async ({ page }) => {
  await page.route("https://odre.opendatasoft.com/**", (route) => route.abort());
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html?area=28&plants=live");
  await expect(page.locator("#plants-note")).toHaveText("unavailable");
  await page.waitForTimeout(3500);
  const still = await picture(page);
  await page.waitForTimeout(600);
  expect(await picture(page)).toBe(still);
});

// The time-lapse (B-014): one request for the day, then each step in turn.
const HISTORY = readFileSync(
  new URL("../tests/fixtures/eco2mix/2026-11-12-history-3h.json", import.meta.url),
  "utf8",
);

test("replays the steps of the day from one request, the light moving", async ({ page }) => {
  const asked: string[] = [];
  await page.route("https://odre.opendatasoft.com/**", (route) => {
    asked.push(route.request().url());
    return route.fulfill({ body: HISTORY, contentType: "application/json" });
  });
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html?area=28&plants=replay");
  await expect(page.locator("#plants-note")).toHaveText(/^replay \d+$/);
  const notes = new Set<string>();
  for (let i = 0; i < 25; i++) {
    notes.add((await page.locator("#plants-note").textContent()) ?? "");
    await page.waitForTimeout(250);
  }
  // Twelve steps in 6 seconds: most of them seen in 6 seconds of watching.
  expect(notes.size).toBeGreaterThan(6);
  expect(asked).toHaveLength(1);
  expect(asked[0]).toContain("eco2mix-regional-tr/exports/json");
});
