# Sources

Everything Wattscape takes from outside, in two parts:

1. the **[data register](#1-data-register)**: for each open dataset considered, its
   licence and whether we use it (ids `DS-`);
2. the **[consultation log](#2-consultation-log)**: every external source read (a
   dataset page, an API doc, a spec, a photo, a person), with what it gave us (ids
   `S-`).

A dataset is decided in part 1 and its facts are traced in part 2: a `DS-` row cites
the `S-` entries it rests on (D-038).

## 1. Data register

For each source of open data, its licence and terms, whether we use it (**GO**),
reject it (**NO-GO**) or have not decided yet (**TO CHECK**), and why. It exists so
that every use of third-party data can be audited and revisited. How a source is
used (fields, caveats) is in ARCHITECTURE § Data sources.

### Rules

- A source is used in code only when it is **GO**.
- **GO** needs: an open licence compatible with a public GPL project and CC BY-SA art
  (Licence Ouverte / Etalab 2.0, CC0, CC BY, ODbL for data we do not redistribute),
  terms that a free, non-commercial, keyless static site can respect (rate limits,
  attribution), and no privacy cost beyond ARCHITECTURE § Privacy.
- The **attribution** each licence asks for is shown in the app's credits and in the
  README, with the source's name and the date of the data shown. Setting a source
  to **GO** for code adds, in the same PR, its credit in both languages and its
  README line, and adds the product to the list `tests/i18n.test.ts` checks the
  credits against.
- Data **baked into the repository** (map, capacities, fixtures) also gets an
  `ASSETS.md` entry; a licence that would force a different licence on the repo
  (e.g. share-alike on a database) is a reason for NO-GO unless the data stays
  outside the repo.
- A decision changes only through a new dated comment in its row, never a silent
  edit.

> 💡 **Licence Ouverte / Etalab 2.0** is the French government's open licence: data
> can be reused for any purpose, including commercially, as long as the source and
> the date of its last update are cited. It is compatible with CC BY.

### Register

| Id    | Source                                                      | Used for                                | Licence and terms                                                                     | Decision | Comment                                                                                                         | Decided              |
| ----- | ----------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| DS-01 | RTE éCO2mix regional real time, via ODRÉ (S-003, S-004)     | Regional mix, live                      | Licence Ouverte 2.0; cite "RTE éCO2mix" and the reading time; 50 000 calls/user/month | GO       | The core of the project; keyless. 2026-11-11: licence and CORS (`*`) confirmed on the API (S-003)               | Guillaume 2026-11-11 |
| DS-02 | RTE éCO2mix national real time, via ODRÉ (S-009)            | National view, live                     | Licence Ouverte 2.0 (S-009)                                                           | GO       | Same publisher and API as DS-01. 2026-11-11: licence and CORS (`*`) confirmed on the API (S-009)                | Guillaume 2026-11-11 |
| DS-03 | Open-Meteo forecast API (S-005)                             | Current weather, snow depth             | CC BY 4.0; free tier non-commercial only; < 10 000 calls/day per IP                   | GO       | Keyless; non-commercial (no ads, no subscription); credits on the page. 2026-11-11: CORS `*`, quota checked     | Guillaume 2026-11-11 |
| DS-04 | IGN ADMIN EXPRESS COG CARTO, regions (S-013)                | Baked map: regions; chef-lieux, towns   | Licence Ouverte 2.0 (S-013)                                                           | GO       | Official, open, no share-alike. 2026-11-11: licence read in IGN's metadata; baked in B-008 (D-014)              | Guillaume 2026-11-11 |
| DS-05 | IGN BD ALTI 25 m, national elevation model, via WMS (S-014) | Baked map: relief                       | Licence Ouverte 2.0 (S-014)                                                           | GO       | 2026-11-11: chosen over Copernicus DEM, whose licence could not be read (D-014); France only                    | Guillaume 2026-11-11 |
| DS-06 | OpenStreetMap                                               | Coastline, towns, plant locations       | ODbL: share-alike on derived databases                                                | TO CHECK | Rich but share-alike: acceptable only for facts we look up, not for a database baked into the repo              |                      |
| DS-07 | ODRÉ « Registre national des installations de production »  | Installed capacity by region and source | Licence Ouverte 2.0 (to confirm)                                                      | GO       | For placing diffuse sources (World generation); baked at build time; 2026-11-12: GO, licence in API (S-016)     | Guillaume 2026-11-12 |
| DS-08 | RTE production per unit ("production par groupe")           | Plant-by-plant output (Growth G-003)    | to check                                                                              | TO CHECK | Later; delay and terms to check                                                                                 |                      |
| DS-09 | Electricity Maps API (S-001)                                | —                                       | API key required; commercial terms                                                    | NO-GO    | Inspiration only: needs a key (a secret in a static site) and duplicates éCO2mix for France                     | proposed, to confirm |
| DS-10 | geo.api.gouv.fr (reverse geocoding)                         | Position → région                       | Licence Ouverte 2.0                                                                   | NO-GO    | Would send the user's exact position to a third party; the lookup runs offline instead (ARCHITECTURE § Privacy) | proposed, to confirm |
| DS-11 | Natural Earth, admin-0 countries 1:10m (S-015)              | Baked map: neighbouring countries       | Public domain; credit welcome, not required (S-015)                                   | GO       | 2026-11-11: the land around France, so that it does not float alone; pinned commit (D-014)                      | Guillaume 2026-11-11 |
| DS-12 | RTE éCO2mix regional consolidated, via ODRÉ (S-017)         | Baked ranges of consumption (B-014)     | Licence Ouverte 2.0 (S-017)                                                           | GO       | Same publisher and licence as DS-01; 12 months baked into the repo (p5, p95 per region)                         | Guillaume 2026-11-12 |
| DS-13 | IGN BD TOPO, via WFS (S-018)                                | Baked: plants, offshore wind, rivers    | Licence Ouverte 2.0 (IGN metadata IGNF_BD-TOPO)                                       | GO       | Real places of plants and offshore farms (B-015, G-007); rivers (B-023, D-040); baked, never fetched            | Guillaume 2026-11-12 |

"proposed, to confirm" means Claude proposed the decision; it becomes final when
Guillaume confirms it, and the cell then reads "Guillaume date".

## 2. Consultation log

Every external source consulted, with what it gave us. Facts taken from a source are
recorded where they are used (mostly `ARCHITECTURE.md`), citing the source's id
here. Add a source the day it is consulted, even when it turns out to be useless, so
nobody looks it up twice.

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
(Saint-Brieuc's farm under Hénansal), not the farm. Read again on 2026-11-13 for
B-017 (D-041): the API sums `puismaxinstallee` per region and commune
(`group_by`: 1 421 rows for wind, 17 427 for solar, 1 062 for bioenergy, the whole
registry); in service on land in the 12 regions, 23 570 MW of wind, 19 617 MW of
solar and 2 545 MW of bioenergy. Reliability high (the publisher
documents its own data). Also tried: fr.wikipedia.org, for how each nuclear site is
cooled; out of the session's network reach, so the list of sites with cooling
towers is from general knowledge (low) until checked (PRD Q-14); Guillaume confirmed
it the same day (D-027).

Consulted on 2026-11-12, **S-017**: [ODRÉ, dataset `eco2mix-regional-cons-def`][s017]
(« Données éCO2mix régionales consolidées et définitives »), its API and metadata.
Gave: publisher RTE, licence "Licence Ouverte v2.0 (Etalab)", 2 874 816 rows, one
per region and half-hour from 2012-12-31T23:30Z to 2026-08-31T21:30Z (consolidated
then definitive figures; the real-time dataset S-003 takes over from 2026-09-01,
which is as far back as it goes); field `consommation` (MW), the same as in S-003.
ODSQL computes `percentile(consommation, 5)` and `95` per `code_insee_region` in one
request, read by `tools/bake-consumption.ts` (B-014). Reliability high (the
publisher documents its own data).

Re-read on 2026-11-12, S-003, through its export endpoint
(`…/eco2mix-regional-tr/exports/json`): it takes the same `where` and `order_by` as
`records`, is not capped at 100 rows, and answers a bare array of the same rows
(CORS `*`). A day of every region: 98 steps of 12 rows, 833 KB, 116 KB compressed;
recorded for three hours as `tests/fixtures/eco2mix/2026-11-12-history-3h.json`
(B-014).

Re-read on 2026-11-12, S-013, layer `ADMINEXPRESS-COG.LATEST:commune` with its
chef-lieux, by `tools/bake-towns.ts` (B-015, D-031): fields `population` (INSEE,
`organisme_recenseur`), `date_du_recensement` (2023-01-01 for 5 346 of the 5 397
metropolitan communes of 2 000 inhabitants or more, 2022-01-01 for 51) and
`superficie_cadastrale` (hectares: Le Havre 4 700, 166 687 inhabitants; Paris 10 540,
2 103 778). The WFS answers at most 5 000 features a request: the bake pages with
`STARTINDEX`.

Consulted on 2026-11-12, **S-018**: [IGN's metadata record for the BD TOPO][s018-csw]
(`IGNF_BD-TOPO`, version 3.5) and its Géoplateforme WFS (the layers dated
2026-09-15). Gave: licence "Licence Ouverte / Open License"; the WFS layers
`BDTOPO_V3:zone_d_activite_ou_d_interet` (nature « Centrale électrique », e.g.
« Centrale Électrique de Paluel »; « Parc Éolien en Mer de Fécamp », of Saint-Nazaire,
of Dieppe - le Tréport) and `BDTOPO_V3:construction_ponctuelle` (nature « Eolienne »,
11 090 turbines), DS-13, GO the same day (Guillaume, on a decision card).
Read by `tools/bake-plants.ts` (D-032): 4 361 zones « Centrale électrique » in
service (nuclear plants have no `nature_detaillee`), and the turbines at sea of the
Fécamp (72), Saint-Nazaire (80) and Saint-Brieuc (62) farms; the Calvados and
Dieppe - Le Tréport farms' turbines are « En construction ». The landmarks of
`src/map/landmarks.ts` (B-015): « Porte d'Aval » (a cape, `detail_orographique`,
49.70687° N, 0.19387° E) and « l'Aiguille » 100 m west; Port 2000
(`equipement_de_transport`, centre 49.46024° N, 0.14785° E); Fécamp's « Avant-Port »
(centre 49.76154° N, 0.36808° E). Read again on 2026-11-13 for B-017 (D-036): the
names of the zones (« Centrale Électrique de la Bâthie », « Usine Hydroélectrique de
Rhinau », « Centrale Thermique de Montereau ») and the dams of
`BDTOPO_V3:construction_surfacique` (145 named, in service) and
`construction_lineaire` (439), nature « Barrage », e.g. « Barrage de Génissiat »
(46.0521° N, 5.8127° E in `BDTOPO_V3:toponymie`). No zone or dam names Montézic,
Revin, Sisteron, Oraison, Caderousse, Saint-Estève, nor the thermal plants of Fos-sur-Mer,
Grande-Synthe (« Braek »), Landivisiau, Tavaux, Gonfreville, Condat, La Chapelle-Darblay or
Gardanne. Read again on 2026-11-13 for B-023 (D-039), by `tools/bake-rivers.ts`: the
layer `BDTOPO_V3:cours_d_eau` (155 748 watercourses, each a name and its lines, the
side arms included); 647 of them are longer than 0.5° in the map's box
(`geomLength`), in pages of 200 (about 25 MB each). A long river comes as several
watercourses (« la Loire », « Fleuve la Loire »; « la Moselle » and « la
Moselle Canalisée »); canals and aqueducts are in the same layer (« Canal du Midi »,
« Aqueduc de la Vanne »); the attribute `importance` does not rank the rivers
usably.
Reliability high (the
national mapping agency documents its own data).

Consulted on 2026-11-13, **S-019**: [Wikidata][s019], through its API
(`wbsearchentities`, `wbgetentities`), for `docs/POI.md` (B-016, D-042): the
architects it gives a monument (property P84 and the like) and each person's date of
death (P570). Gave, by item: Saint-Joseph church of Le Havre (Q588555): Auguste
Perret, d. 1954-02-25; its creator Marguerite Huré, d. 1967-10-27. Palais
Bénédictine (Q3360832): Camille Albert, d. 1942. Eiffel Tower (Q243): Stéphen
Sauvestre, d. 1919-06-18; Émile Nouguier, d. 1897-11-13; Maurice Koechlin, d. 1946
(three dates given, all in 1946); Gustave Eiffel (Q20882), d. 1923-12-27. Sacré-Cœur
(Q28785): Paul Abadie, d. 1884. Arc de Triomphe (Q64436): Chalgrin, d. 1811-01-21;
Goust, d. 1838; Huyot, d. 1840; Blouet, d. 1853. Belfry of Lille's town hall
(Q1996107): Émile Dubuisson, d. 1947-08-06. Fourvière (Q1516): Pierre Bossan,
d. 1888-07-23; Louis Sainte-Marie-Perrin, d. 1917-07-20. Notre-Dame de la Garde
(Q975925): Henri-Jacques Espérandieu, d. 1874-11-11; Henri Révoil, d. 1900-03-20.
Fort Boyard (Q92089): begun in 1801, by the military engineers. Persons searched by
name: Bodo Ebhardt (Q85804), d. 1945-02-13; Viollet-le-Duc (Q272912), d. 1879;
Paul Boeswillwald (Q3370673), d. 1931-07-17; Victor Petitgrand (Q29982577),
d. 1898-02-23; Emmanuel Frémiet (Q499022), d. 1910-09-10; Lucien Magne (Q1873405),
d. 1916-07-25; Honoré Daumet (Q3140221), d. 1911-12-12; Charles Laisné (Q2959551),
d. 1891-01-14; Raymond Audigier (Q136674857), d. 1987-03-29; Jacques Gabriel
(Q3158954), d. 1742-04-23; Ange-Jacques Gabriel (Q352451), d. 1782-01-04; Vauban
(Q192839), d. 1707-03-30; Louis Sauvageot (Q3263095), d. 1908-01-14; Eugène-Louis
Lequesne (Q2719726), d. 1887-06-03. Not found: Jean-Louis Hulot, Henri Rauline. It
gives no architect for Haut-Kœnigsbourg, the Cité de Carcassonne or the abbey of
Mont-Saint-Michel: who restored them is still from general knowledge. The API
limits the rate (HTTP 429): one request every 6 s passed. Reliability medium (a
community database; a date of death there is rarely wrong, an attribution can be
incomplete). Used as a reference only, nothing baked: no row in § 1.

Consulted on 2026-11-14, **S-020**: [Wikidata][s019] again, the same way, for the
landmarks Guillaume proposed (`docs/POI.md` P-039 to P-042, D-043). Gave, by item:
Pont de Tancarville (Q2351952): 1959; its engineers Nicolas Esquillan (Q3340298),
d. 1989-01-21, and Jacques Ramsay-Robinson (Q110774883), d. 1988-07-12. Pont de
Brotonne (Q734387): 1977; its engineer Jean Muller (Q1685711), d. 2005-03-17. Pont
de Normandie (Q504710): Michel Virlogeux, born 1946, and Bernard Raspaud, born
1942, no date of death. Pont du Gard (Q189764): about 50 AD. Rouen cathedral
(Q476516): begun in 1030; Mérimée ids PA00100800 and IA00021830; no architect
given. Gros-Horloge (Q3116957): « 14th century astronomical clock in Rouen »;
Mérimée id PA00100834. Jean-Antoine Alavoine (Q2402612), searched by name:
d. 1834-11-15; nothing there links him to the cathedral's spire, which is from
general knowledge. Reliability as S-019.

Consulted on 2026-11-14, **S-021**: [Mérimée][s021], the Ministry of Culture's
register of protected monuments, read on POP record by record
(`/notice/merimee/<id>`, ids from Wikidata's P380), for who restored four landmarks
of `docs/POI.md` (PRD Q-28, D-043). Gave: Cité de Carcassonne (PA00102588): author
« Viollet-le-Duc Eugène (architecte) », « très restaurée au 19e siècle par
Viollet-le-Duc ». Haut-Kœnigsbourg (IA00124535, PA00084875): author « Ebhardt Bodo
(architecte) », rebuilt « de 1901 à 1908 »; the painter Léo Schnug for the
interiors, which are not drawn. Rouen cathedral (IA00021830): spire « par Robert
Becquet en 1544, détruite en 1822 ; Alavoine la reconstruit de 1823 à 1884 »;
restorations by Barthélémy and Desmarest (1859 to 1868) and Louis Sauvageot (1894
to 1904), and repairs after the bombings of 1944. The records of the abbey of
Mont-Saint-Michel (PA00110460) and of the Hospices de Beaune (PA00112112) name no
restorer. Gros-Horloge (PA00100834): « horloge publique », listed in 1862.
Reliability high (the State's own register), but a record can be short.

Consulted on 2026-11-14, **S-022**: [French Wikipedia][s022], articles « Abbaye du
Mont-Saint-Michel » and « Hospices de Beaune », through the API (`prop=extracts`),
for the two restorations Mérimée does not name. Gave: the bell tower and spire of
the abbey church « reconstruits par l'architecte Victor Petitgrand […] entre 1892
et 1897 », the archangel made in 1895 by Emmanuel Frémiet; Beaune's glazed tiles
« reconstruites entre 1902 et 1907 par Sauvageot ». Reliability medium (a
community encyclopedia, no primary source read): it agrees with what was assumed,
and both authors died more than 70 years ago (S-019).

Consulted on 2026-11-14, **S-023**: the BD TOPO again (S-018, DS-13), its WFS layer
`BDTOPO_V3:toponymie` filtered by name (`graphie_du_toponyme`) and bounding box, for
the positions of `src/map/landmarks.ts` (B-016, D-045). Gave, as named points (°N,
°E): « abbaye du mont-saint-michel » 48.63612, −1.51132; « tour eiffel »
(Monument) 48.85826, 2.29424; « terrils du 11/19 » (Terril) 50.44558, 2.78259;
« cathédrale notre-dame » in Strasbourg 48.58189, 7.75111; « château de chambord »
47.61608, 1.51718; « hôtel-dieu » in Beaune (Musée) 47.02210, 4.83660; « château
des ducs de bretagne » 47.21613, −1.54930; « alignements du ménec » (Mégalithe)
47.59340, −3.07964; « dune du pilat » (Dune) 44.58875, −1.21572; « pont du gard »
(Vestige archéologique) 43.94739, 4.53511; « notre-dame de fourvière » 45.76223,
4.82252; « notre-dame de la garde » 43.28393, 5.37126; also « mont blanc »
(Sommet) 45.83267, 6.86463, not used. A name alone is ambiguous (15 « mont
blanc », three « pont du gard »): the bounding box picks the right one. Reliability
high. Read again the same day for the second lot (D-048): « cathédrale notre-dame »
of Rouen 49.44027, 1.09482; « gros horloge » (Monument) 49.44152, 1.09127; « beffroi
de l'hôtel de ville », Lille 50.63063, 3.06978; « cathédrale notre-dame » of Amiens
49.89457, 2.30205; « château du haut koenigsbourg » 48.24954, 7.34465; « cathédrale
notre-dame de chartres » 48.44780, 1.48784; « muséum citadelle de besançon » 47.22860,
6.03447; « fort boyard » (Ouvrage militaire) 45.99966, −1.21396; « place de la
bourse », Bordeaux 44.84156, −0.57015; « la cité », Carcassonne 43.20649, 2.36399;
« palais bénédictine » (Musée) 49.75885, 0.36771; « arc de triomphe » 48.87379,
2.29506. And for the third lot (D-049): « marais salants de guérande » (Marais
salant) 47.30122, −2.46260; « phare de la vieille » (Phare) 48.04067, −4.75644;
« puy de dôme » (Volcan) 45.77294, 2.96515; « calanque de sormiou » (Baie)
43.20956, 5.42189; « pic du midi de bigorre » (Sommet) 42.93707, 0.14120, not used.

Consulted on 2026-11-14, **S-024**: [French Wikipedia][s022] again, the introductions
of its articles (API, `prop=extracts&exintro`, three requests), for the landmarks'
captions (`src/map/landmark-captions.ts`, B-016, B-020). Gave, by article: « Site
d'Étretat »: chalk cliffs of the Côte d'Albâtre, three arches called « portes » and
the needle. « Grand port maritime du Havre »: founded in 1517 by order of Francis I.
« Le Mont-Saint-Michel »: a rocky islet, the abbey, the statue of Saint Michael
157.10 m above the shore. « Tour Eiffel »: puddled iron, 330 m with its antennas,
built in two years by Gustave Eiffel and his team for the 1889 World's Fair.
« Beffroi de l'hôtel de ville de Lille »: opened in 1932, the tallest civic belfry
in Europe, by Émile Dubuisson. « Cathédrale Notre-Dame d'Amiens »: begun in the 13th
century, the largest cathedral of France by its inner volume. « Cathédrale
Notre-Dame de Strasbourg »: founded in 1015, built from 1220. « Château du
Haut-Koenigsbourg »: a castle of the 12th century. « Château de Chambord »: the
largest of the Loire châteaux, built 1519–1547, a park walled for 32 km. « Cathédrale
Notre-Dame de Chartres »: early 13th century, the north spire of the 16th. « Hospices
de Beaune »: founded in the 15th century by Nicolas Rolin and Guigone de Salins,
glazed-tile roofs. « Citadelle de Besançon »: by Vauban, 130 m above the Doubs, UNESCO
World Heritage since 7 July 2008. « Château des ducs de Bretagne »: mostly of the 15th
century, home of Nantes's history museum. « Marais salants de Guérande »: on Guérande,
Batz-sur-Mer, Le Croisic and La Turballe. « Phare de la Vieille »: built 1882–1887 in
the Raz de Sein. « Alignements de Carnac »: nearly 3 000 standing stones raised about
4 500 BC, over more than four kilometres. « Dune du Pilat »: the highest dune in
Europe, 103.6 m in 2023. « Fort Boyard » (a disambiguation page): a fortification
between the islands of Aix and Oléron. « Place de la Bourse (Bordeaux) »: by Jacques
and Ange-Jacques Gabriel, 1730–1755. « Pont du Gard »: a three-tier bridge of a Roman
aqueduct from Uzès to Nîmes, probably of the first half of the 1st century. « Cité de
Carcassonne »: two rings of walls of nearly 3 km, 52 towers. « Puy de Dôme »: a lava
dome about 11 000 years old, one of the youngest of the Chaîne des Puys. « Basilique
Notre-Dame de Fourvière »: on the hill over Lyon since the end of the 19th century.
« Basilique Notre-Dame-de-la-Garde »: « la Bonne Mère », 19th century, on a limestone
peak of 149 m that overlooks the city. « Calanque de Sormiou »: in the Calanques
massif, in the national park. « Cathédrale Notre-Dame de Rouen »: Gothic. Not found:
« Port de Fécamp » and « Base 11/19 »; then the API answered HTTP 429 to every
request, on Wikipedia and Wikidata alike, so the slag heaps' caption is provisional.
Reliability medium (a community encyclopedia).

[s010-codes]: https://github.com/open-meteo/open-meteo-website/blob/8fbb311caa9d9f72d5bb127a7e0303e28bdfa62f/src/lib/components/variables/wmo-codes-table.svelte
[s010-docs]: https://github.com/open-meteo/open-meteo-website/blob/8fbb311caa9d9f72d5bb127a7e0303e28bdfa62f/src/routes/en/docs/%2Bpage.svelte
[s010-enum]: https://github.com/open-meteo/open-meteo/blob/954c561b9868d81a28bfc280a971c13474ea3191/Sources/App/Helper/WeatherCode.swift
[s013-wfs]: https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities
[s013-csw]: https://data.geopf.fr/csw?REQUEST=GetRecordById&SERVICE=CSW&VERSION=2.0.2&OUTPUTSCHEMA=http://standards.iso.org/iso/19115/-3/mdb/2.0&elementSetName=full&ID=IGNF_ADMIN-EXPRESS
[s014-wms]: https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0
[s014-csw]: https://data.geopf.fr/csw?REQUEST=GetRecordById&SERVICE=CSW&VERSION=2.0.2&OUTPUTSCHEMA=http://standards.iso.org/iso/19115/-3/mdb/2.0&elementSetName=full&ID=IGNF_BD-ALTI
[s016]: https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege-311224/
[s015-repo]: https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19
[s017]: https://odre.opendatasoft.com/explore/dataset/eco2mix-regional-cons-def/
[s019]: https://www.wikidata.org/
[s021]: https://pop.culture.gouv.fr/
[s022]: https://fr.wikipedia.org/
[s018-csw]: https://data.geopf.fr/csw?REQUEST=GetRecordById&SERVICE=CSW&VERSION=2.0.2&OUTPUTSCHEMA=http://standards.iso.org/iso/19115/-3/mdb/2.0&elementSetName=full&ID=IGNF_BD-TOPO
