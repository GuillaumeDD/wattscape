# Plant placement

The register of what is known to be wrong, doubtful or left out in where the power
plants stand on the map, so that the placement can be improved bit by bit
(Guillaume, 2026-11-13, D-037). It lists open points and how each was closed; it
does not repeat the rules.

- **The rules** (which sites are kept, the order of places a site is tried at) are
  in ARCHITECTURE § Map, "Plant sites". Why each rule was chosen is in
  `docs/DECISIONS.md`: D-024 (sites from the registry), D-027 (town hall, cooling
  towers), D-032 (BD TOPO zones, offshore farms), D-036 (name match, dams).
- **The places themselves** are baked into `src/map/plants.ts` by
  `tools/bake-plants.ts`. A site's `exact` field says whether BD TOPO placed it.

## How to use it

- A point is added when a plant is seen in the wrong place, when a rule is known to
  guess, or when a site is left out. It gets the next id.
- **OPEN**: nothing decided. **WAIT**: decided to leave it, the comment says until
  what. **DONE**: fixed, the comment says by which commit or decision.
- A row changes only through a new dated comment, never a silent edit.
- A site of 100 MW or more that stands at its town hall has a row here: a test
  checks it (`tests/plants.test.ts`).

## Register

Figures are from the bake of 2026-11-13 (307 sites). "Town hall" means the
chef-lieu of the commune the registry files the site under.

| Id    | Site (commune, source, MW)               | Stands at | Point                                                      | Status | Comment                                                  |
| ----- | ---------------------------------------- | --------- | ---------------------------------------------------------- | ------ | -------------------------------------------------------- |
| PL-01 | Montézic, hydro, 910                     | town hall | Pumped storage; no zone or dam of that name in BD TOPO     | OPEN   | PRD Q-23                                                 |
| PL-02 | Les Mazures, hydro, 808                  | town hall | The Revin pumped storage; BD TOPO names no « Revin »       | OPEN   | PRD Q-23                                                 |
| PL-03 | Sisteron, hydro, 214                     | town hall | No zone or dam of that name within 15 km                   | OPEN   | PRD Q-23                                                 |
| PL-04 | Oraison, hydro, 187                      | town hall | Hydro zones 6 to 8 km away, none named Oraison             | OPEN   | PRD Q-23                                                 |
| PL-05 | Caderousse, hydro, 156                   | town hall | BD TOPO has « usine de caderousse », nature « Usine »      | OPEN   | Lead: match zones of nature « Usine » too (S-018)        |
| PL-06 | Saint-Estève-Janson, hydro, 141          | town hall | No zone or dam of that name within 15 km                   | OPEN   | PRD Q-23                                                 |
| PL-07 | Fos-sur-Mer, thermal, 1 181              | town hall | Five plants summed in one site; none named in BD TOPO      | OPEN   | PRD Q-23; see PL-15                                      |
| PL-08 | Grande-Synthe, thermal, 818              | town hall | « Braek » in the registry; not in BD TOPO                  | OPEN   | PRD Q-23                                                 |
| PL-09 | Landivisiau, thermal, 446                | town hall | « Ponant » in the registry; not in BD TOPO                 | OPEN   | PRD Q-23                                                 |
| PL-10 | Gonfreville-l'Orcher, thermal, 342       | town hall | Three industrial cogenerations summed; none named          | OPEN   | PRD Q-23; see PL-15                                      |
| PL-11 | Abergement-la-Ronce, thermal, 167        | town hall | « Tavaux » in the registry (Solvay's site); not in BD TOPO | OPEN   | PRD Q-23                                                 |
| PL-12 | Saint-Étienne-du-Rouvray, thermal, 132   | town hall | « Chapelle (La) » in the registry; not in BD TOPO          | OPEN   | PRD Q-23                                                 |
| PL-13 | Le Lardin-Saint-Lazare, thermal, 102     | town hall | « Condat-le-Lardin », a paper mill's cogeneration          | OPEN   | PRD Q-23                                                 |
| PL-14 | Gardanne, bioenergy, 150                 | town hall | « Provence » in the registry; no such zone in BD TOPO      | OPEN   | PRD Q-23                                                 |
| PL-15 | Every site                               | —         | A site sums a commune's units: several plants, one place   | OPEN   | Brommat's site stands at Sarrans's dam (its other plant) |
| PL-16 | Morchies, wind, 154; Jametz, solar, 110  | town hall | Wind and solar are not matched by name (D-036)             | WAIT   | Farms are spread out: revisit with B-017's diffuse part  |
| PL-17 | 40 wind, 12 solar, 52 bioenergy sites    | town hall | No BD TOPO zone of their kind in their commune             | WAIT   | Guillaume, 2026-11-13: stay (PRD Q-21, D-034)            |
| PL-18 | Laruns, hydro, 199                       | BD TOPO   | Moved 6 km onto « Miégebat » by its name: right plant?     | OPEN   | The largest move of D-036; check on screen               |
| PL-19 | The 11 nuclear sites with cooling towers | BD TOPO   | The list is from general knowledge, with no source         | OPEN   | Confirmed by Guillaume (D-027); a source can now be read |
| PL-20 | Lyon 7e, bioenergy, 10                   | left out  | IGN lists no chef-lieu for the arrondissement              | WAIT   | Small; revisit if arrondissements get a rule             |
| PL-21 | Mont Lozère et Goulet, wind              | left out  | Its town hall is 5 km or more out of its region            | WAIT   | Revisit with the map's next bake                         |
| PL-22 | Faraman, floating offshore wind, 25      | left out  | Its turbines are not in BD TOPO yet                        | WAIT   | Re-check at the next bake (D-032)                        |
| PL-23 | Calvados, Dieppe - Le Tréport, offshore  | left out  | « En construction » at the registry's date (31/12/2024)    | WAIT   | Re-bake with the next registry (D-032)                   |
| PL-24 | Hydro sites placed at a dam (7)          | BD TOPO   | The powerhouse can stand below the dam, not on it          | OPEN   | Fine at 1 km per cell so far; check Génissiat, L'Aigle   |
