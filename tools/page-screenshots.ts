/**
 * Shoots the page itself, controls and all, from fixed inputs (`?sample=`, `?at=`,
 * `?weather=`), on the built site served by `vite preview`, into docs/screenshots/.
 * Run by hand:
 *
 *   npm run build
 *   node --experimental-strip-types tools/page-screenshots.ts [out-dir]
 *
 * The survey mode (B-032, `step-15-survey-*.png`): Play pressed from Bretagne by day
 * (pixel art) and from Provence-Alpes-Côte d'Azur at night (modern theme), on a
 * 1280 × 720 window, and from Bretagne on a phone; a picture mid-flight, 5 s after
 * Play, and one on arrival, the controls woken by a move of the mouse. The
 * screensaver mode (B-021, `step-16-screensaver-*.png`), as its section below says.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = process.argv[2] ?? "docs/screenshots";
const PORT = 4319;
const BASE = `http://localhost:${String(PORT)}/wattscape/`;

if (!existsSync("dist/index.html")) throw new Error("run `npm run build` first");
mkdirSync(OUT, { recursive: true });
const server = spawn("npx", ["vite", "preview", "--strictPort", "--port", String(PORT)], {
  stdio: "ignore",
});
process.on("exit", () => server.kill());
for (let i = 0; ; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    // Not up yet.
  }
  if (i === 100) throw new Error("vite preview did not start");
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const DAY = "sample=day&at=2026-11-12T09:45Z&weather=clear";
const NIGHT = "sample=night&at=2026-11-12T01:00Z&weather=clear";
const shots = [
  { name: "normandie-day", query: `area=53&${DAY}`, width: 1280, height: 720, phone: false },
  {
    name: "occitanie-night-modern",
    query: `area=93&${NIGHT}&theme=modern`,
    width: 1280,
    height: 720,
    phone: false,
  },
  { name: "phone", query: `area=53&${DAY}`, width: 390, height: 844, phone: true },
];
for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.phone ? 2 : 1,
  });
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(`${BASE}?${shot.query}`);
  // The intro: France, then the flight to the region.
  await page.waitForTimeout(4000);
  await page.click("#survey-play");
  await page.waitForTimeout(5000);
  if (!shot.phone) await page.screenshot({ path: `${OUT}/step-15-survey-${shot.name}-flight.png` });
  await page.waitForTimeout(9000);
  // The controls faded away: a move of the mouse near them brings them back.
  await page.mouse.move(shot.width - 30, shot.height - 120);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/step-15-survey-${shot.name}.png` });
  console.log(shot.name, await page.locator("#survey-area").textContent());
  await page.close();
}

// The screensaver mode (B-021, `step-16-screensaver-*.png`): opened by `?screensaver`
// by day (pixel art), then in winter by `?season=`; and entered with F from
// Provence-Alpes-Côte d'Azur at night (modern theme). Each on arrival at the tour's
// first stop, the mouse left still: no controls, no cursor.
const savers = [
  { name: "day", query: `screensaver&area=53&${DAY}`, pressF: false },
  { name: "winter", query: `screensaver&area=53&${DAY}&season=winter`, pressF: false },
  { name: "night-modern", query: `area=93&${NIGHT}&theme=modern`, pressF: true },
];
for (const shot of savers) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(`${BASE}?${shot.query}`);
  if (shot.pressF) {
    await page.waitForTimeout(4000);
    await page.keyboard.press("f");
  }
  await page.waitForTimeout(16_000);
  await page.screenshot({ path: `${OUT}/step-16-screensaver-${shot.name}.png` });
  console.log(shot.name, await page.locator("#survey-area").textContent());
  await page.close();
}
await browser.close();
// The preview server is a child of npx: end everything at once.
process.exit(0);
