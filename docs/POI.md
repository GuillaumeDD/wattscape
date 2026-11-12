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
| P-003 | Normandie (Seine-Maritime) | Saint-Joseph church, Le Havre             | TO CHECK | Auguste Perret; death in 1954 to source → PD since 2025     | The tower is Le Havre's skyline signature; GO once the date is sourced |                       |
| P-004 | Normandie (Seine-Maritime) | Palais Bénédictine, Fécamp                | TO CHECK | architect Camille Albert; death year to source              | Recognisable roofline; GO if PD                                        |                       |
| P-005 | Normandie (Seine-Maritime) | Fécamp cliffs and harbour                 | GO       | natural site, generic harbour                               | Sets the scene for the offshore wind farm                              | Guillaume, 2026-11-12 |
| P-006 | Normandie                  | Mont-Saint-Michel                         | TO CHECK | medieval; 19th-century spire (Victor Petitgrand, to source) | Salient; the spire's author must be PD too                             |                       |
| P-007 | Normandie                  | Pont de Normandie                         | NO-GO    | opened 1995; designers' rights still running                | Protected work                                                         | proposed, to confirm  |
| P-008 | Île-de-France              | Eiffel Tower, structure lit plainly       | TO CHECK | Gustave Eiffel; death in 1923 to source                     | The most salient landmark of France                                    |                       |
| P-009 | Île-de-France              | Eiffel Tower illumination and sparkle     | NO-GO    | lighting designs of 1985 and 2000, claimed as protected     | Draw the tower lit plainly instead (P-008)                             | Guillaume, 2026-11-11 |
| P-010 | Île-de-France              | Sacré-Cœur                                | TO CHECK | Paul Abadie and successors (19th–20th c.), to source        | Salient white domes                                                    |                       |
| P-011 | Île-de-France              | Arc de Triomphe                           | TO CHECK | Chalgrin, early 19th century, to source                     | Salient                                                                |                       |
| P-012 | Hauts-de-France            | Twin slag heaps of Loos-en-Gohelle        | GO       | industrial landform, no author                              | Mining heritage, links to the history of coal power                    | proposed, to confirm  |
| P-013 | Hauts-de-France            | A belfry                                  | TO CHECK | medieval to 20th century depending on the one chosen        | Pick one whose author is PD                                            |                       |
| P-014 | Hauts-de-France            | Amiens cathedral                          | TO CHECK | medieval                                                    | Salient                                                                |                       |
| P-015 | Grand Est                  | Strasbourg cathedral                      | TO CHECK | medieval                                                    | Single spire, very readable                                            |                       |
| P-016 | Grand Est                  | Haut-Kœnigsbourg                          | TO CHECK | medieval; restored 1908 by Bodo Ebhardt (death to source)   | GO if the restorer is PD                                               |                       |
| P-017 | Grand Est                  | Champagne vineyards                       | GO       | generic                                                     | Seasonal colours (D-008)                                               | proposed, to confirm  |
| P-018 | Centre-Val de Loire        | Château de Chambord                       | TO CHECK | Renaissance                                                 | Salient roofline                                                       |                       |
| P-019 | Centre-Val de Loire        | Chartres cathedral                        | TO CHECK | medieval                                                    | Two different spires                                                   |                       |
| P-020 | Bourgogne-Franche-Comté    | Hospices de Beaune                        | TO CHECK | 15th century; roof tiles restored later                     | Glazed roofs in a few pixels                                           |                       |
| P-021 | Bourgogne-Franche-Comté    | Citadel of Besançon                       | TO CHECK | Vauban, 17th century                                        |                                                                        |                       |
| P-022 | Pays de la Loire           | Château des ducs de Bretagne, Nantes      | TO CHECK | medieval and Renaissance                                    |                                                                        |                       |
| P-023 | Pays de la Loire           | Guérande salt marshes                     | GO       | generic landscape                                           |                                                                        | proposed, to confirm  |
| P-024 | Bretagne                   | A lighthouse at sea                       | TO CHECK | to pick (e.g. a 19th-century one); author to source         | Animated beam at night                                                 |                       |
| P-025 | Bretagne                   | Carnac standing stones                    | GO       | prehistoric                                                 |                                                                        | proposed, to confirm  |
| P-026 | Nouvelle-Aquitaine         | Dune du Pilat                             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-027 | Nouvelle-Aquitaine         | Fort Boyard                               | TO CHECK | 19th century                                                |                                                                        |                       |
| P-028 | Nouvelle-Aquitaine         | Place de la Bourse, Bordeaux              | TO CHECK | Gabriel, 18th century; the water mirror (2006) is NO-GO     | Draw the buildings only                                                |                       |
| P-029 | Occitanie                  | Pont du Gard                              | GO       | Roman                                                       | Author long dead, no doubt possible                                    | proposed, to confirm  |
| P-030 | Occitanie                  | Cité de Carcassonne                       | TO CHECK | medieval; restored by Viollet-le-Duc (death to source)      |                                                                        |                       |
| P-031 | Occitanie                  | Pic du Midi                               | GO       | natural site (the observatory: to check if drawn)           |                                                                        | proposed, to confirm  |
| P-032 | Occitanie                  | Viaduc de Millau                          | NO-GO    | opened 2004; architect's rights running                     | Protected work                                                         | Guillaume, 2026-11-11 |
| P-033 | Auvergne-Rhône-Alpes       | Mont Blanc                                | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-034 | Auvergne-Rhône-Alpes       | Puy de Dôme and the volcanoes             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-035 | Auvergne-Rhône-Alpes       | Basilica of Fourvière                     | TO CHECK | Pierre Bossan, 19th century, to source                      |                                                                        |                       |
| P-036 | Provence-Alpes-Côte d'Azur | Notre-Dame de la Garde                    | TO CHECK | Henri-Jacques Espérandieu, 19th century, to source          |                                                                        |                       |
| P-037 | Provence-Alpes-Côte d'Azur | The Calanques                             | GO       | natural site                                                |                                                                        | proposed, to confirm  |
| P-038 | Provence-Alpes-Côte d'Azur | Lavender fields                           | GO       | generic                                                     | Seasonal (D-008)                                                       | proposed, to confirm  |

"proposed, to confirm" means Claude proposed the decision; it becomes final when
Guillaume confirms it (in a review or the project thread), and the cell then reads
"Guillaume, date".
