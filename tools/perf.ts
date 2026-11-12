/**
 * Measures the performance budget (B-013, ARCHITECTURE § Performance) on the built
 * site, served by `vite preview` (never the dev server). Run by hand:
 *
 *   npm run build
 *   node --experimental-strip-types tools/perf.ts frames [--throttle 4]
 *   node --experimental-strip-types tools/perf.ts soak <minutes> [out.jsonl]
 *
 * `frames`: a 1920 × 1080 window (a 480 × 270 buffer, factor 4) through the views a
 * screensaver spends its time in, from fixed inputs (`?sample=`, `?at=`): France
 * still, a region with its plants moving, by day and at night, the flight France →
 * region, the idle drift, and the wheel zooming in and out across the crossfade (the
 * worst case: a full redraw every frame). For each it gives the main-thread time of
 * every animation-frame callback (all of the scene's work, `putImageData` included)
 * and the main thread's busy time per second, from the DevTools metrics. With
 * `--throttle N`, Chromium slows the CPU N times (a slower laptop).
 *
 * `soak`: the live page (real clock, live éCO2mix) left alone in a region for
 * `minutes`, as a screensaver is. Every minute, after a forced garbage collection, it
 * writes one line: the JS heap, the DOM counters, the busy time since the last line
 * and the requests made. The heap must stay flat.
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { chromium, type CDPSession, type Page } from "@playwright/test";

const PORT = 4318;
const ORIGIN = `http://localhost:${String(PORT)}`;
const BASE = `${ORIGIN}/wattscape/`;
const DAY = "sample=day&at=2026-11-12T10:00Z";
const NIGHT = "sample=night&at=2026-11-12T01:15Z";

const [mode = "frames", ...rest] = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = rest.indexOf(name);
  return i === -1 ? undefined : rest[i + 1];
};

if (!existsSync("dist/index.html")) throw new Error("run `npm run build` first");
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

/** Times every animation-frame callback, on the page's own clock. */
const TIMER = `
  window.__frames = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => raf((t) => {
    const start = performance.now();
    callback(t);
    window.__frames.push(performance.now() - start);
  });
`;

async function newPage(): Promise<{ page: Page; cdp: CDPSession }> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(TIMER);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const throttle = Number(flag("--throttle") ?? "1");
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  return { page, cdp };
}

async function busySeconds(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return metrics.find((m) => m.name === "TaskDuration")?.value ?? 0;
}

const quantile = (sorted: number[], q: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

/** Runs `act` for `ms` and reports the frames drawn meanwhile. */
async function measure(
  name: string,
  page: Page,
  cdp: CDPSession,
  ms: number,
  act: () => Promise<void> = () => page.waitForTimeout(ms),
): Promise<void> {
  await page.evaluate("window.__frames.length = 0");
  const busy0 = await busySeconds(cdp);
  const t0 = performance.now();
  await act();
  const elapsed = (performance.now() - t0) / 1000;
  const busy = (await busySeconds(cdp)) - busy0;
  const frames = await page.evaluate<number[]>("window.__frames");
  // Callbacks under 0.2 ms only check the time and go back to sleep: not frames drawn.
  const drawn = frames.filter((f) => f >= 0.2).sort((a, b) => a - b);
  const fmt = (v: number): string => v.toFixed(2).padStart(6);
  console.log(
    `${name.padEnd(26)} ${String(drawn.length).padStart(5)} frames in ${elapsed.toFixed(1)} s` +
      `  p50 ${fmt(quantile(drawn, 0.5))}  p95 ${fmt(quantile(drawn, 0.95))}` +
      `  max ${fmt(drawn.at(-1) ?? 0)} ms   busy ${fmt((busy / elapsed) * 1000)} ms/s`,
  );
}

if (mode === "frames") {
  console.log(
    `1920 × 1080, CPU throttling ${flag("--throttle") ?? "1"}×; frame times are main-thread ms per drawn frame`,
  );
  for (const [label, query] of [
    ["day", DAY],
    ["night", NIGHT],
  ] as const) {
    const { page, cdp } = await newPage();
    await page.goto(`${BASE}?area=FR&${query}`);
    await page.waitForTimeout(3000);
    await measure(`France still, ${label}`, page, cdp, 8000);

    // The flight to Normandie, four times there and back.
    await measure(`flight France ↔ region`, page, cdp, 0, async () => {
      for (let k = 0; k < 4; k++) {
        await page.selectOption("#area", "28");
        await page.waitForTimeout(3500);
        await page.selectOption("#area", "FR");
        await page.waitForTimeout(3500);
      }
    });
    await page.selectOption("#area", "28");
    await page.waitForTimeout(5000);
    await measure(`Normandie plants, ${label}`, page, cdp, 8000);

    // The wheel, in and out across the crossfade: a full redraw every frame.
    await page.mouse.move(960, 540);
    await measure(`wheel zoom (worst case)`, page, cdp, 0, async () => {
      for (let k = 0; k < 160; k++) {
        await page.mouse.wheel(0, Math.floor(k / 20) % 2 === 0 ? 120 : -120);
        await page.waitForTimeout(50);
      }
    });
    await measure(`drag pan`, page, cdp, 0, async () => {
      await page.mouse.down();
      for (let k = 0; k < 160; k++) {
        await page.mouse.move(960 + 300 * Math.sin(k / 10), 540 + 200 * Math.cos(k / 13));
        await page.waitForTimeout(50);
      }
      await page.mouse.up();
    });
    // Left alone: the drift starts 20 s after the last input.
    await page.waitForTimeout(22_000);
    await measure(`idle drift, ${label}`, page, cdp, 10_000);
    await page.context().close();
  }
} else if (mode === "soak") {
  const minutes = Number(rest[0] ?? "240");
  const out = rest[1] ?? "perf-soak.jsonl";
  writeFileSync(out, "");
  const { page, cdp } = await newPage();
  await cdp.send("HeapProfiler.enable");
  let requests: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(ORIGIN)) requests.push(new URL(r.url()).host);
  });
  await page.goto(`${BASE}?area=28`);
  const start = performance.now();
  let busy0 = await busySeconds(cdp);
  for (let minute = 0; minute <= minutes; minute++) {
    if (minute > 0) await page.waitForTimeout(start + minute * 60_000 - performance.now());
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    const dom = await cdp.send("Memory.getDOMCounters");
    const busy = await busySeconds(cdp);
    const frames = await page.evaluate<number>("window.__frames.splice(0).length");
    const note = await page.evaluate(() => document.getElementById("plants-note")?.textContent);
    const line = {
      minute,
      heapUsedMB: Math.round((heap.usedSize / 1e6) * 100) / 100,
      heapTotalMB: Math.round((heap.totalSize / 1e6) * 100) / 100,
      nodes: dom.nodes,
      listeners: dom.jsEventListeners,
      busyMsPerS: Math.round(((busy - busy0) / 60) * 1000 * 10) / 10,
      callbacks: frames,
      requests,
      note,
    };
    busy0 = busy;
    requests = [];
    appendFileSync(out, `${JSON.stringify(line)}\n`);
    console.log(JSON.stringify(line));
  }
} else throw new Error(`unknown mode ${mode}`);

await browser.close();
server.kill();
