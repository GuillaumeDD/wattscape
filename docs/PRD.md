# PRD — Wattscape

_France's electricity, live, as a pixel-art screensaver._

## 1. Vision

A calm, beautiful scene to leave running on a screen, that teaches without lecturing.
You open a link; the map of France appears in minimal pixel art, centered on your
region. Its power plants are alive with the grid's real numbers: cooling towers steam
as hard as the reactors are running right now, wind turbines turn as fast as the wind
farms produce, dams spill, solar fields glint while the sun shines, town windows light
up with the evening peak. The sky follows the real sun and the real weather. Zoom out
and you see the whole country's mix; zoom in and you see your region's landmarks
(the Eiffel Tower, the cliffs of Étretat, the port of Le Havre…) next to the plants
that power them.

Inspired by [Infinite Jungle](https://mo.town/jungle/index.html) (S-002) for the mood
and craft, and by [Electricity Maps](https://app.electricitymaps.com/) (S-001) for the
idea that the grid can be seen.

## 2. Users

- **Viewers:** Guillaume, family and friends, then anyone curious. The scene runs on
  an idle screen (laptop, TV, office display), so it is watched for seconds at a time,
  often from a distance, and must read at a glance.
- **Learners:** the same people, when something on screen makes them ask "why is the
  nuclear plant quieter tonight?". The answer must be one tap away, never in the way.

## 3. Goals and non-goals

### Goals

- **True:** every moving part reflects a live, sourced figure (AGENTS.md §1).
- **Beautiful:** minimal, elegant pixel art; a scene people leave on for its own sake.
- **Local:** centered on the viewer's region, with its own landmarks and plants.
- **Alive:** day and night from the real sun, weather from the real sky, and the
  four seasons.
- **Explorable:** a continuous zoom between the whole of France and one region.
- Zero install: one link, a static site, works offline with sample data.

### Non-goals

- A dashboard or an analysis tool (Electricity Maps and RTE éCO2mix already are).
- Forecasts, history charts, prices, CO₂ accounting beyond what éCO2mix publishes.
- Plant-by-plant production in the first version (see Growth G-003).
- Overseas France and Corsica at regional detail: éCO2mix's regional real-time data
  covers the 12 mainland regions only (S-007); they get the national view.
- Accounts, a backend, analytics, ads.

## 4. Functional requirements

### 4.1 Location

- On first visit, ask for the browser's position, with one sentence saying why and
  what is (not) done with it (ARCHITECTURE § Privacy).
- The position maps to a mainland region **offline**; outside mainland France, in
  Corsica, or when the user declines, the scene opens on the national view.
- The user can pick another region at any time (region list, or zoom and pan); the
  choice is remembered in the browser and can be set in the URL (`?area=28`).

### 4.2 Live grid data

- Source: RTE éCO2mix real-time data, published by ODRÉ (S-003, S-004): consumption,
  production by source (nuclear, hydro, wind, solar, thermal, bioenergy), pumping,
  net exchanges, load factors, every 15 minutes, per region and for France.
- Refresh every 15 minutes while visible; pause when the tab is hidden.
- Show the time of the reading ("RTE éCO2mix, 08:45"). A reading older than 2 hours
  is shown as stale.
- When the API is down: keep the last reading with its age; with none, use built-in
  sample data, **labelled as sample** on screen.

### 4.3 The scene and the zoom

- The world is the map of France, drawn in pixel art (projection and style: §7 and
  ARCHITECTURE § Art direction).
- **Zoom** is continuous, from the whole of France to one region, by mouse wheel,
  pinch, `+`/`−`, and double-click/tap on a region:
  - **France level:** the 12 regions, each showing its dominant sources; the national
    mix in the legend; the grid's big flows between regions (Growth G-002).
  - **Region level:** the region's major power plants at their real places, its
    landmarks (§4.4), towns and terrain; the regional mix in the legend.
  - Between the two, detail fades in and out smoothly (level of detail), never pops.
- **Pan** by drag, arrows or WASD; the camera drifts slowly on its own after a few
  seconds of inactivity, like a screensaver.
- **Idle tour:** left alone, the camera stays on the viewer's region and, every 5
  minutes, takes a 1-minute flight to another region or the national view (Q-6).
  The tour can be switched off (setting, remembered in the browser).
- **Home button:** one button (and the `Home` key) flies back to the viewer's own
  position (or home region) from anywhere, at any zoom (Q-6).

### 4.4 Landmarks (POIs)

- Each region shows 2 to 4 salient, instantly recognisable landmarks, drawn in code,
  at their real place (register: [`POI.md`](POI.md), GO / NO-GO; candidates are checked
  against §6 before drawing).
- Landmarks are context, not data: they never carry a figure, but they can react to
  the time and weather (lit at night, a lighthouse beam, boats in a port).

### 4.5 Power plants and the data-to-scene mapping

- Major plants are placed at their real location (nuclear sites, large dams, large
  thermal plants, offshore wind farms); diffuse sources (onshore wind, solar,
  bioenergy, small hydro) are scattered procedurally where they are, in proportion to
  the region's installed mix.
- Each source has one animation driven by one documented figure (ARCHITECTURE §
  Data-to-scene mapping), e.g. the steam plume of cooling towers follows the regional
  nuclear load factor.
- Consumption is shown by towns: lit windows and the pulse of power lines follow the
  region's consumption relative to its typical range.

### 4.6 Day and night

- The sky, the light and the shadows follow the real position of the sun for the
  place and time (twilights included); the moon shows its real phase.
- At night, towns light up (driven by consumption), landmarks are illuminated, solar
  fields go dark.

### 4.7 Weather

- Live current weather from Open-Meteo (S-005) at the viewer's position (rounded) or
  at the region's reference point: cloud cover, rain, snow, fog, thunderstorm, wind.
- The weather is drawn (clouds, rain, snow, fog banks), and explains the data: clouds
  over the solar fields, wind bending the trees when the turbines spin.

### 4.7b Seasons

- The land follows the season of the date at the viewer's place: winter, spring,
  summer, autumn, with gradual transitions over a few weeks, never a jump on a fixed
  day (D-008).
- Each season changes the land palette and the life on it: bare trees and frost in
  winter, blossom and fresh greens in spring, ripe fields and dry grass in summer,
  red and gold leaves and ploughed fields in autumn. Vineyards, crops and lavender
  follow their own calendar.
- Snow on the ground comes from the live weather (snow depth where available), not
  from the calendar alone: a snowless winter stays green-brown.
- Seasons also show in the data, and the scene must not fight it: long nights and
  lit towns in winter (higher consumption), strong solar in summer.

### 4.8 Learning layer

- A discreet legend: the area's mix (stacked bar), consumption, imports/exports, and
  the time of the reading. Hidden after a few seconds of inactivity.
- Hover or tap on a plant or landmark: a short caption (name, what it is, the live
  figure it shows). Every caption fact is sourced (AGENTS.md §5).
- The legend and captions never cover the scene for long; the screensaver mode shows
  no UI at all.

### 4.9 Screensaver controls

- Full screen (`F`, button), cursor hidden when idle, a Wake Lock request to keep the
  screen on while in full screen (if the browser supports it).
- Keys: zoom, pan, `R` next region, `H` hide/show the legend, `?` help, `Space`
  pause the drift. Settings: time-lapse (to watch a day in a minute, with the day's
  real figures: `?timelapse=day`, B-014), weather override and fixed data, for demos
  and screenshots (also as URL settings).
- `prefers-reduced-motion`: no camera drift, slow animations.

### 4.10 Localization

- French (default) and English, chosen from the browser's language and switchable.

## 5. Non-functional requirements

- **Targets:** current Chrome, Firefox, Safari and Edge on desktop; mobile browsers
  as a bonus (touch zoom and pan work, no layout breaks).
- **Smooth and frugal:** steady frame rate at the chosen cap on a mid-range laptop,
  low CPU, memory flat over hours (budget: ARCHITECTURE § Performance).
- **Static site** on GitHub Pages; no backend, no API key, no cookies.
- **Resilient:** any API failure degrades to stale or sample data, never to a blank
  or frozen screen.
- **Privacy by design:** the position never leaves the browser except, rounded to
  about 10 km, to the weather API.

## 6. Content and licensing

- Code: **GPL-3.0-or-later**. Project art (sprites drawn in code, screenshots):
  **CC BY-SA 4.0**, listed in `ASSETS.md`.
- No third-party images, sprites or fonts unless CC0 / CC BY / CC BY-SA, with an
  `ASSETS.md` entry.
- **Data:** only open data that is GO in [`DATA-SOURCES.md`](DATA-SOURCES.md), with
  the attribution each licence asks for in the app's credits. Wattscape stays
  non-commercial (no ads, no subscription), as Open-Meteo's free tier requires.
- **Landmarks:** only public-domain works and natural or generic sites, each GO in
  [`POI.md`](POI.md) before it is drawn (D-004). French freedom of panorama is
  narrow, so recent works (and the Eiffel Tower's light show) stay out.

## 7. Art direction (direction A chosen: Q-1)

Two directions fit the brief; the zoom between France and a region (§4.3) decides
between them.

- **A. Isometric map of France (chosen, Guillaume, 2026-11-11).** France as a pixel-art relief model,
  seen from above at an angle in 2:1 tiles, like a board game or a tabletop diorama;
  drawn north up rather than turned 45° (D-017).
  Zoomed out, a small, elegant map with each region tinted; zoomed in, terrain tiles,
  towns, plants and landmarks as small iso sprites. The zoom is natural, plants sit at
  their real place, and Infinite Jungle shows the style holds up. Cost: we need the
  real shapes of France (coast, regions, relief) baked into tiles, and iso sprites are
  harder to draw.
- **B. Side-scrolling panorama.** An endless horizontal landscape of the region, in
  parallax layers, like a vintage railway poster. Easier to draw, very readable from
  afar, but places are not where they are and the "zoom" can only switch between a
  national and a regional landscape.

Shared principles for either (details: ARCHITECTURE § Art direction):

- **Minimal:** a small fixed palette (about 24 colours), flat shapes, hard pixel
  edges, no anti-aliasing, gradients only by ordered dithering.
- **Colour carries meaning:** each source has one signature colour used for its plants
  and in the legend (nuclear, hydro, wind, solar, thermal, bioenergy); the land
  stays muted so that the energy stands out.
- **Light carries time:** one global light tint (night, blue hour, golden hour, day)
  plus emissive pixels (windows, beacons, plumes lit from below) drawn on top at night.
- **The land carries the season:** one land palette per season, blended cell by
  cell over weeks (§4.7b).
- **Integer scaling** of a low-resolution canvas: crisp pixels at any screen size.
- **Calm, made for contemplation** (Guillaume, 2026-11-12), in every visual theme:
  slow motion, soft contrast, light kept for the energy and the towns.

## 8. Roadmap

Each step ends with a playable deployed build and a questionnaire of open choices.

1. **Step 0 — Skeleton:** repo, tooling, CI, Pages deploy, CSP, i18n (B-001 to B-003).
2. **Step 1 — Data:** location → area, éCO2mix and Open-Meteo clients with recorded
   fixtures, sun and moon, a debug view of the live figures (B-004 to B-007).
3. **Step 2 — Art direction:** mockups of the chosen direction at day and night for
   two regions, a palette, the six source sprites; Guillaume validates (B-008 to
   B-010).
4. **Step 3 — First region:** map, zoom and pan, plants driven by live data, day and
   night, for Normandie, detailed first in Seine-Maritime (Le Havre, Fécamp, Étretat,
   the Paluel and Penly nuclear plants, the Fécamp offshore wind farm), and the
   national view (B-011 to B-015).
5. **Step 4 — All regions:** landmarks and plants for the 12 regions, idle tour
   (B-016 to B-017).
6. **Step 5 — Weather, seasons and learning layer:** weather effects, seasons,
   legend, captions, screensaver mode (B-018 to B-022).

## 9. Growth

The feature funnel: ideas land here first, then graduate to `docs/BACKLOG.md`.

| Id    | Idea                                                                                   | Status   |
| ----- | -------------------------------------------------------------------------------------- | -------- |
| G-001 | Département-level zoom, below regions                                                  | proposed |
| G-002 | Physical flows between regions and with neighbouring countries, drawn as moving pulses | proposed |
| G-003 | Plant-by-plant production (RTE "production par groupe") for the large units            | proposed |
| G-004 | CO₂ intensity of the area as a subtle tint of the sky or a smog layer                  | proposed |
| G-005 | Ambient sound (wind, rain, a hum that follows consumption), muted by default           | proposed |
| G-006 | A "day in a minute" replay of today's data                                             | proposed |
| G-007 | Offshore wind farms drawn at sea (Saint-Nazaire, Fécamp, Saint-Brieuc…)                | done     |
| G-008 | Pumped-storage plants (STEP) pumping water uphill at night, from the `pompage` figure  | proposed |
| G-009 | Installable PWA, and a real OS screensaver wrapper                                     | proposed |
| G-010 | Seasonal touches (snow on the Alps in winter, vineyards in autumn colours)             | planned  |
| G-011 | A modern visual theme (smooth, layered), chosen by the user (Guillaume, 2026-11-12)    | proposed |
| G-012 | Relief of the neighbouring countries, so the Alps do not end in a cliff at the border  | planned  |
| G-013 | A soak of 4 hours or more, in one stretch (Guillaume, 2026-11-12; B-013 ran 2 hours)   | proposed |
| G-014 | Warm water shimmering on the sea off the coastal nuclear plants (PRD Q-16, Q-20)       | proposed |

## 10. Open questions

Each with a recommendation; answers are recorded here with their date, and the
decisions they make are logged in [`DECISIONS.md`](DECISIONS.md).

| Id   | Question                                                        | Recommendation                                                                                       | Answer                                                                |
| ---- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Q-1  | Art direction: isometric map (A) or side panorama (B)?          | A, because the France ↔ region zoom needs a real map                                                 | A; mockups validated (Guillaume, 2026-11-11, D-019)                   |
| Q-2  | Docs and code in English (like Return of the Runners)?          | Yes; the app itself defaults to French                                                               | Yes (Guillaume, 2026-11-11)                                           |
| Q-3  | Licence: GPL-3.0-or-later code, CC BY-SA 4.0 art?               | Yes, same as Return of the Runners (already in `LICENSE`)                                            | Yes (Guillaume, 2026-11-11)                                           |
| Q-4  | Landmarks: only public-domain works, tower lit without sparkle? | Yes (§6); recent works such as the Viaduc de Millau are left out                                     | Yes, and trace each decision (Guillaume, 2026-11-11)                  |
| Q-5  | First region for step 3?                                        | Normandie: coast, cliffs, a port, three nuclear sites, offshore wind; it exercises the most features | Normandie, Seine-Maritime first (Guillaume, 2026-11-11)               |
| Q-6  | Idle tour rhythm                                                | Stay on the home region; every 5 minutes, a 1-minute flight elsewhere                                | Yes, plus a home button and a tour off switch (Guillaume, 2026-11-11) |
| Q-7  | Frame rate cap                                                  | 30 fps: pixel art barely gains from more, and it halves the battery cost                             | Yes (Guillaume, 2026-11-11)                                           |
| Q-8  | Mockups: true isometric (map turned 45°) or north up?           | North up: France stays recognisable at a glance, from afar                                           | North up (Guillaume, 2026-11-11)                                      |
| Q-9  | Region level: 4 km cells, or a finer 1 km relief?               | 1 km: at 4 km a region looks blocky (Normandie mockups)                                              | 1 km (Guillaume, 2026-11-11)                                          |
| Q-10 | 1 km terrain: cliffs at 250 m drops only, shading over 4 km?    | Yes: every 100 m step drew a dark line on the plains (D-022, step-3 screenshots)                     | Yes (Guillaume, 2026-11-12, D-023)                                    |
| Q-11 | Relief abroad, so border mountains do not end in a cliff?       | Yes, after Normandie (B-015): a GO source in DATA-SOURCES first (G-012)                              | Yes, after B-015 (Guillaume, 2026-11-12, D-023)                       |
| Q-12 | On load: show France for 1.5 s, then fly to the region?         | Yes: it says where the region is, and it is short                                                    | Yes (Guillaume, 2026-11-12, D-023)                                    |
| Q-13 | Double-click: zoom ×2 there, or fly to the region clicked?      | Zoom ×2 there: it works at every zoom; a region is one pick in the list away                         | Zoom ×2 there (Guillaume, 2026-11-12, D-023)                          |
| Q-14 | Cooling towers at the 11 sites listed (from memory)?            | Yes until a source says otherwise; Tricastin, Saint-Alban, Blayais and the coast have none           | Yes; offshore wind too, Fécamp first (Guillaume, 2026-11-12, D-027)   |
| Q-15 | Plants at their commune's town hall, a few km off?              | Yes for now: the registry has no coordinates; exact sites with B-017 if a shift shows                | Yes (Guillaume, 2026-11-12, D-027)                                    |
| Q-16 | Nuclear plants without towers: only lit windows at night?       | Yes; a warm-water shimmer on the sea in front can come with Normandie (B-015)                        | Yes (Guillaume, 2026-11-12, D-027)                                    |
| Q-17 | Moving camera: accept ~20 ms frames, or add a 2 km layer?       | Accept: smooth at 30 fps, seconds at a time; a 2 km layer changes the picture (D-028)                | Accept (Guillaume, 2026-11-12, D-028)                                 |
| Q-18 | Towns: communes of 2 000+, drawn at 4 000 people per km²?       | Yes: true sizes, one rule for both views; INSEE urban units later if blobs read badly (D-031)        |                                                                       |
| Q-19 | Offshore farms turned by their region's wind load factor?       | Yes: RTE splits onshore and offshore nationally only; revisit if a regional figure comes             |                                                                       |
| Q-20 | Warm-water shimmer off Paluel, Penly, Flamanville now?          | Later (G-014): which side the sea lies needs data per site; lit windows suffice for now              |                                                                       |
| Q-21 | Sites with no BD TOPO zone stay at their town hall?             | Yes: 131 of 307, mostly biomass (52) and wind (40) farms; B-017 can revisit                          |                                                                       |
| Q-22 | Étretat, the cranes, the lighthouse: do they read as such?      | Yes at a region's scale (about 2 px per km); refine with B-016 if one does not                       |                                                                       |
