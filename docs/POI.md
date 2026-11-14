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
| P-004 | Normandie (Seine-Maritime) | Palais Bénédictine, Fécamp                | GO       | Camille Albert d. 1942 (S-019): PD since 2013               | 2026-11-14: waits, 0.3 km from Fécamp's lighthouse P-005 (D-048)       | Guillaume, 2026-11-14 |
| P-005 | Normandie (Seine-Maritime) | Fécamp cliffs and harbour                 | GO       | natural site, generic harbour                               | Sets the scene for the offshore wind farm                              | Guillaume, 2026-11-12 |
| P-006 | Normandie                  | Mont-Saint-Michel                         | GO       | medieval; the spire: V. Petitgrand d. 1898, Frémiet d. 1910 | 2026-11-14: spire by Petitgrand, 1892–1897 (S-022); Mérimée names none | Guillaume, 2026-11-14 |
| P-007 | Normandie                  | Pont de Normandie                         | NO-GO    | opened 1995; designers' rights still running                | 2026-11-14: protected work; kept NO-GO for the future                  | Guillaume, 2026-11-14 |
| P-008 | Île-de-France              | Eiffel Tower, structure lit plainly       | GO       | Eiffel d. 1923, Sauvestre 1919, Koechlin 1946 (S-019)       | 2026-11-13: PD since 2017; the most salient landmark of France         | Guillaume, 2026-11-14 |
| P-009 | Île-de-France              | Eiffel Tower illumination and sparkle     | NO-GO    | lighting designs of 1985 and 2000, claimed as protected     | Draw the tower lit plainly instead (P-008)                             | Guillaume, 2026-11-11 |
| P-010 | Île-de-France              | Sacré-Cœur                                | TO CHECK | Abadie d. 1884, Laisné 1891, Daumet 1911, Magne 1916        | 2026-11-13: S-019; the last architects (Rauline, Hulot) not found      | proposed, to confirm  |
| P-011 | Île-de-France              | Arc de Triomphe                           | GO       | Chalgrin d. 1811, Goust 1838, Huyot 1840, Blouet 1853       | 2026-11-14: waits, 1.7 km from the Eiffel Tower P-008 (D-048)          | Guillaume, 2026-11-14 |
| P-012 | Hauts-de-France            | Twin slag heaps of Loos-en-Gohelle        | GO       | industrial landform, no author                              | Mining heritage, links to the history of coal power                    | Guillaume, 2026-11-14 |
| P-013 | Hauts-de-France            | A belfry                                  | GO       | Lille's belfry: Émile Dubuisson d. 1947 (S-019)             | 2026-11-13: PD since 2018; a clear silhouette                          | Guillaume, 2026-11-14 |
| P-014 | Hauts-de-France            | Amiens cathedral                          | GO       | medieval                                                    | 2026-11-13: too old for any right to run; salient                      | Guillaume, 2026-11-14 |
| P-015 | Grand Est                  | Strasbourg cathedral                      | GO       | medieval                                                    | 2026-11-13: too old for any right to run; a single spire, readable     | Guillaume, 2026-11-14 |
| P-016 | Grand Est                  | Haut-Kœnigsbourg                          | GO       | medieval; restored by Bodo Ebhardt d. 1945 (S-019)          | 2026-11-14: PD since 2016; rebuilt by Ebhardt, 1901–1908 (S-021)       | Guillaume, 2026-11-14 |
| P-017 | Grand Est                  | Champagne vineyards                       | GO       | generic                                                     | Seasonal colours (D-008)                                               | proposed, to confirm  |
| P-018 | Centre-Val de Loire        | Château de Chambord                       | GO       | Renaissance                                                 | 2026-11-13: too old for any right to run; salient roofline             | Guillaume, 2026-11-14 |
| P-019 | Centre-Val de Loire        | Chartres cathedral                        | GO       | medieval                                                    | 2026-11-13: too old for any right to run; two different spires         | Guillaume, 2026-11-14 |
| P-020 | Bourgogne-Franche-Comté    | Hospices de Beaune                        | GO       | 15th century; roofs restored: L. Sauvageot d. 1908          | 2026-11-14: glazed roofs redone by Sauvageot, 1902–1907 (S-022)        | Guillaume, 2026-11-14 |
| P-021 | Bourgogne-Franche-Comté    | Citadel of Besançon                       | GO       | Vauban d. 1707 (S-019)                                      | 2026-11-13: too old for any right to run                               | Guillaume, 2026-11-14 |
| P-022 | Pays de la Loire           | Château des ducs de Bretagne, Nantes      | GO       | medieval and Renaissance                                    | 2026-11-13: too old for any right to run                               | Guillaume, 2026-11-14 |
| P-023 | Pays de la Loire           | Guérande salt marshes                     | GO       | generic landscape                                           |                                                                        | proposed, to confirm  |
| P-024 | Bretagne                   | A lighthouse at sea                       | GO       | a generic lighthouse, no real one copied                    | 2026-11-13: generic scene (rule); animated beam at night               | Guillaume, 2026-11-14 |
| P-025 | Bretagne                   | Carnac standing stones                    | GO       | prehistoric                                                 |                                                                        | Guillaume, 2026-11-14 |
| P-026 | Nouvelle-Aquitaine         | Dune du Pilat                             | GO       | natural site                                                |                                                                        | Guillaume, 2026-11-14 |
| P-027 | Nouvelle-Aquitaine         | Fort Boyard                               | GO       | begun in 1801 (S-019), by military engineers                | 2026-11-13: too old for any right to run                               | Guillaume, 2026-11-14 |
| P-028 | Nouvelle-Aquitaine         | Place de la Bourse, Bordeaux              | GO       | J. Gabriel d. 1742, A.-J. Gabriel d. 1782 (S-019)           | 2026-11-13: the buildings only; the water mirror (2006) is NO-GO       | Guillaume, 2026-11-14 |
| P-029 | Occitanie                  | Pont du Gard                              | GO       | Roman                                                       | 2026-11-14: Occitanie's bridge, in place of the Viaduc de Millau       | Guillaume, 2026-11-14 |
| P-030 | Occitanie                  | Cité de Carcassonne                       | GO       | medieval; Viollet-le-Duc d. 1879, Boeswillwald d. 1931      | 2026-11-14: restored by Viollet-le-Duc (S-021); PD since 2002          | Guillaume, 2026-11-14 |
| P-031 | Occitanie                  | Pic du Midi                               | GO       | natural site (the observatory: to check if drawn)           |                                                                        | proposed, to confirm  |
| P-032 | Occitanie                  | Viaduc de Millau                          | NO-GO    | opened 2004; architect's rights running                     | Protected work                                                         | Guillaume, 2026-11-11 |
| P-033 | Auvergne-Rhône-Alpes       | Mont Blanc                                | GO       | natural site                                                | 2026-11-14: no sprite, the relief draws its snow (D-045)               | proposed, to confirm  |
| P-034 | Auvergne-Rhône-Alpes       | Puy de Dôme and the volcanoes             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-035 | Auvergne-Rhône-Alpes       | Basilica of Fourvière                     | GO       | P. Bossan d. 1888, Sainte-Marie-Perrin d. 1917 (S-019)      | 2026-11-13: PD since 1988                                              | Guillaume, 2026-11-14 |
| P-036 | Provence-Alpes-Côte d'Azur | Notre-Dame de la Garde                    | GO       | Espérandieu d. 1874, Lequesne 1887, Révoil 1900 (S-019)     | 2026-11-13: PD since 1971                                              | Guillaume, 2026-11-14 |
| P-037 | Provence-Alpes-Côte d'Azur | The Calanques                             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-038 | Provence-Alpes-Côte d'Azur | Lavender fields                           | GO       | generic                                                     | Seasonal (D-008)                                                       | proposed, to confirm  |
| P-039 | Normandie                  | Pont de Tancarville                       | NO-GO    | 1959; Esquillan d. 1989, Ramsay-Robinson d. 1988 (S-020)    | 2026-11-14: protected through 2059; proposed by Guillaume              | Guillaume, 2026-11-14 |
| P-040 | Normandie                  | Pont de Brotonne                          | NO-GO    | 1977; engineer Jean Muller d. 2005 (S-020)                  | 2026-11-14: protected through 2075; proposed by Guillaume              | Guillaume, 2026-11-14 |
| P-041 | Normandie (Seine-Maritime) | Rouen cathedral                           | GO       | medieval (begun 1030, S-020); spire: J.-A. Alavoine d. 1834 | 2026-11-14: too old for any right; spire by Alavoine, 1823–1884, S-021 | Guillaume, 2026-11-14 |
| P-042 | Normandie (Seine-Maritime) | Gros-Horloge, Rouen                       | GO       | astronomical clock of the 14th century (S-020)              | 2026-11-14: drawn in Rouen cathedral's sprite, 0.28 km west (D-048)    | Guillaume, 2026-11-14 |

"proposed, to confirm" means Claude proposed the decision; it becomes final when
Guillaume confirms it (in a review or the project thread), and the cell then reads
"Guillaume, date".
