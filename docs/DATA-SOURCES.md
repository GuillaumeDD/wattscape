# Data sources

The register of open data considered for Wattscape: for each source, its licence and
terms, whether we use it (**GO**), reject it (**NO-GO**) or have not decided yet
(**TO CHECK**), and why. It exists so that every use of third-party data can be
audited and revisited. How a source is used (fields, caveats) is in ARCHITECTURE §
Data sources; where its facts come from is in `docs/SOURCES.md`.

## Rules

- A source is used in code only when it is **GO**.
- **GO** needs: an open licence compatible with a public GPL project and CC BY-SA art
  (Licence Ouverte / Etalab 2.0, CC0, CC BY, ODbL for data we do not redistribute),
  terms that a free, non-commercial, keyless static site can respect (rate limits,
  attribution), and no privacy cost beyond ARCHITECTURE § Privacy.
- The **attribution** each licence asks for is shown in the app's credits and in the
  README, with the source's name and the date of the data shown.
- Data **baked into the repository** (map, capacities, fixtures) also gets an
  `ASSETS.md` entry; a licence that would force a different licence on the repo
  (e.g. share-alike on a database) is a reason for NO-GO unless the data stays
  outside the repo.
- A decision changes only through a new dated comment in its row, never a silent
  edit.

> 💡 **Licence Ouverte / Etalab 2.0** is the French government's open licence: data
> can be reused for any purpose, including commercially, as long as the source and
> the date of its last update are cited. It is compatible with CC BY.

## Register

| Id    | Source                                                      | Used for                                | Licence and terms                                                                     | Decision | Comment                                                                                                         | Decided              |
| ----- | ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| DS-01 | RTE éCO2mix regional real time, via ODRÉ (S-003, S-004)     | Regional mix, live                      | Licence Ouverte 2.0; cite "RTE éCO2mix" and the reading time; 50 000 calls/user/month | GO       | The core of the project; keyless. 2026-11-11: licence and CORS (`*`) confirmed on the API (S-003)               | proposed, to confirm |
| DS-02 | RTE éCO2mix national real time, via ODRÉ (S-009)            | National view, live                     | Licence Ouverte 2.0 (S-009)                                                           | GO       | Same publisher and API as DS-01. 2026-11-11: licence and CORS (`*`) confirmed on the API (S-009)                | proposed, to confirm |
| DS-03 | Open-Meteo forecast API (S-005)                             | Current weather, snow depth             | CC BY 4.0; free tier non-commercial only; < 10 000 calls/day per IP                   | GO       | Keyless; non-commercial (no ads, no subscription); credits on the page. 2026-11-11: CORS `*`, quota checked     | proposed, to confirm |
| DS-04 | IGN ADMIN EXPRESS (regions, départements)                   | Baked map: region shapes                | Licence Ouverte 2.0 (to confirm)                                                      | TO CHECK | Preferred for the map (B-008): official, open, no share-alike                                                   |                      |
| DS-05 | A coarse elevation model (e.g. IGN BD ALTI, Copernicus DEM) | Baked map: relief                       | to check per candidate                                                                | TO CHECK | Needed for mountains and the Alps' snow line; pick in B-008                                                     |                      |
| DS-06 | OpenStreetMap                                               | Coastline, towns, plant locations       | ODbL: share-alike on derived databases                                                | TO CHECK | Rich but share-alike: acceptable only for facts we look up, not for a database baked into the repo              |                      |
| DS-07 | ODRÉ « Registre national des installations de production »  | Installed capacity by region and source | Licence Ouverte 2.0 (to confirm)                                                      | TO CHECK | For placing diffuse sources (World generation); baked at build time                                             |                      |
| DS-08 | RTE production per unit ("production par groupe")           | Plant-by-plant output (Growth G-003)    | to check                                                                              | TO CHECK | Later; delay and terms to check                                                                                 |                      |
| DS-09 | Electricity Maps API (S-001)                                | —                                       | API key required; commercial terms                                                    | NO-GO    | Inspiration only: needs a key (a secret in a static site) and duplicates éCO2mix for France                     | proposed, to confirm |
| DS-10 | geo.api.gouv.fr (reverse geocoding)                         | Position → région                       | Licence Ouverte 2.0                                                                   | NO-GO    | Would send the user's exact position to a third party; the lookup runs offline instead (ARCHITECTURE § Privacy) | proposed, to confirm |

"proposed, to confirm" means Claude proposed the decision; it becomes final when
Guillaume confirms it, and the cell then reads "Guillaume, date".
