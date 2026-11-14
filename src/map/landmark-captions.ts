/**
 * What a landmark's caption says (B-016, B-020): its name, a proper noun kept in French
 * in both languages (ARCHITECTURE § Internationalization), and one line on what it is,
 * in French and English. Every fact comes from the sources its entry cites, logged in
 * docs/SOURCES.md; an entry without one is marked provisional, and the PR lists it.
 */

export interface LandmarkCaption {
  readonly name: string;
  readonly fr: string;
  readonly en: string;
  /** The `S-` entries of docs/SOURCES.md its facts come from. */
  readonly sources: readonly string[];
  /** No source found yet for its line: Guillaume checks it (AGENTS.md § 5). */
  readonly provisional?: true;
}

/** By row of docs/POI.md: one for every landmark the scene draws. */
export const LANDMARK_CAPTIONS: Readonly<Record<string, LandmarkCaption>> = {
  "P-001": {
    name: "Falaises d'Étretat",
    fr: "Falaises de craie de la Côte d'Albâtre : trois arches, les « portes », et l'Aiguille.",
    en: "Chalk cliffs of the Côte d'Albâtre: three arches, the « portes », and the Needle.",
    sources: ["S-024"],
  },
  "P-002": {
    name: "Port 2000, Le Havre",
    fr: "Le terminal à conteneurs du port du Havre, créé en 1517 sur l'ordre de François Iᵉʳ.",
    en: "The container terminal of the port of Le Havre, founded in 1517 by order of Francis I.",
    sources: ["S-018", "S-024"],
  },
  "P-005": {
    name: "Port de Fécamp",
    fr: "L'avant-port et sa jetée ; le phare est un dessin générique.",
    en: "The outer harbour and its jetty; the lighthouse is a generic drawing.",
    sources: ["S-023"],
  },
  "P-006": {
    name: "Mont-Saint-Michel",
    fr: "Îlot rocheux et son abbaye ; la statue de saint Michel culmine à 157 m au-dessus du rivage.",
    en: "A rocky islet and its abbey; the statue of Saint Michael stands 157 m above the shore.",
    sources: ["S-024"],
  },
  "P-008": {
    name: "Tour Eiffel",
    fr: "Tour de fer puddlé de 330 m, bâtie par Gustave Eiffel pour l'Exposition universelle de 1889.",
    en: "A 330 m tower of puddled iron, built by Gustave Eiffel for the 1889 World's Fair.",
    sources: ["S-024"],
  },
  "P-012": {
    name: "Terrils du 11/19",
    fr: "Les deux terrils de la fosse 11/19 de Loos-en-Gohelle, faits des déblais des mines de charbon.",
    en: "The two slag heaps of the 11/19 pit at Loos-en-Gohelle, made of coal-mining spoil.",
    sources: ["S-023"],
    provisional: true,
  },
  "P-013": {
    name: "Beffroi de Lille",
    fr: "Le plus haut beffroi civil d'Europe, d'Émile Dubuisson, inauguré en 1932.",
    en: "The tallest civic belfry in Europe, by Émile Dubuisson, opened in 1932.",
    sources: ["S-024"],
  },
  "P-014": {
    name: "Cathédrale d'Amiens",
    fr: "Cathédrale gothique commencée au XIIIᵉ siècle, la plus vaste de France par ses volumes.",
    en: "A Gothic cathedral begun in the 13th century, the largest in France by its volume.",
    sources: ["S-024"],
  },
  "P-015": {
    name: "Cathédrale de Strasbourg",
    fr: "Cathédrale gothique élevée à partir de 1220, sur une cathédrale fondée en 1015.",
    en: "A Gothic cathedral built from 1220, over a cathedral founded in 1015.",
    sources: ["S-024"],
  },
  "P-016": {
    name: "Haut-Kœnigsbourg",
    fr: "Château fort du XIIᵉ siècle, reconstruit par Bodo Ebhardt de 1901 à 1908.",
    en: "A 12th-century castle, rebuilt by Bodo Ebhardt from 1901 to 1908.",
    sources: ["S-021", "S-024"],
  },
  "P-018": {
    name: "Château de Chambord",
    fr: "Le plus vaste des châteaux de la Loire, bâti de 1519 à 1547 dans un parc clos de 32 km de mur.",
    en: "The largest of the Loire châteaux, built 1519–1547 in a park walled for 32 km.",
    sources: ["S-024"],
  },
  "P-019": {
    name: "Cathédrale de Chartres",
    fr: "Cathédrale gothique du début du XIIIᵉ siècle ; sa flèche nord date du XVIᵉ.",
    en: "A Gothic cathedral of the early 13th century; its north spire dates from the 16th.",
    sources: ["S-024"],
  },
  "P-020": {
    name: "Hospices de Beaune",
    fr: "Hôtel-Dieu fondé au XVᵉ siècle par Nicolas Rolin, aux toits de tuiles vernissées.",
    en: "A hospital founded in the 15th century by Nicolas Rolin, under glazed-tile roofs.",
    sources: ["S-024"],
  },
  "P-021": {
    name: "Citadelle de Besançon",
    fr: "Œuvre de Vauban, à 130 m au-dessus du Doubs ; patrimoine mondial de l'UNESCO depuis 2008.",
    en: "Built by Vauban, 130 m above the Doubs; a UNESCO World Heritage Site since 2008.",
    sources: ["S-024"],
  },
  "P-022": {
    name: "Château des ducs de Bretagne",
    fr: "Forteresse des ducs, surtout du XVᵉ siècle ; elle abrite le musée d'histoire de Nantes.",
    en: "The dukes' fortress, mostly of the 15th century; it houses Nantes's history museum.",
    sources: ["S-024"],
  },
  "P-023": {
    name: "Marais salants de Guérande",
    fr: "Marais salants de Guérande, Batz-sur-Mer, Le Croisic et La Turballe.",
    en: "Salt marshes of Guérande, Batz-sur-Mer, Le Croisic and La Turballe.",
    sources: ["S-024"],
  },
  "P-024": {
    name: "Raz de Sein",
    fr: "Un phare en mer, dessiné de façon générique, là où se dresse le phare de la Vieille (1882–1887).",
    en: "A lighthouse at sea, drawn generically, where the Vieille lighthouse stands (1882–1887).",
    sources: ["S-024"],
  },
  "P-025": {
    name: "Alignements de Carnac",
    fr: "Près de 3 000 pierres levées vers 4 500 av. J.-C., sur plus de quatre kilomètres.",
    en: "Nearly 3,000 standing stones raised around 4,500 BC, over more than four kilometres.",
    sources: ["S-024"],
  },
  "P-026": {
    name: "Dune du Pilat",
    fr: "La plus haute dune d'Europe : 103,6 m en 2023.",
    en: "The highest dune in Europe: 103.6 m in 2023.",
    sources: ["S-024"],
  },
  "P-027": {
    name: "Fort Boyard",
    fr: "Fort en mer entre l'île d'Aix et l'île d'Oléron, commencé en 1801.",
    en: "A fort at sea between the islands of Aix and Oléron, begun in 1801.",
    sources: ["S-019", "S-024"],
  },
  "P-028": {
    name: "Place de la Bourse, Bordeaux",
    fr: "Place royale ouverte sur la Garonne, de Jacques et Ange-Jacques Gabriel, 1730–1755.",
    en: "A royal square open on the Garonne, by Jacques and Ange-Jacques Gabriel, 1730–1755.",
    sources: ["S-024"],
  },
  "P-029": {
    name: "Pont du Gard",
    fr: "Pont romain à trois niveaux, sans doute du Iᵉʳ siècle : l'aqueduc menait l'eau d'Uzès à Nîmes.",
    en: "A three-tier Roman bridge, likely of the 1st century: the aqueduct took water from Uzès to Nîmes.",
    sources: ["S-024"],
  },
  "P-030": {
    name: "Cité de Carcassonne",
    fr: "Double enceinte de près de 3 km et 52 tours, restaurée par Viollet-le-Duc.",
    en: "Two rings of walls, nearly 3 km long with 52 towers, restored by Viollet-le-Duc.",
    sources: ["S-021", "S-024"],
  },
  "P-034": {
    name: "Puy de Dôme",
    fr: "Dôme de lave d'environ 11 000 ans, l'un des plus jeunes volcans de la chaîne des Puys.",
    en: "A lava dome about 11,000 years old, one of the youngest volcanoes of the Chaîne des Puys.",
    sources: ["S-024"],
  },
  "P-035": {
    name: "Basilique de Fourvière",
    fr: "Basilique de la fin du XIXᵉ siècle, de Pierre Bossan, au sommet de la colline qui domine Lyon.",
    en: "A late 19th-century basilica by Pierre Bossan, atop the hill that overlooks Lyon.",
    sources: ["S-019", "S-024"],
  },
  "P-036": {
    name: "Notre-Dame de la Garde",
    fr: "« La Bonne Mère », basilique du XIXᵉ siècle sur un piton de 149 m qui domine Marseille.",
    en: "« La Bonne Mère », a 19th-century basilica on a 149 m peak overlooking Marseille.",
    sources: ["S-024"],
  },
  "P-037": {
    name: "Calanque de Sormiou",
    fr: "Une calanque du massif des Calanques, entre Marseille et Cassis, dans le parc national.",
    en: "A calanque of the Calanques massif, between Marseille and Cassis, in the national park.",
    sources: ["S-024"],
  },
  "P-041": {
    name: "Cathédrale de Rouen et Gros-Horloge",
    fr: "Cathédrale gothique, sa flèche de fonte par Alavoine (1823–1884) ; à l'ouest, l'horloge du XIVᵉ siècle.",
    en: "A Gothic cathedral, its cast-iron spire by Alavoine (1823–1884); west of it, a 14th-century clock.",
    sources: ["S-020", "S-021", "S-023", "S-024"],
  },
};
