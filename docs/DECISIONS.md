# Decisions

The decision log, so that every choice can be audited and revisited. An entry is
never edited after the fact except to add a "Superseded by" link: a change of mind is
a new entry that reverses the old one.

Each entry: context, options, decision, who and when, why, and what would make us
revisit it.

## D-001 — Art direction: isometric map of France

- **Context:** the scene must zoom continuously between France and one region (PRD
  §4.3).
- **Options:** A, an isometric pixel-art map of France; B, a side-scrolling regional
  panorama (PRD §7).
- **Decision:** A. Guillaume, 2026-11-11 (PRD Q-1, decision card in the project
  thread).
- **Why:** the zoom needs a real map; plants and landmarks sit at their real places;
  Infinite Jungle (S-002) shows the style holds up.
- **Revisit if:** the map of France cannot be baked from an open source with a
  compatible licence (B-008), or the mockups (B-010) do not read at a glance.

## D-002 — Docs and code in English, app in French first

- **Context:** Return of the Runners writes code and docs in English.
- **Decision:** same here; the app defaults to French, with English available.
  Guillaume, 2026-11-11 (PRD Q-2, PR #1 review).
- **Why:** one habit across projects; the audience of the app is French.
- **Revisit if:** a French-only contributor joins.

## D-003 — Licences

- **Decision:** code GPL-3.0-or-later; project art CC BY-SA 4.0. Guillaume,
  2026-11-11 (PRD Q-3, PR #1 review).
- **Why:** same as Return of the Runners.
- **Revisit if:** a dependency or asset we need is incompatible.

## D-004 — Only public-domain landmarks; Eiffel Tower lit plainly

- **Context:** French freedom of panorama is narrow; recent works and the Eiffel
  Tower's illumination are protected (PRD §6).
- **Decision:** draw only public-domain works and natural or generic sites; draw the
  Eiffel Tower lit plainly, never sparkling; record each landmark's copyright basis
  and source in the register `docs/POI.md` (GO / NO-GO with a comment) before
  drawing it; open-data sources get the same treatment in `docs/DATA-SOURCES.md`. Guillaume, 2026-11-11
  (PRD Q-4, PR #1 review: "trace the decisions so that we are auditable").
- **Why:** a public repo publishes every sprite; this keeps the project clear of
  claims without a lawyer.
- **Revisit if:** a protected work's rights holder grants permission, or a work
  enters the public domain (re-check each 1 January).

## D-005 — First region: Normandie, Seine-Maritime first

- **Decision:** step 3 builds Normandie, starting with Seine-Maritime: Le Havre,
  Fécamp, Étretat, the Paluel and Penly nuclear plants, the Fécamp offshore wind
  farm (so Growth G-007 is planned). Guillaume, 2026-11-11 (PRD Q-5, PR #1 review).
- **Why:** coast, cliffs, a port, seaside nuclear plants without cooling towers and
  offshore wind exercise most of the scene.
- **Revisit if:** —

## D-006 — Idle tour, with a home button and an off switch

- **Decision:** left alone, the camera stays on the home region and every 5 minutes
  takes a 1-minute flight elsewhere; a home button (and `Home`) flies back to the
  viewer's position; the tour can be switched off. Guillaume, 2026-11-11 (PRD Q-6,
  PR #1 review).
- **Revisit if:** viewers find the flights distracting.

## D-007 — 30 fps cap

- **Decision:** cap rendering at 30 frames per second. Guillaume, 2026-11-11 (PRD
  Q-7, PR #1 review).
- **Why:** pixel art barely gains from more, and it halves the battery cost.
- **Revisit if:** the zoom or camera drift looks choppy in B-011.

## D-008 — Seasons are part of the art direction

- **Context:** the scene already follows the time of day and the weather.
- **Decision:** it also follows the four seasons, with gradual transitions; snow on
  the ground comes from live data. Guillaume, 2026-11-11 (project thread). Growth
  G-010 is planned; backlog B-022.
- **Why:** seasons make the scene alive over months, and explain seasonal patterns
  in the data (winter consumption, summer solar).
- **Revisit if:** the mockups (B-010) show four palettes cost too much to draw well.

## D-009 — How an éCO2mix reading is accepted

- **Context:** B-005 checked the API itself (ARCHITECTURE § éCO2mix: fields and
  caveats). Every published step has every figure; a technology absent from a region
  is 0 MW with a `null` load factor; load factors exceed 100 %; regional steps arrive
  about an hour late.
- **Options:** (a) accept a reading figure by figure, keeping the valid ones; (b)
  accept it whole or not at all. For staleness: 1 h, 3 h or 6 h.
- **Decision:** (b): one invalid figure makes the whole reading "unavailable", since
  the real API never sent a partial step in 10 weeks and a partial mix would draw a
  false share. A `null` load factor means "no such plant". Load factors are
  accepted up to 200 %; a negative production figure is rejected. A reading is
  stale after 3 h; a step more than 15 min in the future counts as unavailable. Proposed by Claude, confirmed by Guillaume, 2026-11-11 (decision card in the project thread).
- **Why:** the scene never shows a made-up or half-true mix (AGENTS.md §1); 3 h
  covers the measured 1 h delay plus one missed hourly refresh.
- **Revisit if:** the API starts sending partial steps (the parser would then reject
  many readings: `tools/check-eco2mix.ts` counts them), or a longer run shows a
  longer normal delay.

## D-010 — How an Open-Meteo reading is accepted and grouped

- **Context:** B-006 checked the API's answers and its list of weather codes (S-010).
  The scene draws seven kinds of weather, not 29 codes.
- **Decision:** like D-009, a weather reading is accepted whole or not at all: one
  invalid field, an unexpected unit, a grid point more than 0.5° from the position
  asked, or a code outside the API's list makes it "unavailable". Freezing drizzle
  and freezing rain are drawn as drizzle and rain, snow grains as snow, hail as a
  storm (table in ARCHITECTURE § Open-Meteo). The position sent is rounded to 0.1°
  and printed with one decimal. A weather reading is stale after 1 h. Proposed by Claude, confirmed by
  Guillaume, 2026-11-11 (end-of-step questionnaire in the project thread).
- **Why:** the same rule as for the grid keeps the scene honest; ice and hail are
  rare in France and would each cost a particle effect for a few days a year.
- **Revisit if:** freezing rain or hail deserve their own effect (Growth), or the
  API adds codes (the parser would reject them: update the table).

## D-011 — Region lookup: nearest prefecture until the map, and how the picker behaves

Superseded by [D-015](#d-015--region-lookup-on-the-map-cells-and-22-km-around-france) for the lookup rule and the abroad threshold.

- **Context:** B-004 needs a region from a position, offline. The exact answer needs
  the outlines of the regions, which belong to the baked map (B-008, DS-04 still to
  check). The nearest-prefecture lookup was measured: 8.0 % of the mainland's area
  maps to a neighbouring region (ARCHITECTURE § Geolocation).
- **Options:** (a) ship the nearest-prefecture lookup now, with the region list to
  correct it; (b) bring forward a coarse grid of regions baked from the official
  outlines (DS-04) into this step.
- **Decision:** (a), with a region list always available. Beyond 120 km from every
  prefecture a position is abroad (national view); towns just across a border map
  to the French region next door. On refusal the viewer stays on the current area;
  abroad, France is shown without forgetting the remembered region.
  Region names are the official French names in every language. Proposed by
  Claude, confirmed by Guillaume, 2026-11-11 (end-of-step questionnaire), who adds
  that a more exact lookup is better for the viewer as soon as it can be had: the
  switch to map cells in B-008 is that correction.
- **Why:** the grid is B-008's job and needs DS-04 decided first; most people live
  near a prefecture, and the error is one click to fix.
- **Revisit if:** Guillaume wants (b) now, or B-008 lands (the lookup then switches
  to map cells, as planned).

## D-012 — The sun and the moon are checked against Astronomy Engine, not NOAA's site

- **Context:** B-007 asks for the sun within 0.5° of NOAA's calculator (S-008). The
  cloud sessions cannot open gml.noaa.gov (refused by the network policy,
  2026-11-11), nor its archived copies.
- **Options:** (a) check against Astronomy Engine (S-012), an independent ephemeris
  tested against JPL Horizons, with its values committed as a fixture; (b) wait
  until gml.noaa.gov is allowed in the `wattscape` environment and read NOAA's
  values; (c) Guillaume reads a few values on NOAA's calculator by hand.
- **Decision:** (a) now: a stricter check than the target (agreement within 0.01°
  with the sun up). The algorithm stays NOAA's. Proposed by Claude, 2026-11-11;
  confirmed by Guillaume, 2026-11-11 (end-of-step questionnaire) **with option (b)**:
  gml.noaa.gov was allowed in the `wattscape` environment the same day, NOAA's own
  code was read (S-008), and `tests/sun.test.ts` now also checks `sunPosition`
  against a transcription of it on 20,000 random instants and places (agreement
  within 10⁻⁶°; 10⁻⁹° measured).
- **Why:** a second, independent and more precise model is a stronger test than one
  calculator built on the same equations; the fixture makes it reproducible offline.
- **Revisit if:** gml.noaa.gov becomes reachable, or a value read on NOAA's
  calculator disagrees by more than 0.1° with the sun up.

## D-013 — The "Live data" page is public

- **Context:** B-007 added a debug page listing every live figure with its source
  and time (ARCHITECTURE § Debug page). It could be hidden (no link) or linked from
  the page.
- **Options:** (a) linked from the credits, public; (b) reachable only by its URL;
  (c) left out of the deployed build.
- **Decision:** (a). Proposed by Claude, confirmed by Guillaume, 2026-11-11
  (end-of-step questionnaire).
- **Why:** it is the proof that every figure on screen is true and traceable
  (AGENTS.md §1); it shows only open data and a prefecture's position, never the
  viewer's.
- **Revisit if:** it ever needs to show anything that is not public open data.

## D-014 — Sources of the baked map: IGN for France, Natural Earth for its neighbours

- **Context:** B-008 bakes the map of France: region outlines (DS-04), relief
  (DS-05) and, so that France does not float alone, the land of its neighbours. The
  `wattscape` cloud environment was opened to IGN's servers (data.geopf.fr,
  geoservices.ign.fr) on 2026-11-11 to read them.
- **Options:** regions: (a) IGN ADMIN EXPRESS from IGN's WFS, (b) the france-geojson
  mirror of its 2018 edition (S-011). Relief: (a) IGN BD ALTI from IGN's WMS, (b)
  Copernicus DEM GLO-90 (reachable on AWS, but its licence page, on
  dataspace.copernicus.eu, could not be read from the cloud sessions; it is a
  custom licence, not one the register's GO rule lists). Neighbours: (a) Natural
  Earth 1:10m countries, (b) OpenStreetMap (DS-06, share-alike), (c) none.
- **Decision:** IGN ADMIN EXPRESS COG CARTO (DS-04), IGN BD ALTI (DS-05) and Natural
  Earth (DS-11), all GO. Both IGN licences are Licence Ouverte 2.0, read in IGN's
  own metadata records (S-013, S-014); Natural Earth is public domain (S-015).
  Foreign land is drawn flat (BD ALTI covers France only). Proposed by Claude,
  confirmed by Guillaume, 2026-11-11 (decision card in the project thread).
- **Why:** the official publisher, under the licence the project already uses for
  éCO2mix; no share-alike on a database committed to the repo; the neighbours'
  coast at 1:10m is fine for 4 km cells.
- **Revisit if:** the neighbours need relief (the Alps' Italian side, the Pyrenees'
  Spanish side): a licence-compatible DEM beyond France is then needed.

## D-015 — Region lookup on the map cells, and 22 km around France

- **Context:** D-011 shipped the nearest-prefecture lookup until the map existed;
  it put 8.0 % of the mainland in the wrong region. Guillaume asked for an exact
  lookup as soon as possible (D-011). The baked map (B-008, D-014) now holds the
  region of every 1 km cell.
- **Options:** cell size: 4 km (the scene's grid, borders four times coarser)
  or 1 km (0.33 % measured, 37 KB more). Near France: (a) keep D-011's
  rule (within 120 km of a prefecture: Brussels maps to Hauts-de-France); (b) within
  22 km of a French cell, the nearest region; (c) only inside France, abroad
  otherwise (a beach or a boat off the coast would read "abroad").
- **Decision:** 1 km cells, and (b), measured from the position to the centre of
  the nearest French cell in true km: 22 km is 12 nautical miles, the breadth of
  the territorial sea. Foreign towns near the border map to the French region next
  door: Geneva, Lausanne, Basel, Freiburg, Karlsruhe, Saarbrücken, Luxembourg, Mons,
  Tournai, Monaco, Ventimiglia, Andorra la Vella, San Sebastián and Alderney (all
  measured). Brussels, Bern, Ostend, Dover, Jersey, Guernsey and Sardinia are
  abroad. The sea off Corsica gets the national view like Corsica. The picker's
  behaviour (D-011) is unchanged. Proposed by Claude, confirmed by Guillaume,
  2026-11-11 (decision card in the project thread).
- **Why:** measured against the full-precision official outlines, the 65 wrong
  points of 20 000 all lie within 0.55 km of a border (ARCHITECTURE § Geolocation); the margin keeps people
  near the coast or a border on the region they are next to; a viewer in a foreign
  town near the border gets a French region rather than nothing, and can switch to
  France in one click.
- **Revisit if:** viewers near a border complain, or GPS positions at sea need a
  wider margin.

## D-016 — Palette, darkening chains and night darkness

- **Context:** B-009 fixes the palette, the dithering and the light keyframes that
  the mockups (B-010) will be drawn with. ARCHITECTURE asked for about 24 colours,
  a signature colour per source, and light changes in palette steps.
- **Options:** night drawn as (a) a darker palette colour per colour, chained, with
  dithered fractional steps; (b) an RGB multiply (leaves the palette, rejected by
  ARCHITECTURE § Art direction); (c) a second, night palette (twice the colours to
  draw and validate). Night darkness of (a): 2 or 3 steps.
- **Decision:** (a), 24 colours (ARCHITECTURE § Art direction), land darkening
  towards the sea's blues and never into a source's colour; 2 steps at night,
  because 3 steps turned most land into the night sky on the test card. Proposed
  by Claude, 2026-11-11; to be validated with the mockups (B-010, PRD Q-1).
- **Why:** the scene stays in palette at every hour, the change of light spreads
  evenly by dithering, and sources stay recognisable at night.
- **Revisit if:** the mockups show the night too dark or too flat, or a colour
  reads badly next to its neighbours.

## D-017 — The map is drawn north up

- **Context:** the mockups (B-010) drew the baked map in two 2:1 projections: the
  true isometric view, which turns France by 45°, and the same tiles with north
  kept up, seen from the south (ARCHITECTURE § Mockups).
- **Options:** (a) north up; (b) true isometric.
- **Decision:** (a). Proposed by Claude, chosen by Guillaume, 2026-11-11 (PRD Q-8,
  decision card in the project thread).
- **Why:** a screensaver is watched from afar, for a few seconds: France must be
  recognisable at a glance; the relief and the 2:1 tiles keep the diorama feel.
- **Revisit if:** the zoom (B-011) or the sprites read badly without the iso angle.

## D-018 — The region level draws a 1 km relief

- **Context:** the mockups (B-010) drew Normandie from the 4 km grid the national
  view uses; at the region's zoom each cell is a large block, and coasts and
  valleys are lost (ARCHITECTURE § Mockups).
- **Options:** (a) bake a 1 km elevation grid for the region level, next to the
  1 km regions grid the lookup already uses; (b) keep the 4 km grid at every zoom.
- **Decision:** (a). Proposed by Claude, chosen by Guillaume, 2026-11-11 (PRD Q-9,
  in the project thread). It lands with the level of detail of the zoom (B-011);
  the extra size of the baked data is measured there.
- **Why:** the region is where the viewer lives: its coast and its relief must be
  recognisable.
- **Revisit if:** the 1 km data makes the load or the memory miss the budget
  (ARCHITECTURE § Performance).

## D-019 — The mockups are validated: calm pixel art, dithered dusk

- **Context:** Guillaume asked for elegant pixel art; the first mockups (B-010) were
  noisy, and a calmer set was drawn (ARCHITECTURE § Mockups): flat altitude bands,
  flat sea bands, hill shading from the north-west, mid-mountains moonlit blue at
  night. It confirms D-016 (palette, darkening chains, 2 steps at night).
- **Options for dusk:** (a) fine ordered dithering between palette steps, smooth
  but grainy for about an hour; (b) whole palette steps, crisp but with two or
  three sudden changes of tone.
- **Decision:** the calm mockups, and (a). Proposed by Claude; Guillaume found the
  new mockups better ("oui c'est mieux !") and chose (a) on a decision card,
  2026-11-11 (PRD Q-1).
- **Why:** a screensaver runs continuously: a sudden change of tone catches the
  eye more than a fine grain does.
- **Revisit if:** the grain at dusk reads as noise on a real screen, at the real
  scale factor.

## D-020 — A continuous zoom, drawn crisp at any scale

- **Context:** B-011 brings the zoom between France and a region. ARCHITECTURE
  proposed a continuous camera drawn at the nearest of a few integer levels of
  detail, and a spike to check it felt smooth.
- **Options:** (a) the scale snapped to integer tile widths (2, 4, 6, 8 pixels), each
  zoom step a jump; (b) a continuous scale with each cell spanning the pixels
  between floor(edge × scale) of its edges, tiles differing by at most a pixel while
  the zoom moves; (c) draw at an integer level and scale the image smoothly
  (blurred, off-palette pixels).
- **Decision:** (b), with the camera rounded to whole pixels and every pattern
  (dithering, lamps, crossfade) anchored to the ground, so that a pan moves the
  picture by whole pixels without a shimmer; the 4 km layer below 0.5 pixel per km,
  the 1 km one from 0.7, a dithered crossfade in between (ARCHITECTURE § Art
  direction). Proposed by Claude, 2026-11-12; to be validated by Guillaume on the
  deployed build.
- **Why:** a zoom by jumps reads as a slideshow; (b) keeps the pixel art crisp and
  in palette at every scale, and its cost follows the pixels, not the cells. The
  scales put France on the 4 km map and every region, as framed on a landscape
  screen, on the 1 km one (tested).
- **Revisit if:** the one-pixel wobble of tiles during a zoom shows on a real screen,
  or the crossfade reads as noise.

## D-021 — The 1 km relief: baked next to the map, loaded when needed

- **Context:** D-018 chose a 1 km relief for the region level and asked for its size
  to be measured.
- **Options:** (a) one more grid in `src/map/france.ts`, downloaded with the page;
  (b) its own file, a separate chunk the browser fetches from the site when the
  camera comes close or the viewer has a region; (c) per-region files.
- **Decision:** (b). `src/map/relief.ts`: 232 KB, 86 KB compressed; decoded, 3.8 MB
  and about 40 ms, once. The fine grid also marks foreign land now (Natural Earth,
  DS-11), so the close view knows land from sea at 1 km; the region lookup reads
  only the regions and is unchanged, and the re-bake left the regions and the 4 km
  grid identical, cell for cell. Proposed by Claude, 2026-11-12.
- **Why:** the national view, the first thing everyone sees, does not wait for it;
  (c) would save little (most of the size is the mountains) and complicate the
  crossfade at regional borders.
- **Revisit if:** B-013 measures the load or the memory beyond the budget.

## D-022 — The 1 km terrain stays calm: cliffs and shading at the scale of slopes

- **Context:** drawn like the 4 km mockups (D-019), the 1 km layer turned every
  100 m step of the plains into a dark line, and shaded every bump of the
  mountains: busy, not the calm pixel art Guillaume asked for.
- **Options:** (a) draw it like the mockups; (b) a south face is a darker cliff only
  where the land drops by 250 m or more to the cell in front of it, or to the sea,
  and hill shading compares a cell with the one 4 km to its north-west, on both
  layers; (c) smooth the relief itself (it would no longer be the data).
- **Decision:** (b), on both layers, so the national view changes little (a few
  lowland faces lose their darker line). Proposed by Claude, 2026-11-12; open to
  Guillaume (PRD Q-10, step-3 screenshots).
- **Why:** the plains read flat again and the mountains as slopes, while every cell
  keeps its own elevation from the data.
- **Revisit if:** the relief reads too flat, or Guillaume prefers the mockups' look.

## D-023 — Guillaume confirms the zoom's open choices (Q-10 to Q-13)

- **Context:** B-011 (PR #12) left four choices open to Guillaume, each with a
  recommendation (PRD Q-10 to Q-13).
- **Options:** for each, the recommendation, or another answer.
- **Decision:** the four recommendations. Q-10: the calm 1 km terrain of D-022
  stays. Q-11: a relief for the neighbouring countries, after B-015, from a source
  that is GO in DATA-SOURCES first (G-012, now planned). Q-12: on load, France for
  1.5 s, then the flight to the viewer's region. Q-13: a double-click or a
  double-tap zooms ×2 where it lands, rather than flying to the region clicked.
  Guillaume answered "OK" to each, 2026-11-12.
- **Why:** D-022 for Q-10; Q-11 because the Alps end in a cliff at the border today;
  Q-12 because it shows where the region is, briefly; Q-13 because it works at
  every zoom, and a region is one pick in the list away.
- **Revisit if:** the deployed build shows otherwise on a real screen; G-012 waits
  for a relief source that is GO.

## D-024 — Plants from the national registry, at the chef-lieu of their commune

- **Context:** B-012 draws the plants, and PRD § 4.5 wants the major ones at their
  real places. The plants need positions, and a source that is GO.
- **Options:** (a) the ODRÉ national registry of installations (DS-07): every unit,
  its technology, capacity and commune, but no coordinates; (b) OpenStreetMap
  (DS-06): coordinates, but share-alike on a baked database; (c) a hand-made list of
  sites with coordinates looked up one by one.
- **Decision:** (a). Guillaume set DS-07 to GO on a decision card, 2026-11-12. Units
  in service of 10 MW or more are summed per technology and commune; per region and
  technology, every nuclear site and the largest of the others are kept (rules in
  ARCHITECTURE § Map); each stands at the chef-lieu of its commune (IGN, DS-04),
  moved onto its region if needed. Offshore wind waits for real positions (G-007).
  Which nuclear sites have cooling towers is a provisional list (PRD Q-14).
  Proposed by Claude, 2026-11-12.
- **Why:** official and open, the same publisher as the live figures, and it covers
  every technology; (b) would bind the repository to ODbL; (c) does not scale to
  wind and solar. A chef-lieu is within a few kilometres of the site, which shows at
  the region's zoom only as a small shift.
- **Revisit if:** a shift reads wrong on a real screen (B-017 can store exact sites),
  or a newer registry is published (re-bake).

## D-025 — Each plant follows its own region's load factor, in every view

- **Context:** the national dataset has no load factor (S-009), so ARCHITECTURE
  planned installed capacities (DS-07) to animate plants on the national view; and
  on a region view, the plants of the regions around would have no figure.
- **Options:** (a) one request per shown area, national figures divided by baked
  capacities on the national view, plants of other regions idle; (b) one request
  for the latest steps of every region (24 rows, about 17 KB), each plant driven by its
  own region's `tch_*`.
- **Decision:** (b). Proposed by Claude, 2026-11-12.
- **Why:** one figure per plant, published by RTE for that region, with no
  arithmetic of ours in between; every plant on screen moves truly, whatever the
  view; one request every 15 minutes, the same rate as before.
- **Revisit if:** the regions stop publishing their steps together, or the legend
  (B-019) needs the national row anyway (a second request then).

## D-026 — The six sprites and their motion

- **Context:** B-012: six source sprites, each animated by its figure, idle without
  one (ARCHITECTURE § Data-to-scene mapping), in the calm pixel art of D-019.
- **Options:** for each source, which motion carries the load factor; and how often
  to draw it, for a screensaver that runs for hours on battery.
- **Decision:** steam over cooling towers, rotors, glints on the panels, water down
  a dam, smoke from chimneys, a furnace window; the formulas of ARCHITECTURE §
  Data-to-scene mapping, provisional, tuned on the two recorded steps of 2026-11-12.
  The still frame is cached and the motion drawn over a copy ten times a second;
  markers on the national view; `?sample=day|night` shows the recorded steps,
  labelled as sample data, for demos and screenshots. Nuclear plants without towers
  show their load factor by lit windows at night only (PRD Q-16). Proposed by
  Claude, 2026-11-12; to be validated by Guillaume on the deployed build.
- **Why:** one motion per figure, slow (nothing faster than 2 Hz) and sparse; the
  cost of the motion is about 0.05 ms a step, against 5 to 10 ms for a still frame.
- **Revisit if:** the plants read too small or too busy on a real screen, or B-013
  measures the motion beyond the budget.

## D-027 — Guillaume confirms the plants' open choices (Q-14 to Q-16)

- **Context:** B-012 (PR #13) left three choices open to Guillaume, each with a
  recommendation (PRD Q-14 to Q-16).
- **Options:** for each, the recommendation, or another answer.
- **Decision:** the three recommendations. Q-14: cooling towers at the 11 sites of
  `tools/bake-plants-rules.ts`, none at Tricastin, Saint-Alban, Blayais and the
  coast; Guillaume added "ne pas oublier les sites en mer comme à Fécamp
  (éoliennes)": the offshore wind farms, left out of D-024, are to be drawn at sea,
  Fécamp first (G-007, with B-015). Q-15: plants at the chef-lieu of their commune
  for now. Q-16: nuclear plants without towers show their load factor by lit
  windows at night, and a warm-water shimmer on the sea can come with Normandie
  (B-015). Guillaume answered "OK" to each, 2026-11-12.
- **Why:** the reasons of D-024 and D-026; the tower list still has no source
  (S-016): Guillaume's confirmation is the check it waited for.
- **Revisit if:** a source contradicts the tower list, or a plant reads in the wrong
  place on a real screen.

## D-028 — The performance budget, measured

- **Context:** B-013: ARCHITECTURE § Performance held a provisional budget (≤ 8 ms
  of main-thread work per frame at 1080p, memory flat over 4 hours, 2 requests
  every 15 minutes), to be measured and fixed. `tools/perf.ts` measured the built
  site in Chromium, 2026-11-12.
- **Options:** (a) one figure for every frame, 8 ms; (b) a budget for the steady
  state (still, plants moving, idle drift), which a screensaver runs for hours, and
  another for the camera moving (flight, zoom, pan), which lasts seconds; (c) (b),
  plus a coarser 2 km layer between scales 0.5 and 1.4 to bring the moving camera
  under 8 ms.
- **Decision:** (b): steady state ≤ 3 ms per frame at p95 and ≤ 30 ms of work per
  second; camera moving ≤ 25 ms per frame at p95; memory and network as before.
  Proposed by Claude, 2026-11-12; (c) was put to Guillaume as PRD Q-17, who chose
  (b): "Oui OK" (Guillaume, 2026-11-12).
- **Why:** the steady state measures 0.3 ms per frame (2.4 ms at p95) and 9 to
  27 ms of work per second, 1 to 3 % of a core: the battery cost is there, and it
  is small. The moving camera measures 18 to 22 ms at p95, under the 33 ms of a
  frame at 30 fps: smooth, for a few seconds. Its cost follows the 1 km cells a
  frame walks, thinner than a pixel between scales 0.55 and 1.35; three changes
  that keep every pixel gained 4 % at most (ARCHITECTURE § Performance). Only a
  coarser layer would cut it, and that changes the picture, which is Guillaume's
  call, and he kept (b). Memory and network held over a 115-minute soak: heap flat at 2.1 MB, one
  request every 15 minutes. Guillaume asked whether 4 hours were needed; the soak
  runs an hour at least, and a 4-hour one waits in PRD Growth (G-013) (Guillaume,
  2026-11-12).
- **Revisit if:** a laptop shows the flight or the zoom stuttering, a frame of the
  steady state outgrows its budget (`tools/perf.ts frames` after a drawing change),
  or the moving camera turns out to stutter on Guillaume's laptop.

## D-029 — Towns light up with their region's consumption

- **Context:** B-014: town windows are to be lit by `consommation`, "∝ position of
  consumption in the area's typical range (baked p5–p95)" (ARCHITECTURE §
  Data-to-scene mapping). The real-time dataset (DS-01) goes back only to
  2026-09-01: its range would miss the winter.
- **Options:** for the range, (a) DS-01's ten weeks; (b) twelve months of RTE's
  consolidated and definitive regional éCO2mix (DS-12), baked; (c) no data, towns
  lit as before. For the drawing, how many of a town's pixels are lamps.
- **Decision:** (b): DS-12 GO (Guillaume, 2026-11-12, on a decision card, where it
  was named DS-08 by mistake: that id was taken). The 5th and 95th percentiles over
  2025-09-01 to 2026-09-01, per region; l = (c − p5) / (p95 − p5), clamped to 0–1;
  at night a town lights 4 + 12·l of every 16 of its pixels, its first pixel always,
  so a lit town never goes dark. A region without a figure lights none: its towns
  show their roofs, unlit (Corsica, always). Proposed by Claude, 2026-11-12.
- **Why:** the same publisher and licence as the live figures; percentiles ignore
  the few absurd steps of the data (0 MW, four times a usual peak); a quarter of
  the windows at the year's low keeps a town readable at night; an unlit town says
  "no figure" without inventing one.
- **Revisit if:** real towns (B-015) make the scatter read too busy or too sparse,
  or RTE publishes a new year as definitive (re-bake).

## D-030 — The time-lapse replays the real day

- **Context:** B-014 and PRD § 4.9: a time-lapse, "to watch a day in a minute". The
  light can follow any clock, but the plants and the towns show figures: with the
  latest step held while the sun goes round, solar fields would glint at night.
- **Options:** (a) the light alone, the figures held at the latest step; (b) the
  light alone, the plants and towns idle; (c) the day before now replayed, light and
  figures together, from the steps RTE published (one request).
- **Decision:** (c), `?timelapse=day`: the 24 hours before now (or before `?at=`),
  in 60 seconds, over and over; one request at load for every region's steps of
  that day; at each instant the latest step at or before it, labelled "Accéléré"
  with its date and time. Proposed by Claude, 2026-11-12.
- **Why:** every figure on screen stays the one published for the instant shown
  (AGENTS.md § Faithfulness); one request of about 120 KB compressed, once, keeps the
  network budget (D-028).
- **Revisit if:** a longer replay is wanted (a week: 8 MB, too much for one
  request), or the export endpoint changes its limits.

## D-031 — Real towns, sized by their population

- **Context:** B-015: the towns were the 96 prefectures (S-006), one dot each, the
  regional capitals a pixel larger. The first region (Normandie) needs its real
  towns: Le Havre, Rouen, Fécamp, Dieppe and the small towns between them.
- **Options:** (a) the prefectures; (b) every commune above a population, one dot
  each; (c) every commune above a population, covering an area that grows with it;
  (d) INSEE urban units, which would need a new source.
- **Decision:** (c): the communes of metropolitan France with 2 000 inhabitants or
  more (5 397), from ADMIN EXPRESS COG (DS-04, already GO), at their chef-lieu. A
  town covers population / 4 000 km² (a dense town's density), never more than its
  commune's area, in whole cells of French land nearest its chef-lieu; at least one
  cell when its population alone rounds to one, so a dense suburb shows. At 4 km only
  towns of 32 000 or more show; at 1 km all of them. Regional capitals are no longer
  drawn larger: their size now says how big they are. Proposed by Claude,
  2026-11-12.
- **Why:** the size of a town on screen is a true figure (INSEE population), and the
  same rule gives the national view its cities and the region view its small towns;
  2 000 inhabitants is the INSEE threshold of an urban commune; no new source.
- **Revisit if:** the national view reads too busy or too sparse, a region view
  shows towns as noise, or urban units are wanted (one blob per agglomeration).

## D-032 — Plants where they stand, offshore farms at sea

- **Context:** B-015 and G-007: the plants stood at their commune's town hall
  (D-024, PRD Q-15), a few kilometres off, and the offshore wind farms were left
  out, the registry giving only the commune where a farm lands on the grid.
  Guillaume insisted on the offshore farms, Fécamp first (2026-11-12).
- **Options:** (a) keep the town halls; (b) coordinates typed by hand, each logged
  in SOURCES; (c) IGN BD TOPO, which maps every power plant's zone and every wind
  turbine, offshore included.
- **Decision:** (c), DS-13 GO (Guillaume, 2026-11-12, on a decision card). A site
  stands at the centre of the largest BD TOPO « Centrale électrique » zone of its
  kind (`ZONE_KINDS`) in its commune, else at the town hall as before; an offshore
  farm (`OFFSHORE_FARMS`: Fécamp, Saint-Nazaire, Saint-Brieuc) is the units of the
  registry that share its name, at the centre of its turbines at sea, driven by the
  region where it lands (its `tch_eolien`, which mixes onshore and offshore: the
  split is national only) and drawn as five turbines on the water. Proposed by
  Claude, 2026-11-12.
- **Why:** the national mapping agency's data, under the same licence as the map;
  baked once, so no new host at runtime; the nuclear sites move 1 to 5 km, onto the
  shore for Paluel and Penly.
- **Revisit if:** RTE publishes a regional offshore figure; a new farm comes into
  service (Calvados, Dieppe - Le Tréport, Yeu - Noirmoutier: re-bake with the next
  registry); or a zone is matched to the wrong plant.

## D-033 — The first landmarks: Étretat, Port 2000, Fécamp's harbour

- **Context:** B-015 draws Seine-Maritime's landmarks. In `POI.md`, P-001 (Étretat's
  arch and needle), P-002 (Le Havre's container cranes) and P-005 (Fécamp's cliffs
  and harbour) were GO as proposed by Claude, to confirm.
- **Options:** the three; Étretat only; none until B-016.
- **Decision:** the three (Guillaume, 2026-11-12, on a decision card), drawn in code
  at positions read in BD TOPO (S-018): the arch and the needle; two ship-to-shore
  cranes over containers, a red light on each at night; a jetty and a generic
  lighthouse, its lantern lit at night.
- **Why:** a natural site and two generic scenes, with no author's rights; they give
  the first region its coast, its port and the town of the offshore farm.
- **Revisit if:** a sprite does not read as its place at the region's scale, or a
  landmark of Seine-Maritime is found in the public domain (P-003, P-004).

## D-034 — Answers to the B-015 questionnaire (PRD Q-18 to Q-22)

- **Context:** the end of B-015: its provisional choices, each asked with a
  recommendation (PRD Q-18 to Q-22).
- **Options:** for each, the recommendation or a free answer.
- **Decision:** every recommendation, Guillaume, 2026-11-13 ("OK pour toutes les
  questions"): Q-18, the towns as communes of 2 000 inhabitants or more, drawn at
  4 000 per km² (D-031) stay; Q-19, the offshore farms turn with their region's wind
  load factor (D-032); Q-20, the warm-water shimmer off the coastal nuclear plants
  waits, as Growth G-014; Q-21, the 131 sites with no BD TOPO zone stay at their
  town hall; Q-22, Étretat, the cranes and the lighthouse read as their places
  (D-033).
- **Why:** each was the recommendation, with its reason in PRD § Open questions.
- **Revisit if:** the conditions in D-031, D-032 and D-033 arise, or a region of
  B-016 shows a rule reading badly.

## D-035 — Lessons of step 3 in AGENTS.md; one working branch

- **Context:** the review of step 3 (B-011 to B-015, PRs #12 to #21) listed what
  caused rework: PRs merged while a push was still on its way, a single allowed
  branch with no force-push, two figures written before they were measured, a wrong
  register id on a decision card, a new source left out of the credits, tables
  realigned by Prettier, a 52 s unit test, a file truncated by a scripted edit, and
  undocumented e2e tooling.
- **Options:** eight rules for AGENTS.md and `docs/DATA-SOURCES.md`, all, some or
  none; for the branches, one working branch, or a second one to prepare the next PR
  while the previous one waits for its merge.
- **Decision:** the eight rules (Guillaume, 2026-11-13, "OK pour les 8
  modifications"), and one working branch, "pour éviter les conflits (on pourra
  revoir plus tard)" (Guillaume, 2026-11-13). The rules: measure a figure before
  writing it anywhere; re-read a register id before citing it; check a PR's state
  before pushing to it, and answer a questionnaire in a docs PR of its own; the Git
  rules (one branch, no history rewrite, merge `main` after a merge, push before the
  session ends); the e2e and frame-hash tooling, with `tools/record-frames.ts`; a
  source set to GO lands with its credits; unit tests under ~5 s; short values in
  Markdown tables.
- **Why:** each rule answers a friction measured in step 3; one branch avoids
  conflicts between stacked PRs.
- **Revisit if:** waiting for a merge stalls the work for long, or a rule turns out
  to cost more than the rework it prevents.

## D-036 — Large plants found by their name in BD TOPO

- **Context:** B-017 places the major plants at their real places. After B-015, 28
  sites of 100 MW or more stood at their commune's town hall (PRD Q-21): the registry
  (DS-07) often files a plant under another commune than the one BD TOPO puts its
  zone in (Curbans under Venterol), and many hydro zones have no `nature_detaillee`
  (« Centrale Électrique de la Bâthie »), which the rule of D-032 skipped.
- **Options:** keep the town hall; take the nearest unnamed zone of the right kind
  (a guess: Montézic's nearest is another plant); match the plant's name, read in
  the registry's `nominstallation`, against the names of BD TOPO's zones and dams;
  a new source of coordinates (Wikidata, OpenStreetMap), which needs a GO in
  `DATA-SOURCES.md` first.
- **Decision:** match the name, within 15 km of the town hall, before the rule of
  D-032; for hydro, a named dam after it (ARCHITECTURE § Map, the order). A zone with
  no kind is not taken when its name tells another technology (Strasbourg's hydro
  plant is not « Centrale Biomasse de Strasbourg »); wind and solar farms are left
  out, their names being too common. Proposed by Claude, 2026-11-13.
- **Why:** BD TOPO is already GO (DS-13) and baked; a name is evidence, a nearest
  zone is a guess. The bake of 2026-11-13 places 13 more sites (186 of 304 on land),
  12 of the 28 large ones among them, and moves 5 already placed ones 0.4 to 6 km
  onto their named plant (Montereau, Émile Huchet at Saint-Avold, Strasbourg,
  Miégebat at Laruns, Villarodin at Avrieux).
- **Revisit if:** a name matches the wrong plant on screen, or a GO source of
  coordinates places the 14 large plants BD TOPO does not name (PRD Q-23).

## D-037 — A register of plant placement points

- **Context:** the places of the plants come from rules that sometimes guess (a town
  hall, a name match), and their known weak points were spread over the PRD's
  questions, ARCHITECTURE and PR descriptions.
- **Options:** keep them in the PRD's open questions; add them to `POI.md`; a
  register of their own.
- **Decision:** `docs/PLANTS.md` (Guillaume, 2026-11-13: "loguer […] toutes les
  questions pertinentes et décisions sur le placement des centrales & co. Cela
  permettra d'améliorer en continue"): one row per point (a misplaced site, a rule
  that guesses, a site left out), with a status, OPEN, WAIT or DONE. The rules stay
  in ARCHITECTURE and their reasons here; a test keeps a row for every site of
  100 MW or more that stands at its town hall.
- **Why:** `POI.md` is about authors' rights, another matter; one list makes the
  placement improvable point by point, and auditable.
- **Revisit if:** the register repeats ARCHITECTURE, or grows past what one table
  can hold (then one table per region).

## D-039 — Rivers: baked lines from BD TOPO, kept by their reach

- **Context:** Guillaume asked for the main rivers of France on the map
  (2026-11-13: "Possible d'ajouter les fleuves et rivières principales de
  France ?"; Growth G-015, B-023). The map had no water but the sea.
- **Options:** for the source, BD TOPO's `cours_d_eau` (DS-13, already GO and
  baked for the plants), or a new dataset (Natural Earth's rivers, BD CARTHAGE),
  which needs a GO first. For the form, cells baked per layer, or lines turned into
  cells by each layer. For which rivers, BD TOPO's `importance`, a hand-written
  list, or a measure of length.
- **Decision:** BD TOPO, as lines (0.1 km points, thinned to 0.3 km) that each
  layer turns into cells with integers only. The stretches of one name that touch
  are joined; a river is measured by its **reach**, the 1 km cells it crosses, and
  kept from 100; the lines of a river that cross no cell of their own are dropped;
  canals and aqueducts are left out by their name. The rivers of reach 300 or more
  (17) show on the national view and load with the page; the others (75) show from
  close and load with the 1 km relief. A river is drawn in the shallow sea's
  colour, through the towns but for their chef-lieu's cell, and is veiled with the land around the viewer's region.
  Proposed by Claude, 2026-11-13.
- **Why:** no new source; lines stay independent of the grid and of the theme
  (G-011), and are smaller than cells (104 KB for both files). `importance` does
  not rank the rivers usably (S-018); summed lengths counted every side arm (the
  Seine 932 km), which the reach does not (710 cells). Two thresholds keep the
  national view readable and the first download small (16 KB compressed).
- **Revisit if:** a river is missing or cut on screen (a stretch under another
  name, a stretch with no name), the national view reads as a web (raise 300), or
  a canal worth showing is asked for (the Canal du Midi).
