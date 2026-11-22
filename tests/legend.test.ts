import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseEco2mixRegions,
  REGION_CODES,
  SOURCES,
  type Eco2mixReading,
  type RegionalReadings,
  type RegionCode,
  type Source,
} from "../src/data/eco2mix";
import { LOCALES, translate, type MessageKey } from "../src/i18n";
import { PALETTE } from "../src/render/palette";
import {
  formatMw,
  formatShare,
  LEGEND_ORDER,
  legendFigures,
  legendText,
  sourceColour,
} from "../src/ui/legend";
import { type FeedState } from "../src/ui/plant-feed";
import { mulberry32 } from "./random";

/** A recorded step of every region (2026-11-12, 09:45 UTC), as `?sample=day` shows it. */
function recorded(name: string): RegionalReadings {
  const body: unknown = JSON.parse(readFileSync(`tests/fixtures/eco2mix/${name}.json`, "utf8"));
  const result = parseEco2mixRegions(body);
  if (!result.ok) throw new Error(`fixture ${name} does not parse`);
  return result.reading;
}
const DAY = recorded("2026-11-12-all-regions");
const NIGHT = recorded("2026-11-12-all-regions-0100z");
const T = DAY.timeMs;

function reading(
  area: RegionCode,
  production: Readonly<Record<Source, number>>,
  consumptionMw: number,
  exchangesMw: number,
): Eco2mixReading {
  return {
    area,
    time: new Date(T).toISOString(),
    timeMs: T,
    consumptionMw,
    productionMw: production,
    loadFactorPct: {
      thermal: null,
      nuclear: null,
      wind: null,
      solar: null,
      hydro: null,
      bioenergy: null,
    },
    exchangesMw,
    pumpingMw: 0,
    batteryChargeMw: 0,
    batteryDischargeMw: 0,
  };
}

/** A step's regions but one. */
function without(
  step: RegionalReadings,
  left: RegionCode,
): Partial<Record<RegionCode, Eco2mixReading>> {
  const byRegion: Partial<Record<RegionCode, Eco2mixReading>> = {};
  for (const code of REGION_CODES) {
    const row = step.byRegion[code];
    if (code !== left && row !== undefined) byRegion[code] = row;
  }
  return byRegion;
}

const NONE = { thermal: 0, nuclear: 0, wind: 0, solar: 0, hydro: 0, bioenergy: 0 } as const;

describe("legendFigures", () => {
  it("shows a region's row as RTE publishes it, recorded Normandie", () => {
    const row = DAY.byRegion["28"];
    expect(row).toBeDefined();
    const f = legendFigures(DAY, "28");
    expect(f).not.toBeNull();
    if (f === null || row === undefined) return;
    expect(f.summed).toBe(false);
    expect(f.productionMw).toEqual(row.productionMw);
    expect(f.consumptionMw).toBe(row.consumptionMw);
    expect(f.exchangesMw).toBe(row.exchangesMw);
    const total = SOURCES.reduce((sum, s) => sum + row.productionMw[s], 0);
    expect(f.totalMw).toBe(total);
    for (const s of SOURCES) expect(f.shares[s]).toBeCloseTo(row.productionMw[s] / total, 12);
  });

  it("sums the 12 regions for France, field by field, on both recorded samples", () => {
    for (const step of [DAY, NIGHT]) {
      // Both samples hold every region, so the national legend shows on them.
      expect(Object.keys(step.byRegion).sort()).toEqual([...REGION_CODES].sort());
      const f = legendFigures(step, "FR");
      expect(f).not.toBeNull();
      if (f === null) return;
      expect(f.summed).toBe(true);
      const rows = REGION_CODES.map((code) => step.byRegion[code]).filter(
        (r): r is Eco2mixReading => r !== undefined,
      );
      for (const s of SOURCES)
        expect(f.productionMw[s]).toBe(rows.reduce((sum, r) => sum + r.productionMw[s], 0));
      expect(f.consumptionMw).toBe(rows.reduce((sum, r) => sum + r.consumptionMw, 0));
      expect(f.exchangesMw).toBe(rows.reduce((sum, r) => sum + r.exchangesMw, 0));
    }
  });

  it("shows nothing without a step, or for a region left out of it", () => {
    expect(legendFigures(null, "28")).toBeNull();
    expect(legendFigures(null, "FR")).toBeNull();
    const partial: RegionalReadings = { timeMs: T, byRegion: without(DAY, "28") };
    expect(legendFigures(partial, "28")).toBeNull();
    expect(legendFigures(partial, "84")).not.toBeNull();
  });

  it("shows nothing for France when any region is left out: a partial sum is made up", () => {
    for (const code of REGION_CODES) {
      expect(legendFigures({ timeMs: T, byRegion: without(DAY, code) }, "FR"), code).toBeNull();
    }
  });

  it("gives every share 0, never NaN, when nothing is produced", () => {
    const f = legendFigures(
      { timeMs: T, byRegion: { "11": reading("11", NONE, 8000, 8000) } },
      "11",
    );
    expect(f?.totalMw).toBe(0);
    for (const s of SOURCES) expect(f?.shares[s]).toBe(0);
  });

  it("matches a naive sum and share on random steps (seeded)", () => {
    const random = mulberry32(19);
    for (let n = 0; n < 200; n++) {
      const byRegion: Partial<Record<RegionCode, Eco2mixReading>> = {};
      for (const code of REGION_CODES) {
        const production: Record<Source, number> = { ...NONE };
        for (const s of SOURCES) production[s] = random() < 0.2 ? 0 : Math.round(random() * 20_000);
        byRegion[code] = reading(
          code,
          production,
          Math.round(random() * 15_000),
          Math.round((random() - 0.5) * 10_000),
        );
      }
      const step: RegionalReadings = { timeMs: T, byRegion };
      for (const area of ["FR", ...REGION_CODES] as const) {
        const f = legendFigures(step, area);
        if (f === null) throw new Error("no figures");
        const rows = area === "FR" ? Object.values(byRegion) : [byRegion[area]];
        let total = 0;
        for (const s of SOURCES) {
          let mw = 0;
          for (const r of rows) mw += r?.productionMw[s] ?? 0;
          expect(f.productionMw[s]).toBe(mw);
          total += mw;
        }
        expect(f.totalMw).toBe(total);
        const shareSum = SOURCES.reduce((sum, s) => sum + f.shares[s], 0);
        expect(shareSum).toBeCloseTo(total > 0 ? 1 : 0, 9);
        for (const s of SOURCES)
          expect(f.shares[s]).toBe(total > 0 ? f.productionMw[s] / total : 0);
      }
    }
  });
});

describe("formatMw and formatShare", () => {
  it("groups the thousands as each language does", () => {
    expect(formatMw("en", 40867)).toBe("40,867");
    // French groups with a narrow no-break space.
    expect(formatMw("fr", 40867)).toBe("40 867");
    expect(formatMw("fr", 12.6)).toBe("13");
  });

  it("rounds a share to a whole percent, and never says 0 % for a source that produces", () => {
    const en = (key: MessageKey): string => translate("en", key);
    const fr = (key: MessageKey): string => translate("fr", key);
    expect(formatShare("en", 0.456, en)).toBe("46%");
    expect(formatShare("fr", 0.456, fr)).toBe("46\u00a0%");
    expect(formatShare("en", 0, en)).toBe("0%");
    // From the catalogs, as every string on screen (AGENTS.md § Language).
    expect(formatShare("en", 0.001, en)).toBe(en("legendShareUnder").replace("{share}", "1%"));
    expect(formatShare("fr", 0.001, fr)).toBe(
      fr("legendShareUnder").replace("{share}", "1\u00a0%"),
    );
    expect(formatShare("en", 0.005, en)).toBe("1%");
    expect(formatShare("en", 1, en)).toBe("100%");
  });
});

describe("legendText", () => {
  const time = (ms: number): string => new Date(ms).toISOString().slice(11, 16);
  const live: FeedState = { kind: "live", timeMs: T };

  for (const locale of LOCALES) {
    const t = (key: MessageKey): string => translate(locale, key);
    const all = (text: ReturnType<typeof legendText>): string =>
      [
        text.title,
        text.badge,
        text.consumption,
        text.exchanges,
        text.source,
        ...text.rows.flatMap((r) => [r.name, r.mw, r.share]),
      ].join(" | ");

    it(`names the region, lists the six sources in the bar's order, and its time (${locale})`, () => {
      const text = legendText(legendFigures(DAY, "28"), "28", live, locale, t, time);
      expect(text.title).toBe(t("legendTitle").replace("{area}", "Normandie"));
      expect(text.badge).toBe("");
      expect(text.rows.map((r) => r.source)).toEqual([...LEGEND_ORDER]);
      expect(text.source).toBe(t("legendLive").replace("{time}", "09:45"));
      const row = DAY.byRegion["28"];
      expect(text.consumption).toContain(formatMw(locale, row?.consumptionMw ?? NaN));
      expect(text.rows.reduce((sum, r) => sum + r.widthPct, 0)).toBeCloseTo(100, 9);
      expect(all(text)).not.toMatch(/[{}]|NaN|undefined/);
    });

    it(`says imports, exports, or neither, by the sign of ech_physiques (${locale})`, () => {
      const step = (exchangesMw: number): RegionalReadings => ({
        timeMs: T,
        byRegion: { "28": reading("28", { ...NONE, nuclear: 5000 }, 4000, exchangesMw) },
      });
      const say = (mw: number): string =>
        legendText(legendFigures(step(mw), "28"), "28", live, locale, t, time).exchanges;
      expect(say(1234)).toBe(t("legendImport").replace("{mw}", formatMw(locale, 1234)));
      // An export reads as a positive figure: the verb carries the direction.
      expect(say(-1234)).toBe(t("legendExport").replace("{mw}", formatMw(locale, 1234)));
      expect(say(-1234)).not.toContain("-");
      expect(say(0)).toBe(t("legendBalanced"));
      // Read from the figure as shown: under half a MW is neither, never "imports 0 MW".
      expect(say(0.4)).toBe(t("legendBalanced"));
      expect(say(-0.4)).toBe(t("legendBalanced"));
      expect(say(0.6)).toBe(t("legendImport").replace("{mw}", "1"));
    });

    it(`labels recorded data as a sample, and the time-lapse as such (${locale})`, () => {
      const f = legendFigures(DAY, "84");
      const sample = legendText(f, "84", { kind: "sample", timeMs: T }, locale, t, time);
      expect(sample.badge).toBe(t("legendBadgeSample"));
      expect(sample.source).toBe(t("legendSample").replace("{time}", "09:45"));
      const replay = legendText(f, "84", { kind: "replay", timeMs: T }, locale, t, time);
      expect(replay.badge).toBe(t("legendBadgeReplay"));
      expect(replay.source).toBe(t("legendReplay").replace("{time}", "09:45"));
    });

    it(`says a stale reading is old, and still shows its figures (${locale})`, () => {
      const text = legendText(
        legendFigures(DAY, "84"),
        "84",
        { kind: "stale", timeMs: T },
        locale,
        t,
        time,
      );
      expect(text.source).toBe(t("legendStale").replace("{time}", "09:45"));
      expect(text.rows).toHaveLength(6);
    });

    it(`shows no figure while loading, unavailable, ahead of the clock, or without a row (${locale})`, () => {
      const f = legendFigures(DAY, "28");
      const cases: [FeedState, ReturnType<typeof legendFigures>, MessageKey][] = [
        [{ kind: "loading" }, null, "legendLoading"],
        [{ kind: "unavailable" }, null, "legendUnavailable"],
        // A step after the time shown: the plants are idle, and both notes say why.
        [{ kind: "ahead", timeMs: T }, f, "legendAhead"],
        [live, null, "legendUnavailable"],
      ];
      for (const [state, figures, key] of cases) {
        const text = legendText(figures, "28", state, locale, t, time);
        expect(text.rows, state.kind).toEqual([]);
        expect(text.consumption).toBe("");
        expect(text.exchanges).toBe("");
        expect(text.source).toBe(t(key).replace("{time}", "09:45"));
      }
      expect(t("legendAhead")).toContain("{time}");
    });

    it(`says France's figures are the sum of the 12 regions (${locale})`, () => {
      const text = legendText(legendFigures(DAY, "FR"), "FR", live, locale, t, time);
      expect(text.title).toBe(t("legendTitle").replace("{area}", t("legendFrance")));
      expect(text.source).toContain(t("legendSummed"));
      expect(all(text)).not.toMatch(/[{}]|NaN|undefined/);
    });
  }
});

describe("sourceColour", () => {
  it("is each source's signature colour of the palette, as the scene draws it", () => {
    for (const s of SOURCES) {
      const [r, g, b] = PALETTE[s];
      expect(sourceColour(s)).toBe(`rgb(${String(r)} ${String(g)} ${String(b)})`);
    }
  });
});
