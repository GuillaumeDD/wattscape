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
  stale after 3 h; a step more than 15 min in the future counts as unavailable. Proposed by Claude, 2026-11-11, to confirm by Guillaume.
- **Why:** the scene never shows a made-up or half-true mix (AGENTS.md §1); 3 h
  covers the measured 1 h delay plus one missed hourly refresh.
- **Revisit if:** the API starts sending partial steps (the parser would then reject
  many readings: `tools/check-eco2mix.ts` counts them), or a longer run shows a
  longer normal delay.
