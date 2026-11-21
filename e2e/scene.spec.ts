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

test("the survey tours the regions, pauses on P or a drag, and Home ends it (B-032)", async ({
  page,
}) => {
  // Two slow flights of up to 12 s each, and a stay to check that the camera holds still.
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html");
  const france = await settled(page);
  const note = page.locator("#survey-note");

  // From France, the tour starts with the north.
  await page.keyboard.press("p");
  await expect(note).toHaveText("playing 32");
  await page.waitForTimeout(1000);
  expect(await picture(page)).not.toBe(france);
  await page.waitForTimeout(12_000);
  const north = await settled(page);
  expect(north).not.toBe(france);
  // It stays there, still: no drift during a stay.
  await page.waitForTimeout(2000);
  expect(await picture(page)).toBe(north);
  // A resize during the stay reframes the stop at once, without a flight
  // (regression: it flew 6 s to the same place, then stayed 40 s again).
  await page.setViewportSize({ width: 900, height: 540 });
  await page.waitForTimeout(600);
  const reframed = await picture(page);
  await page.waitForTimeout(1000);
  expect(await picture(page)).toBe(reframed);
  await expect(note).toHaveText("playing 32");
  await page.setViewportSize({ width: 960, height: 540 });
  await page.waitForTimeout(600);
  expect(await picture(page)).toBe(north);

  await page.keyboard.press("p");
  await expect(note).toHaveText("paused 32");
  await page.keyboard.press("p");
  await expect(note).toHaveText("playing 32");

  // A drag takes the camera, and pauses the tour.
  await page.mouse.move(400, 300);
  await page.mouse.down();
  await page.mouse.move(300, 250, { steps: 5 });
  await page.mouse.up();
  await expect(note).toHaveText("paused 32");

  // Home ends it, and flies back home, slowly.
  await page.keyboard.press("p");
  await expect(note).toHaveText("playing 32");
  await page.keyboard.press("Home");
  await expect(note).toHaveText("off");
  // Regression: a stop reported a pause on its way to "off".
  await expect(page.locator("#survey-log")).toHaveText(/playing;off;$/);
  await page.waitForTimeout(12_000);
  expect(await settled(page)).toBe(france);
});

test("a key still reaches the map after a click on a button, but not Enter or Space", async ({
  page,
}) => {
  // Regression: after a click on Play, the button kept the focus and P did nothing.
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html");
  await settled(page);
  await page.click("#theme-toggle");
  await page.keyboard.press("p");
  await expect(page.locator("#survey-note")).toHaveText("playing 32");
  await page.keyboard.press("Enter"); // presses the button: the theme changes back, the tour plays on
  await expect(page.locator("#survey-note")).toHaveText("playing 32");
});

/** The caption the page shows: the landmark's id and its left edge, or "". */
async function caption(page: Page): Promise<string> {
  return (await page.locator("#caption").textContent()) ?? "";
}

/** Moves the mouse over a patch of the page until a caption shows; where, or null. */
async function findCaption(
  page: Page,
  left: number,
  top: number,
  size: number,
): Promise<[number, number] | null> {
  for (let y = top; y < top + size; y += 3)
    for (let x = left; x < left + size; x += 3) {
      await page.mouse.move(x, y);
      if ((await caption(page)) !== "") return [x, y];
    }
  return null;
}

test("shows a landmark's or a plant's caption under the mouse, and hides it when it leaves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html?area=28");
  await page.waitForTimeout(2500);
  await settled(page);
  // Étretat stands on the coast, in the top half of Normandie's frame.
  const at = await findCaption(page, 420, 120, 140);
  expect(at).not.toBeNull();
  const shown = await caption(page);
  expect(shown).toMatch(/^(P-0\d\d|[a-z]+@[\d.]+,[\d.]+) -?\d+$/);
  // The mouse rests: the caption stays; off the canvas, it goes.
  await page.waitForTimeout(500);
  expect(await caption(page)).toBe(shown);
  await page.mouse.move(0, 0);
  await page.mouse.move(-5, -5);
  await page.dispatchEvent("#scene", "pointerleave", { pointerType: "mouse" });
  expect(await caption(page)).toBe("");
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("a tap shows a landmark's or a plant's caption, a tap elsewhere hides it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.goto("/scene.html?area=28");
    await page.waitForTimeout(2500);
    await settled(page);
    const at = await findCaption(page, 420, 120, 140);
    if (at === null) throw new Error("no landmark found");
    await page.dispatchEvent("#scene", "pointerleave", { pointerType: "mouse" });
    expect(await caption(page)).toBe("");
    await page.touchscreen.tap(at[0], at[1]);
    expect(await caption(page)).not.toBe("");
    await page.waitForTimeout(400);
    await page.touchscreen.tap(60, 500);
    expect(await caption(page)).toBe("");
  });

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

test("animates the modern theme's plants on its sharp frame, the camera still", async ({
  page,
}) => {
  await page.route("https://odre.opendatasoft.com/**", (route) =>
    route.fulfill({ body: DAY_STEP, contentType: "application/json" }),
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/scene.html?area=28&plants=live&theme=modern");
  await expect(page.locator("#plants-note")).toHaveText("live");
  await page.waitForTimeout(3500);
  // The motion goes to the canvas box by box (D-058): the picture still changes.
  const pictures = new Set<string>();
  for (let i = 0; i < 6; i++) {
    pictures.add(await picture(page));
    await page.waitForTimeout(170);
  }
  expect(pictures.size).toBeGreaterThan(1);
  for (const one of pictures) expect(one.startsWith("1920x1080:")).toBe(true);
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

test("draws the modern theme at several pixels per scene pixel, with its captions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html?area=28&theme=modern");
  await page.waitForTimeout(2500);
  await settled(page);
  const canvas = await page.evaluate(() => {
    const c = document.getElementById("scene") as HTMLCanvasElement;
    return {
      w: c.width,
      h: c.height,
      cssW: c.getBoundingClientRect().width,
      // The class the page's stylesheet scales smoothly (src/style.css).
      smooth: c.classList.contains("smooth"),
    };
  });
  // 540 / 270 rounds to 2, raised to the least factor, 3: a scene of 320 × 180,
  // drawn at 3 output pixels each (a small window), the screen's own pixels.
  expect(canvas).toEqual({ w: 960, h: 540, cssW: 960, smooth: true });
  // The captions answer at the same places of the page as in pixel art.
  const at = await findCaption(page, 420, 120, 140);
  expect(at).not.toBeNull();
  expect(await caption(page)).toMatch(/^(P-0\d\d|[a-z]+@[\d.]+,[\d.]+) -?\d+$/);
});

test("switches theme in place: the camera stays, and pixel art comes back as it was", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/scene.html");
  await page.mouse.move(960, 540);
  await page.mouse.wheel(0, -300);
  const pixel = await settled(page);
  expect(pixel.startsWith("480x270:")).toBe(true);

  await page.click("#theme-toggle");
  const modern = await settled(page);
  // Full HD: the sharp density, the screen's own 4 pixels per scene pixel (D-058).
  expect(modern.startsWith("1920x1080:")).toBe(true);
  expect(await page.locator("#scene").evaluate((c) => c.classList.contains("smooth"))).toBe(true);
  expect(await page.locator("#scene").evaluate((c) => c.getBoundingClientRect().width)).toBe(1920);

  await page.click("#theme-toggle");
  expect(await settled(page)).toBe(pixel);
  expect(await page.locator("#scene").evaluate((c) => c.classList.contains("smooth"))).toBe(false);
});

test("keeps the camera still with the drift off, and Space switches it (B-036)", async ({
  page,
}) => {
  // A fake clock, so that minutes of rest pass at once.
  await page.clock.install();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/scene.html?drift=off");
  await page.clock.runFor(3000);
  const still = await picture(page);

  // Off: a minute of rest, long after the drift would have started, moves nothing.
  await page.clock.runFor(60_000);
  expect(await picture(page)).toBe(still);

  // On, after that long rest: no jump, then the drift starts after its own rest.
  await page.keyboard.press("Space");
  await page.clock.runFor(500);
  expect(await picture(page)).toBe(still);
  await page.clock.runFor(60_000);
  const drifting = await picture(page);
  expect(drifting).not.toBe(still);

  // Off again, mid-drift: the camera stays where it is on screen.
  await page.keyboard.press("Space");
  await page.clock.runFor(500);
  const stopped = await picture(page);
  await page.clock.runFor(60_000);
  expect(await picture(page)).toBe(stopped);
});

test("lets the intro's flight land when Space is pressed during it (B-036)", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/scene.html?area=28");
  await page.clock.runFor(10_000);
  const landed = await picture(page);

  await page.goto("/scene.html?area=28");
  // Mid-flight: the intro shows France for 1.5 s, then flies for up to 3 s.
  await page.clock.runFor(2500);
  await page.keyboard.press("Space");
  await page.clock.runFor(7500);
  expect(await picture(page)).toBe(landed);
});

test("Space during the survey switches the drift and leaves the tour playing (B-036)", async ({
  page,
}) => {
  await page.clock.install();
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/scene.html");
  await page.clock.runFor(3000);
  await page.keyboard.press("p");
  await expect(page.locator("#survey-note")).toHaveText("playing 32");
  // Over 20 s into the tour, past the rest after the press of P.
  await page.clock.runFor(25_000);
  await page.keyboard.press("Space");
  await page.clock.runFor(1000);
  await expect(page.locator("#survey-note")).toHaveText(/^playing /);
  await expect(page.locator("#survey-log")).toHaveText("playing;");
});
