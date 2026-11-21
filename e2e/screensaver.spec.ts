import { expect, type Page, test } from "@playwright/test";

// The screensaver mode (B-021): the interface goes, the cursor hides when idle, the
// survey plays, the full screen comes with F and goes with Escape. Run in Chromium,
// Firefox and WebKit (AGENTS.md § Determinism: a claim about browser behavior is
// measured in the three engines).

/** A hash of the canvas's pixels, read back from the page. */
async function picture(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.getElementById("scene");
    if (!(canvas instanceof HTMLCanvasElement)) return "";
    const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 0x811c9dc5;
    for (const byte of data ?? []) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    return h.toString(16);
  });
}

/** Waits until the picture stops changing (the intro's flight and crossfade have ended). */
async function settled(page: Page): Promise<string> {
  let last = await picture(page);
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(150);
    const now = await picture(page);
    if (now === last) return now;
    last = now;
  }
  return last;
}

const fullscreen = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.fullscreenElement !== null);
const cursor = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.getElementById("scene") as Element).cursor);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.setViewportSize({ width: 960, height: 540 });
});

test("?screensaver hides the panel, keeps the figures' note, plays the survey", async ({
  page,
}) => {
  await page.goto("/screensaver.html?screensaver");
  await expect(page.locator("#panel-body")).toBeHidden();
  await expect(page.locator("#credits > span")).toBeHidden();
  await expect(page.locator("#plants-note")).toBeVisible();
  await expect(page.locator("#survey-area")).toHaveText("Flyover: Hauts-de-France");
  // Not full screen: only a press can ask for it.
  expect(await fullscreen(page)).toBe(false);

  // The cursor hides after 3 s without a move, and comes back with one.
  await page.mouse.move(100, 100);
  await page.waitForTimeout(3500);
  expect(await cursor(page)).toBe("none");
  await page.mouse.move(200, 150);
  expect(await cursor(page)).not.toBe("none");

  // Escape leaves the mode; the survey plays on.
  await page.keyboard.press("Escape");
  await expect(page.locator("#panel-body")).toBeVisible();
  await expect(page.locator("#survey-area")).toHaveText("Flyover: Hauts-de-France");
  await page.waitForTimeout(3500);
  expect(await cursor(page)).not.toBe("none");
});

test("F goes full screen in the mode, and Escape leaves both", async ({ page }) => {
  await page.goto("/screensaver.html");
  await expect(page.locator("#panel-body")).toBeVisible();
  await page.keyboard.press("f");
  await expect(page.locator("#panel-body")).toBeHidden();
  await expect(page.locator("#survey-area")).toHaveText("Flyover: Hauts-de-France");
  await expect.poll(() => fullscreen(page)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.locator("#panel-body")).toBeVisible();
  await expect.poll(() => fullscreen(page)).toBe(false);
});

test("the button enters and leaves the mode; Home stands in for Stop when the tour is off", async ({
  page,
}) => {
  await page.goto("/screensaver.html");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#survey-stop")).toBeHidden();
  await page.click("#screensaver");
  await expect(page.locator("#panel-body")).toBeHidden();
  await expect(page.locator("#survey-stop")).toBeVisible();
  await expect(page.locator("#home")).toBeHidden();
  await page.click("#screensaver");
  await expect(page.locator("#panel-body")).toBeVisible();
  await expect.poll(() => fullscreen(page)).toBe(false);
  await page.click("#survey-stop");
  await expect(page.locator("#survey-area")).toHaveText("");
  await expect(page.locator("#home")).toBeVisible();
});

test("?season= imposes a season whatever the date", async ({ page }) => {
  // Midsummer by the clock: winter imposed must draw another land.
  const shown = async (query: string): Promise<string> => {
    await page.goto(`/screensaver.html${query}`);
    await page.waitForTimeout(2000); // the intro: France, then the flight
    return settled(page);
  };
  const summer = await shown("?season=summer");
  expect(await shown("?season=winter")).not.toBe(summer);
  expect(await shown("")).toBe(summer);
});

test("a click on the button lets the controls fade, and so does a pause", async ({ page }) => {
  // Regression: the click left the focus on the button, and the controls never faded.
  await page.goto("/screensaver.html");
  await page.click("#screensaver");
  await expect(page.locator("#survey")).toHaveClass(/quiet/, { timeout: 6000 });
  // Regression: a paused tour kept its controls on screen in the mode.
  await page.keyboard.press("p");
  await expect(page.locator("#survey-area")).toHaveText("Flyover paused: Hauts-de-France");
  await expect(page.locator("#survey")).not.toHaveClass(/quiet/);
  await expect(page.locator("#survey")).toHaveClass(/quiet/, { timeout: 6000 });
});

test("a quick second press leaves no full screen and no wake lock behind", async ({ page }) => {
  // A wake lock answered late, counting the locks held (the real one may be refused
  // headless): regression for a lock orphaned by a second request, and a full screen
  // granted after the mode had already ended.
  await page.addInitScript(() => {
    const held = { count: 0 };
    Object.assign(window, { __held: held });
    // On the prototype, as a getter: WebKit's `navigator` keeps its own `wakeLock`
    // over a value defined on the instance.
    const stub = {
      request: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            held.count++;
            let released = false;
            const sentinel = new EventTarget();
            Object.assign(sentinel, {
              release: () => {
                if (!released) held.count--;
                released = true;
                return Promise.resolve();
              },
            });
            resolve(sentinel);
          }, 1000);
        }),
    };
    Object.defineProperty(Navigator.prototype, "wakeLock", {
      configurable: true,
      get: () => stub,
    });
  });
  const held = (): Promise<number> =>
    page.evaluate(() => (window as unknown as { __held: { count: number } }).__held.count);
  await page.goto("/screensaver.html");
  await page.keyboard.press("f");
  await page.keyboard.press("Escape");
  // Firefox may take Escape for its own way out of the full screen, and end the mode
  // only on `fullscreenchange`: F pressed before that would leave the mode instead of
  // entering it. The first lock is still pending meanwhile (1 s).
  await expect(page.locator("#panel-body")).toBeVisible();
  await expect.poll(() => fullscreen(page)).toBe(false);
  await page.keyboard.press("f");
  await expect.poll(held).toBe(1);
  await page.keyboard.press("Escape");
  await expect.poll(held).toBe(0);
  await expect.poll(() => fullscreen(page)).toBe(false);

  // Out again before the full screen and the lock are answered (a double click on the
  // button does the same in Chromium, but Firefox drops its second click).
  await page.keyboard.press("f");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  await expect(page.locator("#panel-body")).toBeVisible();
  expect(await fullscreen(page)).toBe(false);
  expect(await held()).toBe(0);
});
