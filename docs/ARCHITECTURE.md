# Architecture

How Wattscape is built. What it does and why is in [`PRD.md`](PRD.md); how we work is
in [`../AGENTS.md`](../AGENTS.md). Statements marked **provisional** are design
choices not yet proven by code or measurement; **unverified** marks facts about an
external system that we have not yet checked against the system itself.

## Stack

- **TypeScript** (strict) compiled and bundled by **Vite**; tests with **Vitest**,
  browser tests with **Playwright**; **ESLint** + **Prettier**. Same versions and
  configuration as Return of the Runners, to share habits.
  - TypeScript is held below 6.1: typescript-eslint 8.x supports TypeScript < 6.1.
    Dependabot ignores newer TypeScript until typescript-eslint supports it.
  - `@types/node` stays on the major version of the Node we run (22, `.nvmrc`).
- **No runtime dependency.** The scene is drawn by our own code into an RGBA pixel
  buffer (see § Rendering), so it renders identically in Node (tests) and in the
  browser.
- **Static site** on GitHub Pages. The browser talks to two keyless public APIs
  (§ Data sources) and nothing else.

## Module layout

Provisional; each folder lands with the backlog item that needs it.

| Path          | Role                                                                                       | Touches the DOM, clock or network? |
| ------------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| `src/main.ts` | Boot: wires the clock, data, camera, renderer and UI                                       | yes                                |
| `src/clock/`  | The only reader of wall-clock time; time-lapse and fixed time (`?at=`) for demos and tests | clock                              |
| `src/geo/`    | Regions, offline position → area lookup, map projection                                    | no                                 |
| `src/data/`   | éCO2mix and Open-Meteo clients: URL building, strict parsers, refresh and staleness        | network (fetchers only)            |
| `src/sky/`    | Sun and moon position, moon phase, light keyframes                                         | no                                 |
| `src/map/`    | The baked map of France (land, sea, regions, relief) and its grid                          | no                                 |
| `src/world/`  | Seeded PRNG; placement of plants, towns, trees and landmarks; level of detail              | no                                 |
| `src/render/` | Palette, dithering, sprites drawn in code, layers, camera, `Surface` (pixel buffer)        | no (the canvas blit is in `ui/`)   |
| `src/i18n/`   | FR and EN catalogs (`fr.json`, `en.json`), language detection                              | no                                 |
| `src/ui/`     | Canvas blit and scaling, input (zoom, pan, keys), legend, captions, settings               | DOM                                |
| `tools/`      | Scripts run by hand: fixture recording, map baking, mockups, screenshots                   | files                              |
| `tests/`      | Unit tests, recorded API fixtures, frame-hash snapshots                                    | —                                  |

Everything outside `clock/`, `data/` fetchers and `ui/` is pure: same inputs, same
output. That is what makes frames reproducible (§ World generation).

## Data sources

Which sources we use, and under which licence, is decided in the register
[`DATA-SOURCES.md`](DATA-SOURCES.md) (GO / NO-GO with a comment for each); only
**GO** sources appear here.

| Source                   | Endpoint                                                                              | Used for                                           | Refresh |
| ------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------- | ------- |
| éCO2mix regional (DS-01) | `odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-regional-tr/records` | regional mix, consumption, exchanges, load factors | 15 min  |
| éCO2mix national (DS-02) | same API, dataset `eco2mix-national-tr`                                               | national view                                      | 15 min  |
| Open-Meteo (DS-03)       | `api.open-meteo.com/v1/forecast?current=…`                                            | current weather                                    | 15 min  |

The CSP's `connect-src` lists exactly `https://odre.opendatasoft.com` and
`https://api.open-meteo.com`. The map's sources (DS-04, DS-05, DS-11) are read once,
by hand, when the map is baked (§ Map); the browser never calls them.

> 💡 **éCO2mix** is RTE's public view of the French grid: RTE runs the high-voltage
> network and publishes, every 15 minutes, how much each technology produces and how
> much is consumed, nationally and per region. **ODRÉ** (Open Data Réseaux Énergies)
> is the open-data portal that serves it through an API.

### éCO2mix: how a reading reaches the scene

Every 15 minutes, while the tab is visible, the browser asks ODRÉ for the latest
published step of the area (`src/data/eco2mix.ts`). Nothing else sits in between:
no backend, no key, no cookie.

```mermaid
sequenceDiagram
    autonumber
    participant RTE as RTE (telemetry)
    participant ODRE as ODRÉ API<br/>odre.opendatasoft.com
    participant App as Wattscape (browser)
    participant Scene as Scene

    RTE->>ODRE: publishes each 15-min step, ~1 h late (regional)<br/>~20 min late (national)
    Note over ODRE: one row per area and step,<br/>steps still to come have every figure null
    App->>ODRE: GET …/eco2mix-regional-tr/records<br/>where code_insee_region = "28" and consommation is not null<br/>order_by date_heure desc, limit 1
    alt answer ok (HTTP 200, ≤ 64 KB, within 30 s)
        ODRE-->>App: { results: [ one row ] }
        App->>App: strict parser: shape, area, 15-min UTC step,<br/>each figure finite, in range, right sign
        alt every figure valid
            App->>App: freshness against the clock:<br/>fresh, stale (> 3 h) or future (> 15 min ahead)
            App->>Scene: reading (MW per source, load factors,<br/>exchanges, pumping, batteries) + its time
        else one figure invalid
            App->>Scene: unavailable (reason)
        end
    else network error, timeout, HTTP error, too large, not JSON
        App->>Scene: unavailable (reason)
    else area changed or tab hidden meanwhile
        App->>App: aborted: dropped, not shown as an outage
    end
```

What one step says: the area's consumption is met by its own production, plus
what it imports, minus what its pumps and batteries draw. The sign of each field
is the one the API sends; the balance closes to a few MW (§ caveats below).

```mermaid
flowchart LR
    subgraph IN["Supply (MW)"]
        P["Production per source ≥ 0<br/>thermique · nucleaire · eolien<br/>solaire · hydraulique · bioenergies"]
        D["destockage_batterie ≥ 0"]
        E["ech_physiques<br/>positive = import, negative = export"]
    end
    subgraph OUT["Use (MW)"]
        C["consommation, positive"]
        S["pompage ≤ 0<br/>stockage_batterie ≤ 0"]
    end
    P --> B(("consommation =<br/>production + ech_physiques<br/>+ pompage + stockage_batterie<br/>+ destockage_batterie"))
    D --> B
    E --> B
    B --> C
    B -. "drawn by pumps and batteries<br/>(negative sign in the API)" .-> S
```

### éCO2mix: fields and caveats

Checked against the API itself on 2026-11-11: the datasets' field list and
descriptions (S-003, S-009), recorded answers committed in
`tests/fixtures/eco2mix/` (`tools/record-eco2mix.ts`), and every published step of
both datasets from 2026-09-01 to 2026-11-11 run through the parser
(`tools/check-eco2mix.ts`; the ~60 MB export it reads is not committed). The client is
`src/data/eco2mix.ts`; it asks for the latest row with a non-null `consommation`.

| API field (type as sent)                                                | Meaning                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `date_heure` (text, `2026-11-11T07:45:00+00:00`)                        | Start of the 15-minute step, UTC                                          |
| `code_insee_region` (text) / `perimetre` (`"France"`)                   | The area of the row                                                       |
| `consommation` (number)                                                 | Consumption, MW                                                           |
| `thermique` (number, regional only)                                     | Fossil thermal, MW; nationally the scene sums `gaz` + `fioul` + `charbon` |
| `nucleaire`, `eolien`, `solaire`, `hydraulique`, `bioenergies` (number) | Production, MW                                                            |
| `ech_physiques` (number)                                                | Net physical exchanges, MW: **positive = import, negative = export**      |
| `pompage` (text regionally, number nationally)                          | Pumped-storage pumps, MW, **≤ 0**                                         |
| `stockage_batterie` / `destockage_batterie` (text regionally)           | Battery charge (≤ 0) and discharge (≥ 0), MW                              |
| `tch_*` (number or `null`, regional only)                               | **Load factor** per technology, %                                         |
| `tco_*` (number, regional only)                                         | Coverage rate (production / consumption, %); not used, it reaches 598 %   |

Caveats (provenance in brackets):

- **Sign of `ech_physiques`:** "exportateur si négatif, importateur si positif"
  (field description, S-003, S-009). The balance confirms it: consumption =
  production + `ech_physiques` + `pompage` + `stockage_batterie` +
  `destockage_batterie`, to a mean of 4 MW or less and a maximum of 21 MW in every
  region over 82 224 steps; with the opposite sign the error would be twice the
  exchange. Nationally the same balance holds to 10 MW on average, but 58 of 6 855
  steps are off by more than 100 MW (up to 3.2 GW, around midday on sunny days of
  September): unexplained, and not a sign issue (tools/check-eco2mix.ts,
  2026-11-11).
- **Numbers sent as text:** `pompage` and the battery columns regionally,
  `hydraulique_fil_eau_eclusee` nationally, are JSON strings such as `"-50"` (field
  types in S-003, S-009, and the fixtures). The parser accepts a plain integer or
  decimal string there.
- **Missing values:** the spec's "ND", "-" and "DC" markers (S-007) never appear in
  the API over the 10 weeks checked: every published step has every figure. A step
  not yet published has every figure `null` (recorded fixture
  `…-regional-empty-step`). A technology absent from a region is sent as **0 MW
  with a `null` load factor**: `nucleaire = 0` and `tch_nucleaire = null` in every
  step of Île-de-France, Bourgogne-Franche-Comté, Pays de la Loire, Bretagne and
  Provence-Alpes-Côte d'Azur. The scene therefore tells "no such plant" (load
  factor `null`) from "plant idle" (load factor 0). Any other `null`, string or
  out-of-range value makes the whole reading "unavailable", never 0.
- **Load factor above 100 %:** `tch_hydraulique` reaches 125 % and
  `tch_bioenergies` 114 % (2026-09-01 to 2026-11-11), presumably because the
  capacity reference lags new installations (not confirmed). The parser accepts
  0–200 %; the scene clamps (B-012).
- **No load factors nationally:** the national dataset has no `tch_*` column
  (S-009), so the national view needs installed capacities to animate plants
  (DS-07, B-012).
- **Delay:** at 08:48 UTC on 2026-11-11 the latest regional step was 07:45 UTC
  (63 min old) and the latest national one 08:30 UTC (18 min). The datasets keep
  about 10 weeks: from 2026-08-31 22:00 UTC that day (S-003, S-009). A reading is
  labelled stale after 3 hours (`STALE_AFTER_MS`, provisional); a step more than
  15 minutes ahead of the clock counts as unavailable. A request is given up after
  30 s, and an answer over 64 KB is rejected.
- **Revisions:** a published step can still change: Île-de-France at 07:45 UTC read
  7 757 MW at 08:48 and 7 758 MW at 08:54 (2026-11-11). Month M is replaced by
  consolidated data mid-M+1 (S-004). A recorded fixture is dated, never refreshed.
- The onshore/offshore wind split is national only (S-009). The battery columns,
  "not available" regionally in the file specification (S-007), are filled in the
  regional API (S-003).
- Corsica is not in the regional dataset (12 regions, S-003): Corsica gets the
  national view.
- **CORS:** answers carry `Access-Control-Allow-Origin: *`, so the browser can call
  the API directly (2026-11-11).
- **Rate limits:** answers carry `X-RateLimit-Dataset-Limit: 50000` per month and
  `X-RateLimit-Limit: 10000000` per day (2026-11-11, S-004). One viewer refreshing
  every 15 minutes makes about 3 000 calls a month; never poll faster, and stop when
  hidden.
- **Flaky connection from the cloud sessions:** about one connection in three to
  ODRÉ was reset through the session proxy on 2026-11-11; the recording tools
  retry. Whether browsers see this is unknown.

### Open-Meteo

Checked against the API itself on 2026-11-11: answers recorded at three landmarks in
`tests/fixtures/open-meteo/` (`tools/record-open-meteo.ts`), and the API's own list
of weather codes (S-010). The client is `src/data/open-meteo.ts`.

- **Query:** `current=temperature_2m,weather_code,cloud_cover,precipitation,snowfall,snow_depth,wind_speed_10m,wind_direction_10m,is_day`
  and `timeformat=unixtime`, at the position rounded to 0.1° (`roundPosition`; the
  URL prints exactly one decimal).
- **Answer:** `latitude`/`longitude` of the model's grid point, not the position
  asked (49.4, 1.1 → 49.4017, 1.0999; the Mont Blanc summit → a point at 2 308 m);
  `current_units`; `current` with `time` (seconds, UTC, start of a 15-minute
  interval: `interval` = 900) and one number per field. The parser checks each unit
  (°C, %, mm, cm, m, km/h, °, wmo code), so a change of unit cannot pass as a value,
  and rejects a grid point more than 0.5° away from the position asked.
- **Units and meaning** (S-010): `precipitation` (mm) and `snowfall` (cm) are sums
  over the preceding hour for hourly data; over which window for `current` (15
  minutes or an hour) is **unverified**, so no formula may rely on it yet;
  `snow_depth` is snow on the ground in **metres**;
  `cloud_cover` is total cover in %; `wind_direction_10m` is where the wind blows
  from; `is_day` is 1 in daylight at the grid point.
- **Errors:** `{"error": true, "reason": "…"}` with HTTP 400 for a bad query, 429
  when the daily quota is spent (recorded). The quota is per address: 10 000 calls a
  day (`X-RateLimit-Limit`, `X-RateLimit-Window: 86400`). The cloud sessions share
  their address and often get 429; a viewer's browser has its own.
- **CORS:** `Access-Control-Allow-Origin: *` (2026-11-11).
- **Freshness:** a reading is labelled stale after 1 hour (four missed refreshes,
  `WEATHER_STALE_AFTER_MS`, provisional); one more than 15 minutes ahead of the
  clock counts as unavailable. Requests share the éCO2mix client's rules
  (`src/data/fetch-json.ts`): 30 s timeout, size cap, abort.
- **Weather codes:** the API sends a subset of WMO code table 4677 (S-010). One
  invalid field, or a code outside this table, makes the whole reading
  "unavailable" (D-010).

| WMO codes (S-010)                              | Group     |
| ---------------------------------------------- | --------- |
| 0 clear sky, 1 mainly clear                    | `clear`   |
| 2 partly cloudy, 3 overcast                    | `cloudy`  |
| 45 fog, 48 depositing rime fog                 | `fog`     |
| 51, 53, 55 drizzle; 56, 57 freezing drizzle    | `drizzle` |
| 61, 63, 65 rain; 66, 67 freezing rain          | `rain`    |
| 80, 81, 82 rain showers                        | `rain`    |
| 71, 73, 75 snowfall; 77 snow grains            | `snow`    |
| 85, 86 snow showers                            | `snow`    |
| 95, 97 thunderstorm; 96, 99 thunderstorm, hail | `storm`   |

## Privacy

- The browser's Geolocation API is called only when the user presses "Use my
  location" (no prompt on load).
- The position is used for: (1) the offline area lookup (§ Geolocation); (2) the
  weather query, **rounded to 0.1°** (about 10 km). It is never stored, logged,
  put in the URL or sent elsewhere. What is remembered in `localStorage` is the area
  code only.
- Without a position, the weather will be taken (B-007) at the area's reference
  point, its regional prefecture (`referencePoint`); the national view has none
  (provisional).
- The position is rounded to 0.1° as soon as it arrives (`src/ui/area-picker.ts`);
  the raw value is never kept.

### Geolocation

`src/geo/regions.ts` reads the region of the position's cell in the **fine grid of
the baked map** (1 km cells, § Map), offline. Only + and × turn a position into a
cell, so every engine picks the same one; a lookup decodes only the rows it reads
and keeps nothing. Outside France, a position within **22 km** (true distance) of
the centre of a French cell (`NEAR_FRANCE_KM`, 12 nautical miles, the breadth of
the territorial sea) takes the region of the nearest one: a beach or a boat off the
coast, GPS error, a town across a border (Geneva, Basel, Luxembourg, Monaco: the
measured list is in D-015); farther away it is abroad and gets the national view
(D-015).

Measured with `tools/check-regions.ts` against the full-precision official outlines
(IGN ADMIN EXPRESS COG, S-013), not the generalised ones the map is baked from
(2026-11-11):

- every prefecture (S-006) lies inside its own département and region, and in a
  cell of its region;
- **0.33 % of the mainland's area** maps to a neighbouring region (65 of 20 000
  random points), all within **0.55 km** of a regional border: the size of a cell.
  The nearest-prefecture rule it replaces (D-011) put 8.0 % of the area in the wrong
  region, Mont-Saint-Michel in Bretagne among them.

Corsica, and the sea within 22 km of it inside Corsica's bounding box, get the
national view (no regional data, S-003); Sardinia is abroad. The UI (`src/ui/area-picker.ts`)
offers the region list and a "Use my location" button; the URL setting `?area=`
(`src/ui/settings.ts`) wins over the remembered area, which wins over France. On
refusal, without the Geolocation API, or with no answer within 60 s (the prompt
may never call back), the viewer stays on the area they are on. Abroad or in
Corsica the view switches to France for the visit without overwriting the
remembered region. An answer that arrives after the viewer picked an area by hand
is dropped; the button can always be pressed again. Region
names are the official French names in every language (D-011).

### Debug page

`debug.html` (linked from the credits as "Live data", public by D-013) lists every live figure the
scene uses (B-007): each éCO2mix and Open-Meteo field under its API name, the
dataset or the rounded point it comes from, the time it describes, its age and
freshness ("up to date", "stale", or "dated in the future", whose figures are then
not shown), and the sun and moon computed for now. A failed source shows its
reason ("timeout", "HTTP 429", …), never a value. It reads the area like the main
page (`?area=`, then the remembered choice, then France), without ever writing
it, and takes the weather and
the sun at the region's reference point, rounded to 0.1°: the viewer's position is
not kept between pages. The national view has no reference point, so it shows no
weather and no sun. Data is fetched again every 15 minutes while the page is
visible, and not at all while it is hidden. Changing the area, pressing Refresh or
hiding the page cancels the load in flight; a late answer from it is dropped. The listing itself is a pure function
(`src/ui/live-figures.ts`), tested on the recorded fixtures.

## Map

The map is **baked by hand** by `tools/bake-map.ts` from three GO sources (§ Data
sources: DS-04, DS-05, DS-11) into a committed file, `src/map/france.ts` (about
125 KB, ASSETS entry); `tools/preview-map.ts` draws it as a flat PNG to check a
bake. The browser never downloads map data: the CSP is unchanged.

- **Projection:** equirectangular, longitude scaled by cos 46.5° (computed by a
  Taylor series, `cosDeg`), 111.2 km per degree of latitude. A cell is true to scale
  north–south; east–west it is 9 % too wide in the north (51° N) and 9 % too narrow
  in Corsica (41.3° N), as cos(latitude)/cos 46.5° says; the 2:1 tiles of § Art direction come on top. A Lambert-93
  projection could replace it without touching the renderer.
- **Grid** (`src/map/grid.ts`): north-west corner 51.2° N, 5.4° W; 1 152 × 1 104 cells
  of 1 km (the **fine grid**), grouped 4 × 4 into 288 × 276 cells of 4 km (the
  **coarse grid**). It covers mainland France and Corsica with a margin.
- **Fine grid:** the region at the centre of each cell, or "not France". Used by the
  region lookup (§ Geolocation). Baked from the generalised outlines of ADMIN
  EXPRESS COG CARTO, read from IGN's WFS (S-013).
- **Coarse grid:** sea, foreign land, or a region. A cell is land when at least 8 of
  its 16 fine cells are land (French, or a neighbouring country in Natural Earth's
  1:10m countries, S-015); it is French when French cells outnumber foreign ones,
  and then takes the region holding most of them (ties go to the lowest region
  code).
- **Relief:** each French coarse cell gets an elevation class (0 to 15, lower bounds
  0, 50, 100, 200, 300, 400, 600, 800, 1 000, 1 300, 1 600, 2 000, 2 400, 2 800,
  3 200, 3 600 m) from the **mean** of 64 altitudes sampled every 500 m from IGN BD
  ALTI through IGN's WMS (raw 32-bit floats, S-014). BD ALTI covers France only
  (−99 999 elsewhere): sea and foreign land are class 0. The highest cell (class 14,
  3 349 m) is on the French side of the Mont Blanc massif; the summit's own cell is
  mostly Italian, so it is foreign land.
- **Encoding:** one line per grid row: run-length encoded kinds (`a12c40` = 12 cells
  of kind 0, then 40 of kind 2), one hexadecimal digit per cell for the elevation.
  The decoder throws on a malformed row; the tests decode the committed file.
- **Re-baking:** the regions come from the WFS layer `LATEST`, the countries from a
  pinned commit of Natural Earth; the date of the bake and the WFS time stamp are
  written in the file's header. Region borders have not changed since 2016, so a
  re-bake should only move a few cells (a second bake the same day gave identical
  grids). The day of the bake (`MAP_BAKED_ON`) is shown in the credits, as Licence
  Ouverte asks for the date of the data.
- Real places (plants, landmarks, towns) are stored as latitude/longitude and
  projected the same way.

## World generation

- `src/world/prng.ts`: a small seeded PRNG (e.g. mulberry32), seeded per map cell
  from (global seed, cell x, cell y), so any part of the world can be generated alone
  and always identically.
- Placement decides **what** is where (trees, houses, wind turbines, solar fields)
  with integer and rational arithmetic only; transcendental functions are allowed
  for **how** things move (a turbine's angle), never for placement.
- Diffuse sources are placed with a density per region proportional to its installed
  capacity per technology (candidate source: DS-07, aggregated by region and baked at
  build time; **provisional**).

## Data-to-scene mapping

The acceptance criterion for the scene (AGENTS.md § Faithfulness). Every row names
its figure and its formula. **Provisional** until B-012: the formulas will be tuned on
real recorded data, then fixed here.

| On screen                           | Figure                         | Formula (provisional)                                                |
| ----------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Steam plumes of cooling towers      | `tch_nucleaire`                | plume height and puff rate ∝ load factor; no plume at 0              |
| Seaside nuclear plants (no towers)  | `tch_nucleaire`                | warm-water shimmer and lit buildings ∝ load factor                   |
| Wind turbine rotors                 | `tch_eolien`                   | rotation speed ∝ load factor; stopped at 0                           |
| Solar fields                        | `tch_solaire`                  | glint density ∝ load factor (so 0 at night, low under clouds)        |
| Dams and weirs                      | `tch_hydraulique`              | spillway flow ∝ load factor                                          |
| Thermal plant chimneys              | `tch_thermique`                | smoke rate ∝ load factor                                             |
| Bioenergy plants                    | `tch_bioenergies`              | small smoke and a lit furnace ∝ load factor                          |
| Town windows lit, power-line pulses | `consommation`                 | ∝ position of consumption in the area's typical range (baked p5–p95) |
| Legend: stacked bar and figures     | MW per source, `ech_physiques` | shares of total production; import if > 0, export if < 0             |

A missing figure shows the element **idle** (no motion, no glow) and the caption says
"no data", never a guessed value.

## Sky, light and weather

- **Sun** (`src/sky/sun.ts`): NOAA's solar position algorithm (S-008) gives the
  apparent elevation (with NOAA's refraction fit), the geometric elevation and the
  azimuth for a place and instant. Checked against Astronomy Engine (S-012) at 5
  landmarks × 4 dates (equinoxes, solstices 2026) × 12 hours: azimuth and, with the
  sun up, elevation agree within 0.01°. Below the horizon the two differ by up to
  0.55°, only because their refraction conventions differ there; twilight
  thresholds use the geometric elevation, which refraction does not touch. It is
  also checked against a transcription of NOAA's own code (S-008) on 20,000 random
  instants and places: the two agree within 10⁻⁹° (D-012).
- **Moon** (`src/sky/moon.ts`): phase from the mean synodic month (29.530588861
  days) since Meeus's mean new moon of 2000-01-06. Against every quarter of
  2026–2030 from S-012, the worst gap is 0.8 day, within the 1-day target; the lit
  fraction follows from the phase. Position in the sky: simplified ephemeris, later
  (provisional).
- **Determinism:** both use `Math.sin` and friends. That is allowed because the sky
  only animates the scene (light, sky colour, the moon's drawing); it never decides
  what the world contains (§ World generation).
- **Light keyframes** (`src/sky/light.ts`) by geometric solar elevation: night
  (< −12°), blue hour (−12° to −4°), golden hour (−4° to 6°), day (≥ 6°). The sky
  gradient, zenith to horizon, has its own keyframes (−12°: skyNight to skyNight;
  −4°: skyNight to skyBlueHour; 0°: skyBlueHour to skyGolden; 6°: skyDay), each end
  dithered from one keyframe's colour to the next, so the sky never jumps. Emissive
  pixels show once the sun is below the horizon (< 0°), when the land is a full step
  dark. The land's **darkness** is counted in palette steps
  (`DARKER`, § Art direction), linear between keyframes: 0 at 6° and above, 1 at
  0°, 1.5 at −4°, 2 at −12° and below (provisional: 2 steps keep the land readable
  at night). A fractional step is drawn by dithering between the two whole steps,
  so the land stays in palette. A `NaN` elevation, or a `NaN` darkness, reads as
  night.
- **Weather layers:** clouds (count and darkness from `cloud_cover`, drifting with
  the wind), rain and snow particles, fog banks (dithered), lightning flashes for
  storms. Particles are seeded (PRNG) so frames stay reproducible.
- **Seasons (provisional, D-008):** a season position from the day of the year (an
  angle over the year, so that transitions are continuous), mapped to four keyframes
  centred on mid-January, mid-April, mid-July and mid-October. Each keyframe is a
  **land palette ramp** (grass, leaves, fields, soil) and a set of seasonal props
  (blossom, ripe crops, fallen leaves, bare branches); between two keyframes, cells
  switch from one to the next by a seeded per-cell threshold, so the change spreads
  across the map like a real season instead of a global fade. Snow cover comes from
  Open-Meteo's `snow_depth` (metres, checked in B-006), with altitude: the
  Alps whiten before the plains.

## Art direction

Direction A, the isometric map (drawn north up, D-017), was chosen by Guillaume on 2026-11-11 (PRD Q-1). The
palette, the night and the dusk below were validated with the mockups of B-010
(D-019); the resolution and the level of detail are still **proposed** until B-011.

- **Projection:** 2:1 tiles (a tile is twice as wide as it is tall), north up, the
  map seen from the south (D-017); light from the north-west, no perspective.
- **Resolution:** the scene is drawn at low resolution into a pixel buffer, then
  scaled by an **integer** factor to the screen (nearest-neighbour); the buffer size
  follows the window so that the factor is 3 to 6 on common screens.
- **Zoom and level of detail (provisional):** the camera zoom is continuous, but each
  frame is drawn at the nearest of a few levels of detail (France, region, close),
  each with its own sprite set; between two levels, a short crossfade. Integer
  scaling keeps pixels crisp; a spike in B-011 checks that this feels smooth enough.
- **Palette** (`src/render/palette.ts`, validated, D-019): 24 fixed colours:
  muted land, sea blues, a sky ramp, a lamp yellow, and **one signature colour per
  source**, also used in the legend. Each colour names the palette colour it
  becomes one step darker (`DARKER`): land darkens towards the sea's blues, as under
  moonlight, and never into a source's colour, so that colour keeps its meaning at
  night. The test card (`tools/preview-palette.ts`,
  `docs/screenshots/step-2-test-card.png`) shows them all.

  | Group   | Colours (hex)                                                                                                                               |
  | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
  | Sea     | seaDeep `1b2a4a`, sea `24406a`, seaShallow `2f5d8a`, foam `9fc0d2`                                                                          |
  | Land    | forest `2f4a35`, grass `557545`, meadow `86985c`, field `b8a263`, sand `dcca9c`, soil `6e523a`, rock `8b8680`, snow `eef0ee`, roof `a44f3d` |
  | Sky     | skyNight `0e1122`, skyBlueHour `333466`, skyGolden `e39a6a`, skyDay `9cc6e2`                                                                |
  | Emitted | lamp `ffdc73`                                                                                                                               |

  | Source    | Signature colour    | Why                           |
  | --------- | ------------------- | ----------------------------- |
  | Nuclear   | yellow `f2c14e`     | the usual colour in grid maps |
  | Hydro     | blue `3f8fd8`       | water                         |
  | Wind      | teal `82d8c6`       | air                           |
  | Solar     | orange `f08622`     | sun                           |
  | Thermal   | brown-grey `8c7666` | smoke, fossil                 |
  | Bioenergy | green `6fb04a`      | biomass                       |

- **Shapes:** flat colours, a 1-pixel darker edge instead of black outlines, no
  anti-aliasing; gradients (sky, fog, water depth) only by 4×4 ordered (Bayer)
  dithering between two palette colours (`src/render/dither.ts`): 17 mix levels,
  and over any 4×4 block exactly `level` pixels take the second colour.
- **Night:** the scene is drawn with the day palette, darkened by the light tint,
  then emissive pixels (windows, beacons, illuminated landmarks, lit plumes) are
  drawn on top, untinted.
- **Sprites** are drawn in code (`src/render/art/`), from simple primitives (spans,
  rectangles, polygons) and seeded noise; no image files (ASSETS.md).
- **Motion:** slow and sparse; nothing blinks faster than about 2 Hz; with
  `prefers-reduced-motion`, no camera drift and half-speed animation.

### Mockups (B-010)

`src/render/map-view.ts` draws the baked map (§ Map) as a relief diorama in the
palette, under a light; `tools/mockups.ts` writes the mockups into
`docs/screenshots/step-2-mockup-*.png` (France with 2-pixel tiles, Normandie with
8-pixel tiles, sun at 35°, 2° and −20°). The map is drawn north up (D-017): 2:1
tiles, the map seen from the south.

How it draws, for now, aiming at calm, elegant pixel art (Guillaume, 2026-11-11):

- each coarse cell is a tile raised by a tile's width per 1 000 m, its south face
  one palette step darker; the plains stay flat, the mountains rise;
- one flat ground colour per altitude band, like a relief map's tints: meadow below
  300 m, grass, forest from 800 m, rock from 1 300 m, snow from 2 400 m; no
  per-cell texture;
- hill shading with one light from the north-west: a cell 250 m or more below its
  north-west neighbour is one step darker;
- sea in three flat bands by distance to the coast;
- foreign land, and the other regions on a region view, one step darker by day;
  this veil fades as night falls, so that the land around never reads as sea;
- towns are the prefectures (S-006), each moved to the nearest land cell if its own is
  sea, drawn with its cell so the relief in front hides it: roofs by day, lamps once
  the sun is below the horizon.

Its frames are hashed in Node and Chromium like the test card. The 4 km grid makes a
region blocky at 8-pixel tiles; the 1 km relief comes with the zoom (D-018, B-011).

### Landmarks

Which landmarks are drawn, and why, is decided in the register
[`POI.md`](POI.md) (GO / NO-GO with a comment for each, D-004). Only **GO** landmarks
are drawn; each is drawn in code from public views of the site, never traced from a
photo.

## Rendering and loop

- The renderer draws into a `Surface` (`src/render/surface.ts`: an RGBA
  `Uint8ClampedArray` with width and height). In the browser, `ui/` blits it with
  `putImageData` into a canvas scaled by CSS with `image-rendering: pixelated`; in
  tests, the same buffer is hashed (FNV-1a over the size and the bytes,
  `hashSurface`).
- **Frame hashes:** `tests/fixtures/frames/hashes.json` records the hash of each
  reference frame (for now the test card). Node checks them in the unit tests, and
  Chromium in `e2e/frame-hash.spec.ts` (`npm run e2e`: Vite builds `e2e/*.html`
  into `dist-e2e/`, Playwright opens them). Firefox and WebKit join when the scene
  renders (B-021). A drawing change updates the hashes in the same commit.
- Static layers (terrain, buildings) are cached per map chunk and level of detail;
  only animated elements (plumes, rotors, water, weather, lights) are redrawn each
  frame.
- `requestAnimationFrame`, capped at 30 fps (PRD Q-7); paused when the tab is hidden
  (Page Visibility API), which also pauses data refreshes.

## Performance

Budget (**provisional**, to be measured in B-013 and fixed here):

- ≤ 8 ms of main-thread work per frame on a mid-range laptop at 1080p;
- memory flat over a 4-hour run (no growing caches: every cache has a cap);
- no network beyond 2 requests every 15 minutes.

## Internationalization

- `src/i18n/`: one JSON catalog per language (FR, EN) with the same keys, checked by
  a test and by the type checker (`satisfies`); French is the default and the
  fallback; the choice is remembered in `localStorage`; numbers and times formatted with `Intl` in the active language.
- Region and landmark names are proper nouns kept in French in both languages.

## Security

- **Untrusted input:** API responses and URL settings. Parsers live in `src/data/`
  and `src/ui/settings.ts`; they accept only the documented shape, finite numbers in
  range (|MW| ≤ 200 000, load factors 0–200 %), bounded strings, known area codes; they
  never throw past the boundary: a bad response is "data unavailable".
- No `innerHTML`, `eval` or `new Function` anywhere (lint rules); captions use
  `textContent`.
- **CSP** (in `index.html`):
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src https://odre.opendatasoft.com https://api.open-meteo.com; object-src 'none'; base-uri 'self'; form-action 'none'`.
  The dev server alone adds `'self' ws:` to `connect-src` for live reload
  (`vite.config.ts`); the build ships the CSP unchanged.

## Build, CI and deploy

- `npm run build` → `dist/`, served from `/wattscape/` on GitHub Pages
  (`https://guillaumedd.github.io/wattscape/`).
- CI (`.github/workflows/ci.yml`) on every PR and push to `main`: `npm ci`,
  typecheck, lint, test, build, `npm audit --omit=dev`; the frame hashes in
  Chromium (`npm run e2e`, Playwright's own Chromium); gitleaks over the full
  history. Deploy (`deploy.yml`) on push to `main`. Actions pinned by SHA.

## Browser quirks

All **unverified** until measured in Chromium, Firefox and WebKit (AGENTS.md §5):

- Geolocation needs a secure context (GitHub Pages is HTTPS; `localhost` counts).
  Browsers may remember a refusal, so the app must offer the region list without
  asking again.
- The Screen Wake Lock API is missing in some browsers and is released when the tab
  is hidden: request it again on `visibilitychange`.
- The Fullscreen API is limited on iPhone Safari; the scene must work without it.
