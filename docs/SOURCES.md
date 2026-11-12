# Sources

Every external source consulted for Wattscape, with what it gave us. Facts taken from
a source are recorded where they are used (mostly `ARCHITECTURE.md`), citing the
source's id here. Add a source the day it is consulted, even when it turns out to be
useless, so nobody looks it up twice.

**Reliability** is how far a fact from the source can be trusted: **high** (the
publisher documents its own data or API), **medium** (a secondary page, or a summary
of the primary one), **low** (general knowledge, to be checked).

**How consulted:** the default cloud environment cannot open ODRÉ, Open-Meteo or
geo.api.gouv.fr (HTTP 403 from the session proxy, 2026-11-11); the `wattscape`
environment reaches ODRÉ and Open-Meteo directly, and IGN's servers (data.geopf.fr,
geoservices.ign.fr) since 2026-11-11; dataspace.copernicus.eu stays unreachable.
Pages marked "summary" were read through a fetch tool that returns a summary, not the
raw page: re-read them in a browser before relying on an exact wording.

| Id    | Source                                                                                                                                                                                            | What it gives                                                                                                                                                                                                                                       | Reliability         | Consulted  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- |
| S-001 | [Electricity Maps, live map](https://app.electricitymaps.com/map/fifteen_minutes)                                                                                                                 | Inspiration (Guillaume): the grid made visible, per zone and per source                                                                                                                                                                             | n/a (inspiration)   | 2026-11-11 |
| S-002 | [Infinite Jungle](https://mo.town/jungle/index.html), [source](https://github.com/0xfe/jungle) (MIT)                                                                                              | Inspiration (Guillaume): endless isometric pixel art, static site, no runtime dependency, headless RGBA renderer, seeded worlds, zoom 65–250 %, idle drift                                                                                          | high (its README)   | 2026-11-11 |
| S-003 | [ODRÉ, dataset `eco2mix-regional-tr`](https://odre.opendatasoft.com/explore/dataset/eco2mix-regional-tr/)                                                                                         | API answers and metadata: field names, types, descriptions (sign of `ech_physiques`), Licence Ouverte v2.0, publisher RTE, 12 regions, CORS and rate-limit headers; recorded in `tests/fixtures/eco2mix/`                                           | high                | 2026-11-11 |
| S-004 | [data.gouv.fr, « Données éCO2mix régionales temps réel »](https://www.data.gouv.fr/datasets/donnees-eco2mix-regionales-temps-reel-1)                                                              | Licence Ouverte 2.0; producer RTE, served by ODRÉ; hourly refresh of 15-minute steps; month M replaced by consolidated data mid-M+1; quota 50 000 calls/user/month                                                                                  | medium (summary)    | 2026-11-11 |
| S-005 | [Open-Meteo, Terms](https://open-meteo.com/en/terms)                                                                                                                                              | Free API for non-commercial use only; < 10 000 calls/day, 5 000/hour, 600/minute per IP; data CC BY 4.0; no API key                                                                                                                                 | high (summary)      | 2026-11-11 |
| S-006 | Coordinates of the French prefectures                                                                                                                                                             | Lat/lon of the 96 prefectures (2 decimals), from general knowledge; each checked inside its département and region against S-011 (2026-11-11)                                                                                                       | medium (2 decimals) | 2026-11-11 |
| S-007 | [RTE, « Eco2mix – Spécifications des fichiers en puissance » (PDF)](https://assets.rte-france.com/preprod/public/2025-06/Eco2mix%20-%20Sp%C3%A9cifications%20des%20fichiers%20en%20puissance.pdf) | Columns of the regional real-time file (MW, 15-minute steps), TCO/TCH (coverage rate, load factor) per source, "ND" / "-" / "DC" markers, battery and wind-split columns not available regionally; no sign convention for exchanges; Corsica absent | high (summary)      | 2026-11-11 |
| S-008 | [NOAA Global Monitoring Laboratory, Solar Calculator](https://gml.noaa.gov/grad/solcalc/)                                                                                                         | Its JavaScript (`main.js`): sun position equations (Meeus) and refraction fit, transcribed in `tests/noaa-reference.ts` to check `src/sky/sun.ts`; public domain (US government)                                                                    | high                | 2026-11-11 |
| S-009 | [data.gouv.fr, « Données éCO2mix nationales temps réel »](https://www.data.gouv.fr/datasets/donnees-eco2mix-nationales-temps-reel-1)                                                              | Licence Ouverte v2.0, publisher RTE; its API (ODRÉ `eco2mix-national-tr`): field names, types, descriptions, no `tch_*` column; recorded in `tests/fixtures/eco2mix/`                                                                               | high                | 2026-11-11 |
| S-010 | Open-Meteo on GitHub: website [weather code table][s010-codes] and [docs page][s010-docs]; API [`WeatherCode.swift`][s010-enum]                                                                   | Weather codes the API sends and their meaning (97 is in the docs, not the enum); unit and meaning of each `current` field; error shape. open-meteo.com is blocked in the cloud sessions                                                             | high                | 2026-11-11 |
| S-011 | [france-geojson](https://github.com/gregoiredavid/france-geojson), from IGN ADMIN EXPRESS                                                                                                         | Outlines of départements and regions (2018), read by `tools/check-regions.ts` to check S-006 and measure the lookup until 2026-11-11, then replaced by S-013; never committed; Licence Ouverte                                                      | medium              | 2026-11-11 |
| S-012 | [Astronomy Engine](https://github.com/cosinekitty/astronomy) 2.1.19 (MIT), on npm                                                                                                                 | Reference sun positions and moon quarters for the tests (`tools/record-sky.ts`); tested by its author against JPL Horizons (README); not a dependency                                                                                               | high                | 2026-11-11 |
| S-013 | [IGN Géoplateforme WFS][s013-wfs], layers `ADMINEXPRESS-COG-CARTO.LATEST:region` and `ADMINEXPRESS-COG.LATEST:*`; [metadata record][s013-csw]                                                     | Region outlines (generalised, baked by `tools/bake-map.ts`; full precision, read by `tools/check-regions.ts`); licence "Licence Ouverte / Open License" in the metadata record (dated 2026-10-19); never committed raw                              | high                | 2026-11-11 |
| S-014 | [IGN Géoplateforme WMS][s014-wms], layer `ELEVATION.ELEVATIONGRIDCOVERAGE` ("MNT BDAlti V1", 25 m); [metadata record][s014-csw]                                                                   | Altitudes as raw 32-bit floats (`image/x-bil;bits=32`), −99 999 outside France (sea, abroad), read by `tools/bake-map.ts`; licence "Licence Ouverte / Open License" in the metadata                                                                 | high                | 2026-11-11 |
| S-015 | [Natural Earth vector][s015-repo], `ne_10m_admin_0_countries.geojson` at commit `ca96624a56bd`, and its `LICENSE.md`                                                                              | Countries at 1:10m, read by `tools/bake-map.ts` for the land around France; "Everything here is public domain", crediting "unnecessary"                                                                                                             | high                | 2026-11-11 |

Re-read on 2026-11-12: S-013, S-014 and S-015, by `tools/bake-map.ts`, to bake the
1 km relief (D-021) with the same requests; the regions and the 4 km grid came out
unchanged, cell for cell. The same day, S-013's layer
`ADMINEXPRESS-COG.LATEST:chef_lieu_de_commune` (the chef-lieu of each commune, by
INSEE code) gave `tools/bake-plants.ts` where to place each plant (D-024); and S-003
gave the latest steps of every region in one request (the 12 regions publish each
step together: 12 rows a step, checked at 09:45 and 01:00 UTC), recorded as `tests/fixtures/eco2mix/2026-11-12-all-regions*`.

Consulted on 2026-11-12, **S-016**: [ODRÉ, dataset
`registre-national-installation-production-stockage-electricite-agrege-311224`][s016]
(« Registre national des installations de production et de stockage d'électricité
(au 31/12/2024) »), its API and metadata. Gave: licence "Licence Ouverte v2.0
(Etalab)"; 101 097 rows, one per unit of 36 kW or more and one per commune for the
smaller ones; fields `codefiliere` (NUCLE, THERM, EOLIE, SOLAI, HYDLQ, BIOEN…),
`technologie` ("En mer posé" for offshore wind), `puismaxinstallee` (kW), `regime`
("En service"), `coderegion` and the INSEE code of the commune
(`codeinseecommuneimplantation`). 2 318 units in service of 10 MW or more; Paluel is
4 × 1 330 MW. For an offshore farm the commune is where it lands on the grid
(Saint-Brieuc's farm under Hénansal), not the farm. Reliability high (the publisher
documents its own data). Also tried: fr.wikipedia.org, for how each nuclear site is
cooled; out of the session's network reach, so the list of sites with cooling
towers is from general knowledge (low) until checked (PRD Q-14).

[s010-codes]: https://github.com/open-meteo/open-meteo-website/blob/8fbb311caa9d9f72d5bb127a7e0303e28bdfa62f/src/lib/components/variables/wmo-codes-table.svelte
[s010-docs]: https://github.com/open-meteo/open-meteo-website/blob/8fbb311caa9d9f72d5bb127a7e0303e28bdfa62f/src/routes/en/docs/%2Bpage.svelte
[s010-enum]: https://github.com/open-meteo/open-meteo/blob/954c561b9868d81a28bfc280a971c13474ea3191/Sources/App/Helper/WeatherCode.swift
[s013-wfs]: https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities
[s013-csw]: https://data.geopf.fr/csw?REQUEST=GetRecordById&SERVICE=CSW&VERSION=2.0.2&OUTPUTSCHEMA=http://standards.iso.org/iso/19115/-3/mdb/2.0&elementSetName=full&ID=IGNF_ADMIN-EXPRESS
[s014-wms]: https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0
[s014-csw]: https://data.geopf.fr/csw?REQUEST=GetRecordById&SERVICE=CSW&VERSION=2.0.2&OUTPUTSCHEMA=http://standards.iso.org/iso/19115/-3/mdb/2.0&elementSetName=full&ID=IGNF_BD-ALTI
[s016]: https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege-311224/
[s015-repo]: https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19
