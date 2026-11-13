# Points of interest

The register of landmarks (POIs) considered for the map: for each one, whether it is
drawn (**GO**), not drawn (**NO-GO**) or not decided yet (**TO CHECK**), and why. It
exists so that every inclusion or exclusion can be audited and revisited (D-004).

## Rules

- A landmark is drawn only when it is **GO**. Nothing is drawn while it is
  **TO CHECK**.
- **GO** needs one of:
  - a natural site (cliffs, dune, mountain) or a generic scene (vineyards, cranes,
    fields, a generic lighthouse);
  - a work in the **public domain**: in France, its author (architect, engineer,
    lighting designer) died more than 70 years ago, counted from 1 January after
    the death. The death year is cited from a source in `docs/SOURCES.md`.
- **NO-GO** when the work is still protected, or when it is not salient enough to be
  recognised in a few pixels. The comment says which.
- A part of a landmark can have its own row (the Eiffel Tower's structure is GO, its
  illumination show is NO-GO).
- A decision changes only through a new dated comment in its row (never a silent
  edit), and a change of rule goes to `docs/DECISIONS.md`.
- Coordinates are recorded when the landmark is placed (B-016), with their source.

> 💡 **Freedom of panorama** is the right to depict a protected building seen from
> a public place. French law grants it only narrowly (non-commercial use by
> individuals, since 2016), so for a public project the safe rule is: public domain
> or nothing.

## Register

| Id    | Region                     | Landmark                                  | Decision | Basis                                                       | Comment                                                                | Decided               |
| ----- | -------------------------- | ----------------------------------------- | -------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------- |
| P-001 | Normandie (Seine-Maritime) | Étretat cliffs: arch and needle           | GO       | natural site                                                | Iconic, readable as a silhouette at sea                                | Guillaume, 2026-11-12 |
| P-002 | Normandie (Seine-Maritime) | Port of Le Havre: container cranes, ships | GO       | generic industrial scene                                    | Shows the port as a big consumer; cranes animate at night              | Guillaume, 2026-11-12 |
| P-003 | Normandie (Seine-Maritime) | Saint-Joseph church, Le Havre             | TO CHECK | A. Perret d. 1954; glass by M. Huré d. 1967 (S-019)         | 2026-11-13: glass protected until 2038; R. Audigier d. 1987: to source | proposed, to confirm  |
| P-004 | Normandie (Seine-Maritime) | Palais Bénédictine, Fécamp                | GO       | Camille Albert d. 1942 (S-019): PD since 2013               | 2026-11-13: recognisable roofline                                      | proposed, to confirm  |
| P-005 | Normandie (Seine-Maritime) | Fécamp cliffs and harbour                 | GO       | natural site, generic harbour                               | Sets the scene for the offshore wind farm                              | Guillaume, 2026-11-12 |
| P-006 | Normandie                  | Mont-Saint-Michel                         | GO       | medieval; the spire: V. Petitgrand d. 1898, Frémiet d. 1910 | 2026-11-13: death years S-019; who made the spire: to source           | proposed, to confirm  |
| P-007 | Normandie                  | Pont de Normandie                         | NO-GO    | opened 1995; designers' rights still running                | Protected work                                                         | proposed, to confirm  |
| P-008 | Île-de-France              | Eiffel Tower, structure lit plainly       | GO       | Eiffel d. 1923, Sauvestre 1919, Koechlin 1946 (S-019)       | 2026-11-13: PD since 2017; the most salient landmark of France         | proposed, to confirm  |
| P-009 | Île-de-France              | Eiffel Tower illumination and sparkle     | NO-GO    | lighting designs of 1985 and 2000, claimed as protected     | Draw the tower lit plainly instead (P-008)                             | Guillaume, 2026-11-11 |
| P-010 | Île-de-France              | Sacré-Cœur                                | TO CHECK | Abadie d. 1884, Laisné 1891, Daumet 1911, Magne 1916        | 2026-11-13: S-019; the last architects (Rauline, Hulot) not found      | proposed, to confirm  |
| P-011 | Île-de-France              | Arc de Triomphe                           | GO       | Chalgrin d. 1811, Goust 1838, Huyot 1840, Blouet 1853       | 2026-11-13: S-019; salient                                             | proposed, to confirm  |
| P-012 | Hauts-de-France            | Twin slag heaps of Loos-en-Gohelle        | GO       | industrial landform, no author                              | Mining heritage, links to the history of coal power                    | proposed, to confirm  |
| P-013 | Hauts-de-France            | A belfry                                  | GO       | Lille's belfry: Émile Dubuisson d. 1947 (S-019)             | 2026-11-13: PD since 2018; a clear silhouette                          | proposed, to confirm  |
| P-014 | Hauts-de-France            | Amiens cathedral                          | GO       | medieval                                                    | 2026-11-13: too old for any right to run; salient                      | proposed, to confirm  |
| P-015 | Grand Est                  | Strasbourg cathedral                      | GO       | medieval                                                    | 2026-11-13: too old for any right to run; a single spire, readable     | proposed, to confirm  |
| P-016 | Grand Est                  | Haut-Kœnigsbourg                          | GO       | medieval; restored by Bodo Ebhardt d. 1945 (S-019)          | 2026-11-13: PD since 2016; that Ebhardt restored it: to source         | proposed, to confirm  |
| P-017 | Grand Est                  | Champagne vineyards                       | GO       | generic                                                     | Seasonal colours (D-008)                                               | proposed, to confirm  |
| P-018 | Centre-Val de Loire        | Château de Chambord                       | GO       | Renaissance                                                 | 2026-11-13: too old for any right to run; salient roofline             | proposed, to confirm  |
| P-019 | Centre-Val de Loire        | Chartres cathedral                        | GO       | medieval                                                    | 2026-11-13: too old for any right to run; two different spires         | proposed, to confirm  |
| P-020 | Bourgogne-Franche-Comté    | Hospices de Beaune                        | GO       | 15th century; roofs restored: L. Sauvageot d. 1908          | 2026-11-13: death year S-019; who restored the roofs: to source        | proposed, to confirm  |
| P-021 | Bourgogne-Franche-Comté    | Citadel of Besançon                       | GO       | Vauban d. 1707 (S-019)                                      | 2026-11-13: too old for any right to run                               | proposed, to confirm  |
| P-022 | Pays de la Loire           | Château des ducs de Bretagne, Nantes      | GO       | medieval and Renaissance                                    | 2026-11-13: too old for any right to run                               | proposed, to confirm  |
| P-023 | Pays de la Loire           | Guérande salt marshes                     | GO       | generic landscape                                           |                                                                        | proposed, to confirm  |
| P-024 | Bretagne                   | A lighthouse at sea                       | GO       | a generic lighthouse, no real one copied                    | 2026-11-13: generic scene (rule); animated beam at night               | proposed, to confirm  |
| P-025 | Bretagne                   | Carnac standing stones                    | GO       | prehistoric                                                 |                                                                        | proposed, to confirm  |
| P-026 | Nouvelle-Aquitaine         | Dune du Pilat                             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-027 | Nouvelle-Aquitaine         | Fort Boyard                               | GO       | begun in 1801 (S-019), by military engineers                | 2026-11-13: too old for any right to run                               | proposed, to confirm  |
| P-028 | Nouvelle-Aquitaine         | Place de la Bourse, Bordeaux              | GO       | J. Gabriel d. 1742, A.-J. Gabriel d. 1782 (S-019)           | 2026-11-13: the buildings only; the water mirror (2006) is NO-GO       | proposed, to confirm  |
| P-029 | Occitanie                  | Pont du Gard                              | GO       | Roman                                                       | Author long dead, no doubt possible                                    | proposed, to confirm  |
| P-030 | Occitanie                  | Cité de Carcassonne                       | GO       | medieval; Viollet-le-Duc d. 1879, Boeswillwald d. 1931      | 2026-11-13: S-019; PD since 2002; who restored it: to source           | proposed, to confirm  |
| P-031 | Occitanie                  | Pic du Midi                               | GO       | natural site (the observatory: to check if drawn)           |                                                                        | proposed, to confirm  |
| P-032 | Occitanie                  | Viaduc de Millau                          | NO-GO    | opened 2004; architect's rights running                     | Protected work                                                         | Guillaume, 2026-11-11 |
| P-033 | Auvergne-Rhône-Alpes       | Mont Blanc                                | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-034 | Auvergne-Rhône-Alpes       | Puy de Dôme and the volcanoes             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-035 | Auvergne-Rhône-Alpes       | Basilica of Fourvière                     | GO       | P. Bossan d. 1888, Sainte-Marie-Perrin d. 1917 (S-019)      | 2026-11-13: PD since 1988                                              | proposed, to confirm  |
| P-036 | Provence-Alpes-Côte d'Azur | Notre-Dame de la Garde                    | GO       | Espérandieu d. 1874, Lequesne 1887, Révoil 1900 (S-019)     | 2026-11-13: PD since 1971                                              | proposed, to confirm  |
| P-037 | Provence-Alpes-Côte d'Azur | The Calanques                             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-038 | Provence-Alpes-Côte d'Azur | Lavender fields                           | GO       | generic                                                     | Seasonal (D-008)                                                       | proposed, to confirm  |

"proposed, to confirm" means Claude proposed the decision; it becomes final when
Guillaume confirms it (in a review or the project thread), and the cell then reads
"Guillaume, date".
