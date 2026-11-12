# Assets

Every graphics, sound, font, map or data file in this repository is listed here with
its author, source and license. Files without an entry are not merged.

- Project art (sprites drawn in code, screenshots, mockups) is licensed under
  **CC BY-SA 4.0** unless stated otherwise.
- Third-party assets must be CC0, CC BY, CC BY-SA or GPL-3.0 compatible.
- **No image files of real places**: landmarks are drawn in code from our own
  observation, and only public-domain works are drawn (PRD § Content and licensing).
- Baked data (map, installed capacities, recorded API fixtures) keeps its source
  licence, named here with the source's id in `docs/DATA-SOURCES.md`.

| File                            | Author                 | Source                                                                    | License             |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------- | ------------------- |
| `docs/screenshots/*.png`        | Wattscape contributors | Screenshots of this app; no third-party content                           | CC BY-SA 4.0        |
| `tests/fixtures/eco2mix/*.json` | RTE, served by ODRÉ    | Recorded API answers, DS-01 and DS-02 (date and URL in each `.meta.json`) | Licence Ouverte 2.0 |
| `tests/fixtures/open-meteo/*`   | Open-Meteo.com         | Recorded API answers, DS-03 (date and URL in each `.meta.json`)           | CC BY 4.0           |
| `tests/fixtures/sky/*.json`     | Wattscape contributors | Sun and moon reference values computed with Astronomy Engine (S-012)      | CC BY-SA 4.0        |
| `src/map/france.ts`             | IGN; Natural Earth     | Baked map (B-008): IGN DS-04, DS-05; Natural Earth DS-11 (public domain)  | Licence Ouverte 2.0 |
| `src/map/relief.ts`             | IGN                    | Baked 1 km relief (B-011, D-021): IGN BD ALTI, DS-05                      | Licence Ouverte 2.0 |
| `src/map/plants.ts`             | RTE, ODRÉ; IGN         | Baked plant sites (B-012, D-024): ODRÉ registry DS-07; IGN DS-04          | Licence Ouverte 2.0 |
| `src/map/consumption.ts`        | RTE, ODRÉ              | Baked ranges of consumption (B-014): éCO2mix consolidated DS-12           | Licence Ouverte 2.0 |
| `tests/fixtures/frames/*.json`  | Wattscape contributors | Hashes of reference frames drawn by this app (B-009)                      | CC BY-SA 4.0        |
