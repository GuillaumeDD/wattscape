# Backlog

Scoped work items. Ideas start in the Growth section of `docs/PRD.md`.
Each item lands in its own commit, which also flips its status here. Steps are in
PRD § Roadmap.

Statuses: `todo` / `wip` / `done`.

| ID    | Item                              | Acceptance criteria                                                                                                                                                 | Status |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| B-001 | Project skeleton (step 0)         | TS strict + Vite build; ESLint + Prettier; Vitest; FR/EN i18n with a test that both catalogs have the same keys; strict CSP with the two API hosts only             | done   |
| B-002 | CI                                | On every PR and push to `main`: `npm ci`, typecheck, lint, test, build, `npm audit --omit=dev`, gitleaks over full history                                          | done   |
| B-003 | GitHub Pages deploy               | Push to `main` publishes `dist/` to Pages; least-privilege permissions; actions pinned by SHA                                                                       | done   |
| B-004 | Position → area                   | "Use my location" button; offline lookup (nearest prefecture); national view abroad, in Corsica or on refusal; area remembered; `?area=`; test per prefecture       | done   |
| B-005 | éCO2mix client                    | Records a real regional and national response as dated fixtures; settles the `ech_physiques` sign and null markers in ARCHITECTURE; strict parser fuzzed; staleness | done   |
| B-006 | Open-Meteo client                 | Rounded position; recorded fixture; WMO code grouping table in ARCHITECTURE; strict parser fuzzed; attribution in credits                                           | done   |
| B-007 | Sun, moon and debug view          | Sun position within 0.5° of NOAA (S-008) for 5 cities × 4 dates; moon phase within 1 day; a debug page listing every live figure with its source and time           | done   |
| B-008 | Map of France                     | Sources GO in `docs/SOURCES.md` § 1; `tools/bake-map` bakes land/sea, regions, relief into a committed file; lookup switched to map cells; ASSETS entry             | done   |
| B-009 | Palette and dithering             | Palette in ARCHITECTURE; ordered dithering; light keyframes; frame-hash tests in Node and Chromium                                                                  | done   |
| B-010 | Art direction mockups             | Mockups (France level, region level, day and night) for Guillaume to validate before sprites are drawn; decision recorded in PRD Q-1                                | done   |
| B-011 | Camera: zoom and pan              | Continuous zoom France ↔ region (wheel, pinch, keys, double-click); pan (drag, keys); idle drift; LOD crossfade                                                     | done   |
| B-012 | Source sprites driven by data     | Six source sprites, each animated by its figure per § Data-to-scene mapping; idle state for missing figures; formulas tuned on fixtures and recorded                | done   |
| B-013 | Performance budget                | Measured frame time and 2-hour memory run; budget recorded in ARCHITECTURE                                                                                          | done   |
| B-014 | Day and night                     | Sky, tint and emissive lights from the sun; towns lit by consumption; time-lapse for demos (`?at=` landed with B-011)                                               | done   |
| B-015 | First region end to end           | Normandie (Seine-Maritime first: Le Havre, Fécamp, Étretat, Paluel, Penly, Fécamp offshore wind) and the national view, live data, deployed                         | done   |
| B-016 | Landmarks for the 12 regions      | Each landmark GO in `docs/POI.md` (basis + source) before it is drawn; drawn and placed; captions sourced                                                           | done   |
| B-017 | Major plants at their real places | Nuclear sites, large dams and thermal plants with coordinates logged in SOURCES; diffuse sources placed by installed capacity                                       | done   |
| B-018 | Weather effects                   | Clouds, rain, snow, fog, storm from the grouped WMO code; weather override setting                                                                                  | done   |
| B-019 | Legend                            | Stacked mix bar, consumption, import/export, reading time and staleness, sample label; auto-hide                                                                    | todo   |
| B-020 | Captions                          | Hover/tap a plant or landmark: name, what it is, live figure; every fact sourced                                                                                    | done   |
| B-021 | Screensaver mode                  | Fullscreen, idle cursor hidden, wake lock, home button, reduced motion; `?screensaver` opens it with no UI, `?season=` forces a season; 3 engines                   | done   |
| B-022 | Seasons                           | Four seasonal land palettes and props; continuous, per-cell transitions by date; live snow cover; frame snapshots for each season                                   | done   |
| B-023 | Rivers on the map                 | Rivers of reach 100 or more baked from BD TOPO (DS-13, D-039): the great ones on the national view, all from close; day and night; frame snapshots                  | done   |
| B-024 | Camera budget, measured again     | `tools/perf.ts frames` on a quiet machine, three runs: wheel zoom and flight at p95 against the 25 ms of D-028; profile and fix if over                             | todo   |
| B-025 | Foldable panel                    | A button folds the panel to its title and the figures' note; remembered; folded at first on a phone (D-052)                                                         | done   |
| B-026 | Modern theme: the map, the choice | A second theme (G-011), chosen in the panel or by `?theme=`: smooth relief, sky, towns, rivers; same camera, captions, data; frames hashed in Node and Chromium     | done   |
| B-027 | Modern theme: plants, landmarks   | New drawings for the modern theme (D-057): the eight kinds of plants and all 28 landmarks, in four lots; no smoothed sprite is drawn any more                       | done   |
| B-028 | Modern theme: the idle drift      | The drift in budget (30 ms/s): a plate drawn once, cropped (every pixel the same); 52–54, the plants' motion 43 of it; accepted (D-061)                             | done   |
| B-029 | Modern theme: sharp, in budget    | Cheaper motion, every pixel the same: 46 to 37–42 ms/s with plants moving; the rest, the canvas's hand-over, accepted (D-060)                                       | done   |
| B-030 | Weather on or off                 | A switch in the panel and `?weather=off`, remembered; off hides clouds, rain and fog, keeps the ground snow and its calls; the page says so (D-072)                 | done   |
| B-031 | Link to the repository            | A link to the GitHub repository in the panel, FR + EN label, `rel="noopener"`; nothing fetched, the CSP unchanged                                                   | done   |
| B-032 | Survey mode                       | Play, pause, stop: slow flights from region to region, then France; discreet controls; stop flies home; replaces the idle tour of Q-6 (D-073)                       | done   |
| B-033 | Polish and share                  | Canvas labelled (FR + EN), every control reached by keyboard, contrast checked; tried on a phone and a 4K screen; README with screenshots                           | todo   |
| B-034 | P-012 caption sourced             | The Terrils du 11/19 caption checked against a source logged in SOURCES, its `provisional` mark removed                                                             | done   |
| B-035 | Four-hour soak                    | Memory and frame time over 4 hours in one stretch (G-013), both themes; flat memory, as § Performance asks                                                          | todo   |
| B-036 | Camera still                      | A switch in the panel, `?drift=off` and `Space`, remembered: the camera then moves only on input or in survey mode (D-074)                                          | done   |
| B-037 | Modern theme by default           | The page opens in the modern theme; a stored choice kept as Q-63 says; `?theme=pixel` still works; tests, frames, screenshots and docs that assume pixel art, swept | done   |
| B-038 | Towerless nuclear: on or off      | The 7 sites without towers tell running from stopped by day and at night, both themes; options drawn on one board, chosen (Q-64); mapping row and frames updated    | done   |
| B-039 | Snow note folded away             | The folded panel keeps the weather's source and time, not the inferred-snow sentence; open, unchanged; FR + EN; `tests/weather-note.test.ts`                        | done   |
| B-040 | Repository link in the credits    | The credits line ends with a link to the GitHub repository, FR + EN label, `rel="noopener noreferrer"`; nothing fetched, the CSP unchanged                          | done   |
| B-041 | Neon theme: the map, the choice   | A third theme (D-084), in the panel and `?theme=neon`: coast, region border, contours, rivers, lamps as lines of light; plate; frames                               | todo   |
| B-042 | Neon theme: plants, landmarks     | The modern drawings outlined in light, each plant in its source colour, brighter with its activity (a new mapping row); cost measured                               | todo   |
| B-043 | Neon theme: weather, seasons      | Clouds, rain, fog and ground snow in the neon idiom, the seasons as a shift of the ground's tint; drawn on a board before coding                                    | todo   |

## Next steps (proposed 2026-11-21, for Guillaume to order: PRD Q-58)

Guillaume chose the proposed order, three threads at once (2026-11-21, D-071).

After step 7, the open work grouped into options. Efforts are estimates, counted
in pull requests (XS: a few lines; S: one PR; M: two or three; L: four or more).
Each option names its threads, so that no more than three branches are open at once
(D-066).

1. **Performance and the long soak** (B-024, B-035; Growth G-016, G-017).
   - Goal: confirm the budget of ARCHITECTURE § Performance on a real machine:
     camera at p95 (B-024), memory flat over 4 hours (B-035); then decide on
     G-016 (sharp frame, measured on a GPU first) and G-017 (CSS vignette).
   - Value: a screensaver runs for hours on battery; the last figures come from
     headless Chromium in the cloud, which has no GPU (D-060).
   - Effort: S for the measures; M if a fix is needed.
   - Depends on: a quiet machine, ideally Guillaume's (a 4-hour run in the cloud
     holds a session for 4 hours).
   - Risks: the figures vary from run to run (AGENTS.md § Performance); G-017
     changes the picture (D-061).
   - Note: the modern theme's open ideas are G-016 and G-017, both about its cost,
     so they sit here.
2. **Weather switch, repository link, camera still** (B-030, B-031, B-036; Growth
   G-020, G-021, G-025).
   - Goal: let the viewer turn the weather and the idle drift off; link the code
     from the page.
   - Value: a calmer scene for whoever wants the map alone, or a still one (the
     drift was noticed and unwanted, Guillaume, 2026-11-21); the project shows
     where it lives.
   - Effort: XS each, one small thread, one PR each.
   - Depends on: Q-59, answered: off hides the sky's weather, the ground snow and
     its calls stay (D-072).
   - Risks: low; the page must say the weather is hidden while snow still shows.
3. **Survey mode** (B-032; Growth G-022), in a thread of its own.
   - Goal: a contemplative tour: play, pause, stop; slow, soft flights from region
     to region, then over France; controls that fade away.
   - Value: the heart of a screensaver; nothing tours the map today (the idle tour
     of Q-6 was never built).
   - Effort: M: the path and its timing, the controls, reduced motion, frame hashes
     along the path.
   - Depends on: Q-60, answered: it replaces the idle tour of Q-6 (D-073); B-024's
     flight figures.
   - Risks: a flight costs more than a still frame (B-024); the regional data and
     the 1 km relief must be ready before the camera lands, or the detail pops in.
4. **Screensaver mode** (B-021), after the survey mode, in the same thread.
   - Goal: fullscreen, cursor hidden, wake lock, a launch with no UI
     (`?screensaver`), a forced season; the survey mode starts by itself there.
   - Value: what makes Wattscape a screensaver rather than a page.
   - Effort: S to M.
   - Depends on: B-032 (the tour it shows); claims about fullscreen and wake lock
     are checked in Chromium, Firefox and WebKit (AGENTS.md § Determinism).
   - Risks: browsers differ (wake lock is missing in some); a forced season must be
     labelled, like a forced weather.
5. **Legend** (B-019), still to do from step 5.
   - Goal: the stacked mix bar, consumption, imports and exports, reading time.
   - Value: the scene says what it shows; the panel still reads « la légende
     arrive ».
   - Effort: M.
   - Depends on: nothing; before B-033, whose screenshots should show it.
   - Risks: it must not cover the map for long (PRD § 4.8).
6. **P-012 caption** (B-034).
   - Goal: source the Terrils du 11/19 caption, left provisional in step 5.
   - Value: the last caption without a source (« every figure is true »).
   - Effort: XS; fits in option 2's thread.
   - Depends on: fr.wikipedia.org answering (it answered 429 on 2026-11-14, and
     again on 2026-11-21 from the cloud); Guillaume's browser can read the page.
   - Risks: none.
7. **Polish and share** (B-033), last, once the visible work is in.
   - Goal: accessibility, a phone and a large screen tried, a README with
     screenshots in both themes.
   - Value: the project can be shown.
   - Effort: S to M.
   - Depends on: options 3 to 5, so that the pictures stay true.
   - Risks: screenshots age with each visible change.
8. **New data or effects** (Growth G-002, G-004, G-008, G-023), to discuss.
   - Goal: show more of the grid: flows with the neighbours (G-002), CO₂ intensity
     (G-004), pumped storage (G-008), the wholesale price (G-023).
   - Value: the strongest link to Electricity Maps; the national feed DS-02 already
     carries `ech_comm_*` for five borders and `taux_co2` (recorded fixture
     `tests/fixtures/eco2mix/2026-11-11-national.json`).
   - Effort: M to L per idea, plus mockups.
   - Depends on: a choice among them; for the price, a source GO in SOURCES § 1
     (none is listed today).
   - Risks: commercial exchanges are not physical flows, and the regional feed has
     only one net exchange: what the scene draws must say which it is.

Proposed order (Q-58), at most three threads at once:

| Wave | Thread                                               | Items                 |
| ---- | ---------------------------------------------------- | --------------------- |
| 1    | Small settings: weather, repo link, drift off, P-012 | B-030/31/34/36        |
| 1    | Survey mode, then screensaver mode (stacked)         | B-032, then B-021     |
| 1    | Performance measures, on Guillaume's machine         | B-024, B-035          |
| 2    | Legend, once the small settings thread is done       | B-019                 |
| 2    | Modern theme by default, then towerless nuclear      | B-037, then B-038     |
| 3    | Polish and share                                     | B-033                 |
| 4    | New data: one idea, chosen on mockups                | G-002, G-004, G-023 … |

A third theme, futuristic, minimal and neon (Guillaume, 2026-11-21), waits in
Growth (G-024): it needs mockups and a choice first, as the modern theme did
(D-055). Its place, before the optimisation, is in § Order after wave 2 below
(D-083).

### Added 2026-11-21: the default theme and the towerless nuclear plants

Two asks from Guillaume (2026-11-21), to place in the waves above (PRD Q-65):

9. **Modern theme by default** (B-037; Growth G-027).
   - Goal: a first visit opens in the modern theme; the pixel art stays a choice in
     the panel and `?theme=pixel`.
   - Today: `DEFAULT_THEME_ID` is `pixel` (`src/render/theme-ids.ts`), a default
     proposed by Claude in D-055; a choice is stored (`wattscape.theme`) only when
     the viewer changes the selector (`src/main.ts`), so a visitor who never chose
     follows the default either way.
   - Acceptance:
     1. the default is `modern`; `?theme=` and a stored choice still win, a stored
        `pixel` too (D-079);
     2. `tests/settings.test.ts` asserts the new default and the order URL, then
        storage, then default; a test that a stored `pixel` still opens the pixel
        art;
     3. the frames, e2e scenes and screenshots that relied on the default name
        their theme (none silently changes theme);
     4. every statement that the pixel art is the default swept (PRD § 4.9,
        ARCHITECTURE § Art direction, the README's first line), as D-079 revises
        D-055.
   - Effort: S, one PR.
   - Risks: the modern theme costs more per second than the pixel art (ARCHITECTURE
     § Performance: idle drift accepted over budget, D-061), and a screensaver runs
     on battery: the measures of B-024 and B-035 then matter for the default, and
     should cover the modern theme first.
10. **Towerless nuclear plants: running or stopped** (B-038; Growth G-028).
    - Goal: at a glance, by day as at night, tell a nuclear site without cooling
      towers that produces from one that does not, in both themes.
    - Today: 7 of the 18 nuclear sites have no towers (`src/map/plants.ts`:
      Paluel, Flamanville, Penly, Gravelines, Blayais, Tricastin, Saint-Alban).
      Their only motion is lit windows, at night only, round(3·a) of 3 (ARCHITECTURE
      § Data-to-scene mapping, PRD Q-16, D-027): by day a running plant and a
      stopped one look the same.
    - The figure: `a` is the load factor of nuclear in the plant's region
      (`tch_nucleaire`, D-025), not the plant's own. Normandie's three towerless
      sites share one figure, and so do Saint-Alban, Tricastin and the two sites
      with towers of Auvergne-Rhône-Alpes. A plant stopped alone, while the others
      run, cannot be shown from it: that needs output per unit (DS-08, Growth
      G-003, TO CHECK). Guillaume chose the region's figure (Q-64, D-080).
    - Acceptance:
      1. a board of options, both themes, by day and at night, at a = 0, 0.5, 1 and
         with no figure, the current drawing beside them; G-014's warm-water
         shimmer among the options; any option proposed after it drawn on the same
         board before the choice (D-068, D-070);
      2. the chosen option drawn in both themes; with no figure, the site stays
         idle, as § Data-to-scene mapping asks: if « stopped » gets a cue of its
         own, a missing figure never shows it;
      3. the row « Nuclear plants without towers » of ARCHITECTURE § Data-to-scene
         mapping rewritten with its formula; a decision entry that revises D-027;
      4. unit tests per state (0, partial, full, null) in `tests/pixel-theme.test.ts`
         and `tests/modern-theme.test.ts`; frames re-recorded and checked in
         Chromium;
      5. if the caption gains a state (« à l'arrêt »), its FR and EN strings land
         together, and it says the figure is the region's.
    - Effort: M: the board, then one PR for both themes.
    - Depends on: nothing more (D-080); a per-plant state later needs DS-08 GO.
    - Risks: a cue that reads as a figure must stay true to it (AGENTS.md § 1); a
      new motion by day costs frames (measure it before the card, AGENTS.md §
      Performance).

Place, chosen by Guillaume (Q-65, D-081): one thread of their own in wave 2, B-037 then B-038 on one
branch (they touch the settings, then the plants' art: distinct from the legend's
files), so wave 2 holds two branches. B-037 goes first, before B-024 and B-035 are
measured if they are not yet, and both before B-033, whose screenshots must show
the default and the new drawing.

### Order after wave 2 (Guillaume, 2026-11-22: PRD Q-67, D-083)

Wave 2's default theme and towerless plants are done (B-037, B-038). What is left,
in this order, at most three branches at once (D-066); it replaces waves 3 and 4
of the table above:

| Wave | Thread                                                     | Items                  |
| ---- | ---------------------------------------------------------- | ---------------------- |
| 3    | Neon theme: directions on mockups, cost measured, a choice | G-024, then its B- ids |
| 3    | Legend, beside it (distinct files: the panel, not the art) | B-019                  |
| any  | Measures on Guillaume's machine, whenever it suits him     | B-024, B-035           |
| 4    | Optimisation over the three themes, from those measures    | G-016, G-017, G-026    |
| 5    | Polish and share                                           | B-033                  |
| 6    | New data: one idea, chosen on mockups                      | G-002, G-004, G-023 …  |

- The neon mockups follow AGENTS.md § Performance: each direction comes with its
  cost measured on a prototype before the decision card; a glow drawn on the CPU
  may cost more than the modern theme.
- The neon theme graduates to backlog items (map, then plants and landmarks) once
  a direction is chosen; drawing it from the modern theme's shapes, as lines of
  light, is one of the directions, and the cheapest to build.
- The measures touch no code, so they wait for no thread; if they show the modern
  theme in budget on a machine with a GPU (as D-060 suspects), part of wave 4 may
  be dropped.

### The neon theme (Guillaume, 2026-11-22: PRD Q-68, D-084)

Direction A, lines of light, chosen on three mockups with their cost
(`docs/screenshots/step-21-neon-mockup-*.png`). One thread, one branch, one PR per
item, in this order:

11. **Neon theme: the map and the choice** (B-041; Growth G-024).
    - Goal: a third theme in the selector and `?theme=neon`, its map drawn as
      lines of light over a dark relief.
    - Acceptance:
      1. `src/render/neon-theme.ts`, its density as the modern theme's (sharp at 4,
         the map at 2), the same camera, marks and captions;
      2. the coast, the border of the region in focus (or of France), contour
         lines between the map's classes, the rivers and the towns' lamps, each
         glow a function of a distance worked out where the pixel is drawn (no
         blur of the frame); a dusk-blue ground by day, black at night, stars;
      3. no `Math.sin`, `exp` or `random` decides a pixel of the still frame
         (AGENTS.md § Determinism); frames hashed in Node and Chromium;
      4. the idle drift drawn from a plate, as B-028, every pixel the same as a
         full draw (a test pans through it);
      5. FR + EN name in the selector; `tests/settings.test.ts` accepts `neon`;
      6. ARCHITECTURE § Art direction and § Performance (measured with
         `tools/perf.ts frames --theme neon` against the modern theme, same run);
      7. until B-042, the plants and the landmarks are the modern drawings.
    - Effort: M, one PR.
12. **Neon theme: plants and landmarks** (B-042).
    - Goal: every drawing of the modern theme (D-057) outlined in light, a plant
      in its source's colour, a landmark in one colour.
    - Acceptance: a brush that draws a shape's edge and its halo from the same
      distance as the modern brush (`src/render/art/shapes.ts`), shadows left out;
      the plant's brightness follows its activity, a new row of ARCHITECTURE §
      Data-to-scene mapping (no figure: dim, never off, so a missing figure never
      reads as a stop); unit tests per state (0, partial, full, null); frames;
      cost of a step of the motion measured against the modern theme's.
    - Effort: M, one PR.
13. **Neon theme: weather and seasons** (B-043).
    - Goal: the weather of B-018 and the seasons of B-022 in the neon idiom.
    - Acceptance: options drawn on one board before coding (D-068), with their
      cost; the ground snow kept when the weather is off (D-072); frames.
    - Effort: M: the board, then one PR.
