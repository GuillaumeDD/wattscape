/**
 * The legend (B-019, PRD § 4.8): the mix of the area in view as a stacked bar, each
 * source's MW and share, the consumption, the imports or exports, and the reading's
 * time, its freshness, or the sample label. Discreet: it fades away after a few
 * seconds without a move of the mouse or a key, comes back with the next one, and
 * `H` hides or shows it; a button folds it to its title, bar and source, and the
 * pointer goes through the rest of it to the map. Text only, never HTML.
 *
 * The figures are the plants' own (the same step of every region, D-025): a region
 * shows its row as RTE publishes it; France shows the sum of the 12 regions, only
 * when all 12 published that step (ARCHITECTURE § Data-to-scene mapping).
 */
import {
  REGION_CODES,
  SOURCES,
  type Eco2mixArea,
  type RegionalReadings,
  type Source,
} from "../data/eco2mix";
import { REGION_NAMES } from "../geo/regions";
import { type Locale, type MessageKey } from "../i18n";
import { PALETTE } from "../render/palette";
import { type FeedState } from "./plant-feed";
import { notForUs } from "./screensaver";

/** The legend fades away after this long without input. */
export const LEGEND_QUIET_AFTER_MS = 8000;

/** The bar's order: the palette's, the scene's own order of the sources. */
export const LEGEND_ORDER = [
  "nuclear",
  "hydro",
  "wind",
  "solar",
  "thermal",
  "bioenergy",
] as const satisfies readonly Source[];

export interface LegendFigures {
  readonly area: Eco2mixArea;
  /** Whether the figures are the sum of the 12 regions (the national view). */
  readonly summed: boolean;
  /** Production per source, MW, as éCO2mix gives it (or its sum over the regions). */
  readonly productionMw: Readonly<Record<Source, number>>;
  /** The six sources together, MW. */
  readonly totalMw: number;
  /** Each source's share of {@link totalMw}, 0–1; all 0 when nothing is produced. */
  readonly shares: Readonly<Record<Source, number>>;
  readonly consumptionMw: number;
  /** Net physical exchanges, MW: positive = the area imports, negative = it exports. */
  readonly exchangesMw: number;
}

function zeros(): Record<Source, number> {
  return { thermal: 0, nuclear: 0, wind: 0, solar: 0, hydro: 0, bioenergy: 0 };
}

/**
 * The legend's figures for `area` at the step the plants show, or null when there
 * are none to show: no step, the region left out of it, or, for France, any of the
 * 12 regions left out (a partial sum would be a made-up figure).
 */
export function legendFigures(
  readings: RegionalReadings | null,
  area: Eco2mixArea,
): LegendFigures | null {
  if (readings === null) return null;
  const rows =
    area === "FR" ? REGION_CODES.map((code) => readings.byRegion[code]) : [readings.byRegion[area]];
  const productionMw = zeros();
  let consumptionMw = 0;
  let exchangesMw = 0;
  for (const row of rows) {
    if (row === undefined) return null;
    for (const source of SOURCES) productionMw[source] += row.productionMw[source];
    consumptionMw += row.consumptionMw;
    exchangesMw += row.exchangesMw;
  }
  const totalMw = SOURCES.reduce((sum, source) => sum + productionMw[source], 0);
  const shares = zeros();
  if (totalMw > 0) for (const source of SOURCES) shares[source] = productionMw[source] / totalMw;
  return {
    area,
    summed: area === "FR",
    productionMw,
    totalMw,
    shares,
    consumptionMw,
    exchangesMw,
  };
}

const SOURCE_NAMES = {
  nuclear: "plantNuclear",
  hydro: "plantHydro",
  wind: "plantWind",
  solar: "plantSolar",
  thermal: "plantThermal",
  bioenergy: "plantBioenergy",
} as const satisfies Record<Source, MessageKey>;

export interface LegendRow {
  readonly source: Source;
  readonly name: string;
  readonly mw: string;
  readonly share: string;
  /** The segment's width in the bar, 0–100 (%). */
  readonly widthPct: number;
}

/** What the legend says. `rows` is empty when there are no figures to show. */
export interface LegendText {
  readonly title: string;
  /** "exemple" for recorded data, "accéléré" for the time-lapse; empty for live data. */
  readonly badge: string;
  readonly rows: readonly LegendRow[];
  readonly consumption: string;
  readonly exchanges: string;
  /** Where the figures come from, their time and freshness, or why there are none. */
  readonly source: string;
}

type Translate = (key: MessageKey) => string;

/** A whole number of MW in the viewer's language ("40 867"). */
export function formatMw(locale: Locale, mw: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(mw);
}

/** A share as a whole percent; a share under 0.5 % but above 0 reads "< 1 %", never "0 %". */
export function formatShare(locale: Locale, share: number, t: Translate): string {
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  if (share > 0 && share < 0.005)
    return t("legendShareUnder").replace("{share}", percent.format(0.01));
  return percent.format(share);
}

const SOURCE_LINES = {
  live: "legendLive",
  stale: "legendStale",
  sample: "legendSample",
  replay: "legendReplay",
} as const satisfies Record<"live" | "stale" | "sample" | "replay", MessageKey>;

/**
 * The legend's text for the area in view. `state` is the plants' feed state, so that
 * the legend says what the plants' note says: a figure shown is never fresher than
 * its source. `time` formats the reading's time as the note does.
 */
export function legendText(
  figures: LegendFigures | null,
  area: Eco2mixArea,
  state: FeedState,
  locale: Locale,
  t: Translate,
  time: (ms: number) => string,
): LegendText {
  const title = t("legendTitle").replace(
    "{area}",
    area === "FR" ? t("legendFrance") : REGION_NAMES[area],
  );
  const badge =
    state.kind === "sample"
      ? t("legendBadgeSample")
      : state.kind === "replay"
        ? t("legendBadgeReplay")
        : "";
  const none = (key: MessageKey): LegendText => ({
    title,
    badge,
    rows: [],
    consumption: "",
    exchanges: "",
    source: t(key),
  });
  if (state.kind === "loading") return none("legendLoading");
  // A step after the time shown: the plants are idle, and the legend says why, as their note does.
  if (state.kind === "ahead")
    return {
      ...none("legendAhead"),
      source: t("legendAhead").replace("{time}", time(state.timeMs)),
    };
  if (state.kind === "unavailable" || figures === null) return none("legendUnavailable");
  const rows = LEGEND_ORDER.map((source) => ({
    source,
    name: t(SOURCE_NAMES[source]),
    mw: t("legendMw").replace("{mw}", formatMw(locale, figures.productionMw[source])),
    share: formatShare(locale, figures.shares[source], t),
    widthPct: figures.shares[source] * 100,
  }));
  // The direction is read from the figure as shown, so that 0.4 MW never reads "imports 0 MW".
  const exchange = Math.round(figures.exchangesMw);
  const magnitude = formatMw(locale, Math.abs(exchange));
  const exchanges = t(
    exchange > 0 ? "legendImport" : exchange < 0 ? "legendExport" : "legendBalanced",
  ).replace("{mw}", magnitude);
  const source = t(SOURCE_LINES[state.kind]).replace("{time}", time(state.timeMs));
  return {
    title,
    badge,
    rows,
    consumption: t("legendConsumption").replace("{mw}", formatMw(locale, figures.consumptionMw)),
    exchanges,
    source: figures.summed ? `${source} ${t("legendSummed")}` : source,
  };
}

/** The CSS colour of a source: its signature colour of the palette, as the scene draws it. */
export function sourceColour(source: Source): string {
  const [r, g, b] = PALETTE[source];
  return `rgb(${String(r)} ${String(g)} ${String(b)})`;
}

/** The fold button's labels, in the current language: to fold, and to unfold. */
export interface FoldLabels {
  readonly fold: string;
  readonly unfold: string;
}

export interface Legend {
  /** Shows a text, and the fold button's label, in the current language. */
  render(text: LegendText, labels: FoldLabels): void;
  /** Shows the legend, and fades it again later. */
  stir(): void;
}

/**
 * Wires the legend in the page: its fading, `H`, and its fold button, which starts
 * `folded` and tells `onFold` each change (the page remembers it).
 */
export function mountLegend(folded: boolean, onFold: (folded: boolean) => void): Legend {
  const box = document.getElementById("legend");
  const toggle = document.getElementById("legend-toggle");
  let quietTimer: number | null = null;
  let labels: FoldLabels = { fold: "", unfold: "" };

  /** Shows the fold state: the details hidden or not, the button's sign and label. */
  const showFold = (): void => {
    box?.classList.toggle("folded", folded);
    document.getElementById("legend-details")?.toggleAttribute("hidden", folded);
    if (toggle === null) return;
    const label = folded ? labels.unfold : labels.fold;
    toggle.textContent = folded ? "+" : "−";
    toggle.setAttribute("aria-expanded", String(!folded));
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  };
  toggle?.addEventListener("click", (event) => {
    folded = !folded;
    showFold();
    onFold(folded);
    // A click leaves the focus on the button, which would keep the legend from fading.
    if (event.detail > 0 && event.currentTarget instanceof HTMLElement) event.currentTarget.blur();
  });

  const stir = (): void => {
    box?.classList.remove("quiet");
    if (quietTimer !== null) window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(() => {
      quietTimer = null;
      box?.classList.add("quiet");
    }, LEGEND_QUIET_AFTER_MS);
  };
  for (const type of ["pointermove", "pointerdown", "keydown"] as const)
    window.addEventListener(type, stir, { passive: true });
  window.addEventListener("keydown", (e) => {
    if ((e.key !== "h" && e.key !== "H") || e.repeat || notForUs(e)) return;
    if (box !== null) box.hidden = !box.hidden;
  });
  stir();

  return {
    render(text, foldLabels) {
      labels = foldLabels;
      showFold();
      const set = (id: string, value: string): void => {
        const el = document.getElementById(id);
        if (el !== null) {
          el.textContent = value;
          el.hidden = value === "";
        }
      };
      set("legend-title", text.title);
      set("legend-badge", text.badge);
      set("legend-consumption", text.consumption);
      set("legend-exchanges", text.exchanges);
      set("legend-source", text.source);
      const bar = document.getElementById("legend-bar");
      if (bar !== null) {
        bar.hidden = text.rows.length === 0;
        bar.replaceChildren(
          ...text.rows
            .filter((row) => row.widthPct > 0)
            .map((row) => {
              const segment = document.createElement("span");
              segment.style.width = `${String(row.widthPct)}%`;
              segment.style.backgroundColor = sourceColour(row.source);
              return segment;
            }),
        );
      }
      const list = document.getElementById("legend-rows");
      if (list !== null) {
        list.hidden = text.rows.length === 0;
        list.replaceChildren(
          ...text.rows.map((row) => {
            const item = document.createElement("li");
            const swatch = document.createElement("span");
            swatch.className = "swatch";
            swatch.style.backgroundColor = sourceColour(row.source);
            const name = document.createElement("span");
            name.textContent = row.name;
            const mw = document.createElement("span");
            mw.className = "mw";
            mw.textContent = row.mw;
            const share = document.createElement("span");
            share.className = "share";
            share.textContent = row.share;
            item.append(swatch, name, mw, share);
            return item;
          }),
        );
      }
    },
    stir,
  };
}
