# Backlog

Scoped work items. Ideas start in the Growth section of `docs/PRD.md`.
Each item lands in its own commit, which also flips its status here. Steps are in
PRD § Roadmap.

Statuses: `todo` / `in-progress` / `done`.

| ID    | Item                              | Acceptance criteria                                                                                                                                                 | Status |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B-001 | Project skeleton (step 0)         | TS strict + Vite build; ESLint + Prettier; Vitest; FR/EN i18n with a test that both catalogs have the same keys; strict CSP with the two API hosts only             | done   |
| B-002 | CI                                | On every PR and push to `main`: `npm ci`, typecheck, lint, test, build, `npm audit --omit=dev`, gitleaks over full history                                          | done   |
| B-003 | GitHub Pages deploy               | Push to `main` publishes `dist/` to Pages; least-privilege permissions; actions pinned by SHA                                                                       | done   |
| B-004 | Position → area                   | "Use my location" button; offline lookup (nearest prefecture); national view abroad, in Corsica or on refusal; area remembered; `?area=`; test per prefecture       | done   |
| B-005 | éCO2mix client                    | Records a real regional and national response as dated fixtures; settles the `ech_physiques` sign and null markers in ARCHITECTURE; strict parser fuzzed; staleness | done   |
| B-006 | Open-Meteo client                 | Rounded position; recorded fixture; WMO code grouping table in ARCHITECTURE; strict parser fuzzed; attribution in credits                                           | done   |
| B-007 | Sun, moon and debug view          | Sun position within 0.5° of NOAA (S-008) for 5 cities × 4 dates; moon phase within 1 day; a debug page listing every live figure with its source and time           | done   |
| B-008 | Map of France                     | Sources GO in `docs/DATA-SOURCES.md`; `tools/bake-map` bakes land/sea, regions, relief into a committed file; lookup switched to map cells; ASSETS entry            | done   |
| B-009 | Palette and dithering             | Palette in ARCHITECTURE; ordered dithering; light keyframes; frame-hash tests in Node and Chromium                                                                  | done   |
| B-010 | Art direction mockups             | Mockups (France level, region level, day and night) for Guillaume to validate before sprites are drawn; decision recorded in PRD Q-1                                | done   |
| B-011 | Camera: zoom and pan              | Continuous zoom France ↔ region (wheel, pinch, keys, double-click); pan (drag, keys); idle drift; LOD crossfade                                                     | done   |
| B-012 | Source sprites driven by data     | Six source sprites, each animated by its figure per § Data-to-scene mapping; idle state for missing figures; formulas tuned on fixtures and recorded                | done   |
| B-013 | Performance budget                | Measured frame time and 2-hour memory run; budget recorded in ARCHITECTURE                                                                                          | done   |
| B-014 | Day and night                     | Sky, tint and emissive lights from the sun; towns lit by consumption; time-lapse for demos (`?at=` landed with B-011)                                               | done   |
| B-015 | First region end to end           | Normandie (Seine-Maritime first: Le Havre, Fécamp, Étretat, Paluel, Penly, Fécamp offshore wind) and the national view, live data, deployed                         | todo   |
| B-016 | Landmarks for the 12 regions      | Each landmark GO in `docs/POI.md` (basis + source) before it is drawn; drawn and placed; captions sourced                                                           | todo   |
| B-017 | Major plants at their real places | Nuclear sites, large dams and thermal plants with coordinates logged in SOURCES; diffuse sources placed by installed capacity                                       | todo   |
| B-018 | Weather effects                   | Clouds, rain, snow, fog, storm from the grouped WMO code; weather override setting                                                                                  | todo   |
| B-019 | Legend                            | Stacked mix bar, consumption, import/export, reading time and staleness, sample label; auto-hide                                                                    | todo   |
| B-020 | Captions                          | Hover/tap a plant or landmark: name, what it is, live figure; every fact sourced                                                                                    | todo   |
| B-021 | Screensaver mode                  | Fullscreen, idle cursor hidden, wake lock, idle tour with off switch, home button, reduced motion; checked in 3 engines                                             | todo   |
| B-022 | Seasons                           | Four seasonal land palettes and props; continuous, per-cell transitions by date; live snow cover; frame snapshots for each season                                   | todo   |
