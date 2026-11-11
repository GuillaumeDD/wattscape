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
