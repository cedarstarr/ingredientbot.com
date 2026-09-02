/**
 * Maps the free-text ingredient strings stored on recipes onto the canonical
 * `Ingredient` corpus, so "What can I make?" can match on ingredient IDs
 * instead of on prose.
 *
 * The problem this solves, measured on the 998-recipe public library
 * (12,672 non-heading ingredient rows, 4,545 distinct strings): only 24.9% of
 * rows match a canonical slug exactly. The gap is almost entirely presentation
 * noise rather than genuinely different foods — "garlic cloves, minced",
 * "yellow onion, finely chopped", "unsalted butter, softened",
 * "boneless, skinless chicken thighs" are four ways of writing four canonical
 * ingredients.
 *
 * Strategy is a CASCADE, not a single transform. Each raw string yields a list
 * of progressively-more-stripped candidates, tried in order against the alias
 * table and then the canonical slug set; the first hit wins. Order is what
 * makes stripping safe: "fresh basil" matches the canonical row before the
 * "fresh" prefix is ever removed, while "fresh lemon juice" falls through to
 * "lemon juice" and aliases onto `lemon`. A single greedy regex cannot do both.
 *
 * One row per food, not per form. The corpus carries one row per herb and
 * spice (`fresh thyme`, `ground cumin`), so dried thyme, thyme sprigs, cumin
 * seeds and ground cumin all resolve to that one row — a cook typing "thyme"
 * means the herb, not a preparation of it.
 */

/** Shape the matcher needs from a canonical ingredient row. */
export interface CanonicalIngredient {
  slug: string
  name: string
  category: string
}

export const slugifyIngredient = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Comma-delimited segments that describe HOW the ingredient was prepared
 * rather than WHAT it is. A segment is dropped when every word in it is one of
 * these (or an adverb/filler word) — so "garlic cloves, minced" loses its
 * tail but "boneless, skinless chicken thighs" keeps both halves, because
 * "skinless chicken thighs" is not purely prep.
 */
const PREP_WORDS = new Set([
  'minced', 'chopped', 'diced', 'sliced', 'grated', 'shredded', 'crushed', 'smashed',
  'melted', 'softened', 'beaten', 'whisked', 'drained', 'rinsed', 'peeled', 'halved',
  'quartered', 'cubed', 'julienned', 'trimmed', 'seeded', 'stemmed', 'pitted', 'zested',
  'juiced', 'cored', 'husked', 'deveined', 'butterflied', 'scored', 'bruised', 'torn',
  'separated', 'divided', 'reserved', 'packed', 'sifted', 'cleaned', 'scrubbed', 'rimmed',
  'cut', 'broken', 'pounded', 'mashed', 'crumbled', 'flaked', 'shaved', 'ground',
  'toasted', 'warmed', 'chilled', 'thawed', 'drizzled', 'brushed', 'dissolved',
  'squeezed', 'debearded', 'blanched', 'soaked', 'drained', 'strained', 'sliced',
  'julienne', 'slit', 'knotted', 'tied', 'skewered', 'boiling', 'cooking', 'dredging',
  // adverbs and connectives that only ever qualify the above
  'finely', 'thinly', 'roughly', 'coarsely', 'thickly', 'lightly', 'freshly', 'well',
  'very', 'plus', 'more', 'about', 'approximately', 'preferably', 'ideally', 'optional',
  'to', 'taste', 'for', 'serving', 'garnish', 'garnishing', 'topping', 'drizzling',
  'frying', 'greasing', 'dusting', 'brushing', 'sprinkling', 'if', 'needed', 'desired',
  'and', 'or', 'into', 'in', 'at', 'as', 'the', 'a', 'an', 'up', 'lengthwise', 'crosswise',
  'room', 'temperature', 'cold', 'warm', 'hot', 'large', 'small', 'medium', 'thick', 'thin',
  'inch', 'inches', 'pieces', 'piece', 'chunks', 'rounds', 'strips', 'wedges', 'cubes',
  'bundle', 'tied', 'stems', 'removed', 'caps', 'parts', 'only', 'slightly', 'knot',
  // NOT here: white, light, dark, green. They open real canonical names
  // ("white rice", "light soy sauce", "dark chocolate", "green beans") and
  // treating them as prep words deletes the ingredient.
])

/**
 * Leading qualifiers stripped one at a time to build the cascade. Deliberately
 * EXCLUDES "ground" and "fresh": `ground beef` and `fresh mozzarella` are
 * canonical rows in their own right, and the cascade reaches the shorter form
 * anyway via the alias table when the longer form does not exist.
 */
const LEADING_QUALIFIERS = [
  'extra-large', 'extra large', 'large', 'medium-sized', 'medium sized', 'medium', 'small',
  // "half" is deliberately absent — it would reduce the canonical dairy row
  // "half and half" to nothing but qualifiers and connectives.
  'jumbo', 'baby', 'whole', 'ripe', 'raw', 'cooked', 'uncooked', 'leftover',
  'boneless', 'skinless', 'bone-in', 'skin-on', 'trimmed',
  'unsalted', 'salted', 'low-sodium', 'reduced-sodium', 'no-salt-added', 'lightly salted',
  'full-fat', 'low-fat', 'nonfat', 'non-fat', 'reduced-fat', 'fat-free', 'light',
  'good-quality', 'high-quality', 'best-quality', 'quality', 'authentic', 'homemade',
  'store-bought', 'canned', 'jarred', 'bottled', 'boxed', 'packaged', 'frozen', 'refrigerated',
  'cold', 'warm', 'hot', 'chilled', 'room-temperature', 'room temperature',
  'firm', 'soft', 'tender', 'crisp', 'crusty', 'stale', 'day-old',
  'organic', 'free-range', 'grass-fed', 'wild-caught', 'farm-raised', 'sustainably sourced',
  'plain', 'natural', 'pure', 'real', 'traditional', 'classic', 'simple',
  'peeled', 'seeded', 'pitted', 'shelled', 'husked', 'trimmed',
  'thinly', 'finely', 'roughly', 'coarsely', 'freshly',
]

/**
 * Word-level view of the above, for dropping qualifier-only comma segments
 * ("butter, unsalted"). Multi-word terms contribute their words; HYPHENATED
 * terms contribute only the whole term.
 *
 * Splitting hyphens here is a trap: "no-salt-added" would contribute the word
 * "salt", and a bare "salt" row — the single most common ingredient in the
 * library, 624 occurrences — would then be discarded as a qualifier and match
 * nothing at all.
 */
const QUALIFIER_SET = new Set(LEADING_QUALIFIERS.flatMap((q) => [q, ...q.split(' ')]))

/**
 * Words that mark a comma segment as commentary but must never be stripped as
 * a LEADING qualifier, because they are part of canonical names ("fresh basil",
 * "ground cumin", "dried oregano").
 */
const SEGMENT_ONLY_WORDS = new Set([
  'fresh', 'freshly', 'dried', 'ground', 'optional', 'divided', 'melted', 'softened',
  'beaten', 'unsalted', 'salted', 'rinsed', 'drained', 'crushed', 'grated', 'toasted',
  'plus', 'more', 'pan', 'filling', 'dough', 'dusting', 'assembly', 'each', 'about',
])

/**
 * Measure words that trail an ingredient name ("cilantro sprigs", "celery
 * ribs", "lemongrass stalks"). Dropping the last word yields the food itself.
 */
const TRAILING_UNIT_NOUNS = new Set([
  'sprig', 'sprigs', 'stalk', 'stalks', 'rib', 'ribs', 'bunch', 'bunches',
  'head', 'heads', 'ear', 'ears', 'clove', 'cloves', 'leaf', 'leaves',
  'fillet', 'fillets', 'stem', 'stems', 'pod', 'pods', 'sprigs',
])

/**
 * Never ingredients — equipment and consumables the seeder listed alongside
 * food. They must be SKIPPED, not reported unmatched, or they pollute the
 * backfill's review list and would count as "extras" in search ranking.
 */
const NON_FOOD = [
  'skewer', 'twine', 'toothpick', 'parchment', 'foil', 'cheesecloth', 'plastic wrap',
  'banana leaf', 'banana leaves', 'paper towel', 'muslin', 'string',
]

/** Irregular plurals the -s/-es/-ies rules would get wrong. */
const IRREGULAR_SINGULARS: Record<string, string> = {
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  potatoes: 'potato',
  tomatoes: 'tomato',
  mangoes: 'mango',
  chilies: 'chili',
  chillies: 'chili',
  chilis: 'chili',
  anchovies: 'anchovy',
  berries: 'berry',
  cherries: 'cherry',
  // Mass nouns whose "singular" is not a word. Everything else is left to the
  // -s/-es/-ies rules: an already-plural canonical row ("sesame seeds",
  // "black beans") matches at its own cascade level before singularization is
  // ever tried, so protecting those here would only block useful rewrites like
  // "cumin seeds" -> "cumin seed".
  molasses: 'molasses',
  greens: 'greens',
  grits: 'grits',
  couscous: 'couscous',
  hummus: 'hummus',
  asparagus: 'asparagus',
}

/** Singularize the LAST word only — "garlic cloves" -> "garlic clove". */
function singularizeLastWord(phrase: string): string {
  const words = phrase.split(' ')
  const last = words.at(-1)
  if (!last || last.length < 3) return phrase

  const irregular = IRREGULAR_SINGULARS[last]
  if (irregular !== undefined) {
    if (irregular === last) return phrase
    words[words.length - 1] = irregular
    return words.join(' ')
  }

  let singular = last
  if (/[^aeiou]ies$/.test(last)) singular = last.slice(0, -3) + 'y'
  else if (/(ch|sh|ss|x|z)es$/.test(last)) singular = last.slice(0, -2)
  else if (/[^s]s$/.test(last)) singular = last.slice(0, -1)
  else return phrase

  words[words.length - 1] = singular
  return words.join(' ')
}

/**
 * Explicit alias table — the semantic jumps no mechanical rule can make.
 * Keys are already-cleaned lowercase phrases; values are canonical slugs.
 * Anything reachable by stripping or singularizing alone is deliberately NOT
 * listed here, to keep this table about meaning rather than spelling.
 */
export const INGREDIENT_ALIASES: Record<string, string> = {
  // --- staples: salt, water, sugar, pepper, fat ---
  salt: 'salt',
  'sea salt': 'salt',
  'fine sea salt': 'salt',
  'coarse sea salt': 'salt',
  'flaky sea salt': 'salt',
  'fine salt': 'salt',
  'coarse salt': 'salt',
  'table salt': 'salt',
  'kosher salt': 'salt',
  'rock salt': 'salt',
  'pickling salt': 'salt',
  'salt and black pepper': 'salt',
  'salt and pepper': 'salt',
  'salt and freshly ground black pepper': 'salt',

  water: 'water',
  'ice water': 'water',
  'ice cube': 'water',
  ice: 'water',
  'boiling water': 'water',
  'lukewarm water': 'water',
  'tepid water': 'water',
  'filtered water': 'water',
  'sparkling water': 'water',
  'soda water': 'water',

  sugar: 'granulated-sugar',
  'white sugar': 'granulated-sugar',
  'caster sugar': 'granulated-sugar',
  'superfine sugar': 'granulated-sugar',
  'cane sugar': 'granulated-sugar',
  'raw sugar': 'granulated-sugar',
  'turbinado sugar': 'granulated-sugar',
  'demerara sugar': 'granulated-sugar',
  'confectioners sugar': 'powdered-sugar',
  "confectioners' sugar": 'powdered-sugar',
  'icing sugar': 'powdered-sugar',
  'light brown sugar': 'brown-sugar',
  'dark brown sugar': 'brown-sugar',
  'palm sugar': 'brown-sugar',
  jaggery: 'brown-sugar',

  pepper: 'black-pepper',
  peppercorn: 'black-pepper',
  'black peppercorn': 'black-pepper',
  'whole black peppercorn': 'black-pepper',
  'cracked black pepper': 'black-pepper',
  'ground black pepper': 'black-pepper',
  'freshly ground pepper': 'black-pepper',

  oil: 'vegetable-oil',
  'cooking oil': 'vegetable-oil',
  'neutral oil': 'vegetable-oil',
  'frying oil': 'vegetable-oil',
  'neutral cooking oil': 'vegetable-oil',
  'corn oil': 'vegetable-oil',
  'safflower oil': 'vegetable-oil',
  'rice bran oil': 'vegetable-oil',
  'extra-virgin olive oil': 'extra-virgin-olive-oil',
  'evoo': 'extra-virgin-olive-oil',
  'sesame oil': 'toasted-sesame-oil',
  'mustard oil': 'vegetable-oil',
  shortening: 'vegetable-shortening',

  butter: 'butter',
  'clarified butter': 'ghee',

  flour: 'all-purpose-flour',
  'plain flour': 'all-purpose-flour',
  'ap flour': 'all-purpose-flour',
  '00 flour': 'all-purpose-flour',
  'self-raising flour': 'all-purpose-flour',
  'self-rising flour': 'all-purpose-flour',

  // --- eggs and dairy ---
  egg: 'egg',
  'egg yolk': 'egg',
  'egg white': 'egg',
  'whole egg': 'egg',
  'beaten egg': 'egg',
  'egg wash': 'egg',
  milk: 'whole-milk',
  'full-fat milk': 'whole-milk',
  'warm milk': 'whole-milk',
  cream: 'heavy-cream',
  'heavy whipping cream': 'heavy-cream',
  'double cream': 'heavy-cream',
  'whipping cream': 'heavy-cream',
  'thickened cream': 'heavy-cream',
  yogurt: 'plain-yogurt',
  curd: 'plain-yogurt',
  'natural yogurt': 'plain-yogurt',
  'whole milk yogurt': 'plain-yogurt',
  mozzarella: 'fresh-mozzarella',
  parmesan: 'parmesan-cheese',
  'parmigiano-reggiano': 'parmesan-cheese',
  'pecorino romano': 'parmesan-cheese',
  cheddar: 'cheddar-cheese',
  feta: 'feta-cheese',
  gruyere: 'gruyere-cheese',
  paneer: 'cottage-cheese',

  // --- aromatics ---
  'garlic clove': 'garlic',
  'clove of garlic': 'garlic',
  'clove garlic': 'garlic',
  'garlic bulb': 'garlic',
  'head of garlic': 'garlic',
  'minced garlic': 'garlic',
  'crushed garlic': 'garlic',
  'garlic paste': 'garlic',
  'ginger garlic paste': 'garlic',
  'garlic-ginger paste': 'garlic',

  'yellow onion': 'onion',
  'white onion': 'onion',
  'brown onion': 'onion',
  'spanish onion': 'onion',
  'sweet onion': 'onion',
  'vidalia onion': 'onion',
  'pearl onion': 'onion',

  scallion: 'green-onion',
  'spring onion': 'green-onion',

  'fresh ginger': 'ginger',
  'ginger root': 'ginger',
  'ginger paste': 'ginger',
  'ginger powder': 'ground-ginger',

  // --- citrus: juice, zest and wedges are all the fruit ---
  'lemon juice': 'lemon',
  'lemon zest': 'lemon',
  'lemon wedge': 'lemon',
  'lemon slice': 'lemon',
  'lemon rind': 'lemon',
  'lime juice': 'lime',
  'lime zest': 'lime',
  'lime wedge': 'lime',
  'lime slice': 'lime',
  'orange juice': 'orange',
  'orange zest': 'orange',
  'orange wedge': 'orange',

  // --- herbs: one row per herb, dried or fresh ---
  thyme: 'fresh-thyme',
  'dried thyme': 'fresh-thyme',
  'thyme sprig': 'fresh-thyme',
  'thyme leaf': 'fresh-thyme',
  basil: 'fresh-basil',
  'dried basil': 'fresh-basil',
  'basil leaf': 'fresh-basil',
  'thai basil': 'fresh-basil',
  rosemary: 'fresh-rosemary',
  'dried rosemary': 'fresh-rosemary',
  'rosemary sprig': 'fresh-rosemary',
  parsley: 'fresh-parsley',
  'dried parsley': 'fresh-parsley',
  'flat-leaf parsley': 'fresh-parsley',
  'italian parsley': 'fresh-parsley',
  'parsley leaf': 'fresh-parsley',
  cilantro: 'fresh-cilantro',
  coriander: 'ground-coriander',
  'fresh coriander': 'fresh-cilantro',
  'coriander leaf': 'fresh-cilantro',
  'cilantro leaf': 'fresh-cilantro',
  'cilantro stem': 'fresh-cilantro',
  'dried cilantro': 'fresh-cilantro',
  'dried coriander leaf': 'fresh-cilantro',
  dill: 'fresh-dill',
  'dried dill': 'fresh-dill',
  'dill sprig': 'fresh-dill',
  'dill weed': 'fresh-dill',
  mint: 'fresh-mint',
  'dried mint': 'fresh-mint',
  'mint leaf': 'fresh-mint',
  'spearmint': 'fresh-mint',
  sage: 'fresh-sage',
  'dried sage': 'fresh-sage',
  'sage leaf': 'fresh-sage',
  oregano: 'dried-oregano',
  'fresh oregano': 'dried-oregano',
  'dried marjoram': 'marjoram',
  'dried tarragon': 'tarragon',
  'fresh tarragon': 'tarragon',
  'fresh chives': 'chives',
  'bay leaf': 'bay-leaf',
  'dried bay leaf': 'bay-leaf',
  'fresh bay leaf': 'bay-leaf',

  // --- spices: one row per spice, whole or ground ---
  cumin: 'ground-cumin',
  'cumin seed': 'ground-cumin',
  'whole cumin': 'ground-cumin',
  'coriander seed': 'ground-coriander',
  cinnamon: 'ground-cinnamon',
  'cinnamon stick': 'ground-cinnamon',
  'ceylon cinnamon': 'ground-cinnamon',
  cassia: 'ground-cinnamon',
  clove: 'ground-cloves',
  cloves: 'ground-cloves',
  'whole cloves': 'ground-cloves',
  'whole clove': 'ground-cloves',
  nutmeg: 'nutmeg',
  'ground nutmeg': 'nutmeg',
  'whole nutmeg': 'nutmeg',
  allspice: 'allspice',
  'ground allspice': 'allspice',
  'allspice berry': 'allspice',
  cardamom: 'cardamom',
  'ground cardamom': 'cardamom',
  'green cardamom': 'cardamom',
  'cardamom pod': 'cardamom',
  'black cardamom': 'cardamom',
  turmeric: 'turmeric',
  'ground turmeric': 'turmeric',
  'turmeric powder': 'turmeric',
  'fresh turmeric': 'turmeric',
  paprika: 'paprika',
  'sweet paprika': 'paprika',
  'hungarian paprika': 'paprika',
  'hot paprika': 'paprika',
  cayenne: 'cayenne-pepper',
  'ground cayenne': 'cayenne-pepper',
  'red chili powder': 'chili-powder',
  'red chilli powder': 'chili-powder',
  'kashmiri chili powder': 'chili-powder',
  'chilli powder': 'chili-powder',
  'chili flakes': 'red-pepper-flakes',
  'dried chili flakes': 'red-pepper-flakes',
  'crushed red pepper': 'red-pepper-flakes',
  'crushed red pepper flakes': 'red-pepper-flakes',
  'saffron thread': 'saffron',
  'fennel seed': 'fennel-seeds',
  'mustard seed': 'mustard-seeds',
  'black mustard seed': 'mustard-seeds',
  'celery seed': 'celery-seeds',
  'caraway seed': 'caraway-seeds',
  'star anise pod': 'star-anise',
  'garam masala powder': 'garam-masala',
  'curry powder': 'curry-powder',
  "za'atar": 'zaatar',
  'old bay': 'old-bay-seasoning',
  'italian herbs': 'italian-seasoning',
  'chinese five-spice': 'five-spice-powder',
  'five spice powder': 'five-spice-powder',
  'white peppercorn': 'white-pepper',
  'ground white pepper': 'white-pepper',

  // --- produce ---
  'cherry tomatoes': 'cherry-tomato',
  'grape tomato': 'cherry-tomato',
  'roma tomato': 'tomato',
  'plum tomato': 'tomato',
  'vine tomato': 'tomato',
  'russet potato': 'potato',
  'yukon gold potato': 'potato',
  'waxy potato': 'potato',
  'starchy potato': 'potato',
  'new potato': 'potato',
  'red potato': 'potato',
  'yam': 'sweet-potato',
  'celery rib': 'celery',
  'celery stalk': 'celery',
  'green bell pepper': 'bell-pepper',
  'red bell pepper': 'bell-pepper',
  'yellow bell pepper': 'bell-pepper',
  'orange bell pepper': 'bell-pepper',
  'capsicum': 'bell-pepper',
  jalapeño: 'jalapeno',
  'green chili': 'serrano-pepper',
  'green chilli': 'serrano-pepper',
  "bird's eye chili": 'serrano-pepper',
  'thai chili': 'serrano-pepper',
  'button mushroom': 'cremini-mushroom',
  'white mushroom': 'cremini-mushroom',
  mushroom: 'cremini-mushroom',
  'baby spinach': 'spinach',
  'frozen spinach': 'spinach',
  cabbage: 'green-cabbage',
  aubergine: 'eggplant',
  courgette: 'zucchini',
  'corn kernel': 'sweet-corn',
  'frozen corn': 'sweet-corn',
  corn: 'sweet-corn',
  'frozen pea': 'snap-peas',
  'green pea': 'snap-peas',
  peas: 'snap-peas',
  'frozen peas': 'snap-peas',

  // --- proteins ---
  'chicken thighs': 'chicken-thigh',
  'chicken breasts': 'chicken-breast',
  'chicken drumstick': 'chicken-thigh',
  'chicken leg': 'chicken-thigh',
  'chicken wing': 'whole-chicken',
  'beef chuck': 'beef-chuck-roast',
  'stewing beef': 'beef-chuck-roast',
  'stew meat': 'beef-chuck-roast',
  'beef mince': 'ground-beef',
  'minced beef': 'ground-beef',
  'lamb shoulder': 'lamb-chop',
  'lamb shank': 'lamb-chop',
  'pork belly': 'pork-shoulder',
  'pork butt': 'pork-shoulder',
  'boston butt': 'pork-shoulder',
  'pork loin chop': 'pork-chop',
  'streaky bacon': 'bacon',
  pancetta: 'bacon',
  'salt pork': 'bacon',

  // --- pantry / condiments ---
  'light soy sauce': 'soy-sauce',
  'dark soy sauce': 'soy-sauce',
  'low-sodium soy sauce': 'soy-sauce',
  'shoyu': 'soy-sauce',
  'chicken stock': 'chicken-broth',
  'chicken bouillon': 'chicken-broth',
  'beef stock': 'beef-broth',
  'vegetable stock': 'vegetable-broth',
  'canned tomato': 'crushed-tomatoes',
  'diced tomato': 'crushed-tomatoes',
  'canned crushed tomato': 'crushed-tomatoes',
  'whole peeled tomato': 'crushed-tomatoes',
  'tomato puree': 'tomato-paste',
  'tomato passata': 'crushed-tomatoes',
  'tomato sauce': 'marinara-sauce',
  'distilled white vinegar': 'white-vinegar',
  'white vinegar': 'white-vinegar',
  vinegar: 'white-vinegar',
  'malt vinegar': 'white-vinegar',
  'black vinegar': 'rice-vinegar',
  'rice wine vinegar': 'rice-vinegar',
  'seasoned rice vinegar': 'rice-vinegar',
  'olive': 'kalamata-olives',
  'green olive': 'kalamata-olives',
  'black olive': 'kalamata-olives',
  'pickle': 'dill-pickles',
  'breadcrumb': 'panko-breadcrumbs',
  'dried breadcrumb': 'panko-breadcrumbs',
  'corn starch': 'cornstarch',

  // --- grains ---
  'long-grain white rice': 'white-rice',
  'short-grain rice': 'white-rice',
  'long-grain rice': 'white-rice',
  'sushi rice': 'white-rice',
  rice: 'white-rice',
  'glutinous rice': 'white-rice',
  'rice noodle': 'rice-noodles',
  'egg noodle': 'egg-noodles',
  'wheat noodle': 'udon-noodles',
  pasta: 'penne-pasta',
  'dried pasta': 'penne-pasta',
  'oats': 'rolled-oats',
  'porridge oats': 'rolled-oats',
  'old-fashioned oats': 'rolled-oats',
  'tortilla': 'corn-tortilla',

  // --- legumes / nuts ---
  chickpea: 'chickpeas',
  'garbanzo bean': 'chickpeas',
  'canned chickpea': 'chickpeas',
  'dried chickpea': 'chickpeas',
  'red lentil': 'red-lentils',
  'brown lentil': 'brown-lentils',
  'green lentil': 'green-lentils',
  lentil: 'brown-lentils',
  'black bean': 'black-beans',
  'kidney bean': 'kidney-beans',
  'red bean': 'kidney-beans',
  'pinto bean': 'pinto-beans',
  'navy bean': 'navy-beans',
  'cannellini bean': 'cannellini-beans',
  'great northern bean': 'cannellini-beans',
  'white bean': 'cannellini-beans',
  'butter bean': 'lima-beans',
  'lima bean': 'lima-beans',
  'black-eyed pea': 'black-eyed-peas',
  tofu: 'firm-tofu',
  'extra-firm tofu': 'firm-tofu',
  'sesame seed': 'sesame-seeds',
  'toasted sesame seed': 'sesame-seeds',
  'white sesame seed': 'sesame-seeds',
  'black sesame seed': 'sesame-seeds',
  'pumpkin seed': 'pumpkin-seeds',
  pepita: 'pumpkin-seeds',
  'sunflower seed': 'sunflower-seeds',
  'chia seed': 'chia-seeds',
  'flax seed': 'flax-seeds',
  'poppy seed': 'poppy-seeds',
  'desiccated coconut': 'shredded-coconut',
  'coconut flake': 'shredded-coconut',
  'canned coconut milk': 'coconut-milk',
  'light coconut milk': 'coconut-milk',

  // --- baking ---
  'vanilla essence': 'vanilla-extract',
  'vanilla bean': 'vanilla-extract',
  'vanilla pod': 'vanilla-extract',
  'dried yeast': 'active-dry-yeast',
  'yeast': 'active-dry-yeast',
  'fast-action yeast': 'instant-yeast',
  'bicarbonate of soda': 'baking-soda',
  'unsweetened cocoa powder': 'cocoa-powder',
  'dutch-process cocoa': 'cocoa-powder',
  'semisweet chocolate': 'dark-chocolate',
  'bittersweet chocolate': 'dark-chocolate',
  'chocolate chip': 'chocolate-chips',
  'golden syrup': 'corn-syrup',
  'golden raisin': 'raisins',
  sultana: 'raisins',
  currant: 'raisins',

  // --- seafood ---
  prawn: 'shrimp',
  'king prawn': 'shrimp',
  'tiger prawn': 'shrimp',
  'salmon fillet': 'salmon',
  'tuna steak': 'tuna',
  'cod fillet': 'cod',
  'catfish fillet': 'catfish',
  'tilapia fillet': 'tilapia',
  'white fish': 'cod',
  'white fish fillet': 'cod',
  'firm white fish': 'cod',
  'anchovy fillet': 'anchovies',
  'anchovy': 'anchovies',
}

/**
 * Ingredients the library corpus needs that the ~364-row seeded table does not
 * have. Curated deliberately and kept SMALL: the backfill creates exactly
 * these rows and nothing else. Letting it create a row per unmatched string
 * would mint ~4,400 junk ingredients out of the long tail.
 *
 * These rows are created with no description, so the public glossary filters
 * them out until scripts/seed-ingredient-ai.ts writes their prose.
 */
export const ADDITIONAL_INGREDIENTS: { name: string; category: string }[] = [
  { name: 'salt', category: 'spices' },
  { name: 'water', category: 'condiments' },
  { name: 'white vinegar', category: 'condiments' },
  { name: 'nutmeg', category: 'spices' },
  { name: 'allspice', category: 'spices' },
  { name: 'cardamom', category: 'spices' },
  { name: 'turmeric', category: 'spices' },
  { name: 'paprika', category: 'spices' },
  { name: 'saffron', category: 'spices' },
  { name: 'marjoram', category: 'spices' },
  { name: 'tarragon', category: 'spices' },
  { name: 'chives', category: 'spices' },
  { name: 'bean sprouts', category: 'produce' },
  { name: 'tamarind paste', category: 'condiments' },
  { name: 'dry white wine', category: 'condiments' },
  { name: 'dry red wine', category: 'condiments' },
  { name: 'rice flour', category: 'grains' },
  { name: 'rose water', category: 'baking' },
  { name: 'berbere', category: 'spices' },
  { name: 'raisins', category: 'produce' },

  // The seeded corpus is US-pantry shaped, but the library spans 50 cuisines.
  // These are genuinely distinct ingredients its long tail keeps asking for —
  // added deliberately rather than minted from unmatched strings.
  { name: 'fenugreek', category: 'spices' },
  { name: 'curry leaves', category: 'spices' },
  { name: 'pandan leaves', category: 'spices' },
  { name: 'kaffir lime leaves', category: 'spices' },
  { name: 'lemongrass', category: 'spices' },
  { name: 'galangal', category: 'produce' },
  { name: 'nigella seeds', category: 'spices' },
  { name: 'anise seeds', category: 'spices' },
  { name: 'juniper berries', category: 'spices' },
  { name: 'annatto', category: 'spices' },
  { name: 'gochugaru', category: 'spices' },
  { name: 'dried chiles', category: 'spices' },
  { name: 'candlenuts', category: 'nuts-seeds' },
  { name: 'tomatillos', category: 'produce' },
  { name: 'plantains', category: 'produce' },
  { name: 'sauerkraut', category: 'produce' },
  { name: 'pomegranate seeds', category: 'produce' },
  { name: 'shrimp paste', category: 'condiments' },
  { name: 'doubanjiang', category: 'condiments' },
  { name: 'kecap manis', category: 'condiments' },
  { name: 'curry paste', category: 'condiments' },
  { name: 'tamarind concentrate', category: 'condiments' },
  { name: 'sake', category: 'condiments' },
  { name: 'bouillon powder', category: 'condiments' },
  { name: 'rice vermicelli', category: 'grains' },
  { name: 'phyllo dough', category: 'grains' },
  { name: 'monterey jack cheese', category: 'dairy' },
  { name: 'crusty bread', category: 'grains' },
  { name: 'sweet potato starch', category: 'baking' },
  { name: 'sausage', category: 'proteins' },
  { name: 'chicken liver', category: 'proteins' },
  { name: 'queso fresco', category: 'dairy' },
  { name: 'elbow macaroni', category: 'grains' },
  { name: 'celery root', category: 'produce' },
  { name: 'jicama', category: 'produce' },
  { name: 'cassava', category: 'produce' },
  { name: 'grape leaves', category: 'produce' },
  { name: 'prunes', category: 'produce' },
  { name: 'apricot jam', category: 'condiments' },
  { name: 'refried beans', category: 'legumes' },
  { name: 'barberries', category: 'produce' },
  { name: 'cajun seasoning', category: 'spices' },
  { name: 'green tea', category: 'condiments' },
  { name: 'rose petals', category: 'spices' },
  { name: 'pineapple juice', category: 'produce' },
]

/** Aliases that point at the rows above, kept next to their declaration. */
const ADDITIONAL_ALIASES: Record<string, string> = {
  'white wine': 'dry-white-wine',
  'dry sherry': 'dry-white-wine',
  'shaoxing wine': 'dry-white-wine',
  'rice wine': 'dry-white-wine',
  'cooking wine': 'dry-white-wine',
  'red wine': 'dry-red-wine',
  'berbere spice blend': 'berbere',
  'berbere spice': 'berbere',
  'berbere spice mix': 'berbere',
  'bean sprout': 'bean-sprouts',
  rosewater: 'rose-water',
  'golden raisin': 'raisins',
  raisin: 'raisins',
  sultana: 'raisins',
  currant: 'raisins',

  // Powder / seed / leaf forms of the additions above — one row per spice.
  'fenugreek seed': 'fenugreek',
  'ground fenugreek': 'fenugreek',
  'fenugreek leaf': 'fenugreek',
  'dried fenugreek leaf': 'fenugreek',
  'kasuri methi': 'fenugreek',
  methi: 'fenugreek',
  'curry leaf': 'curry-leaves',
  'pandan leaf': 'pandan-leaves',
  'kaffir lime leaf': 'kaffir-lime-leaves',
  'makrut lime leaf': 'kaffir-lime-leaves',
  'lemongrass stalk': 'lemongrass',
  'nigella seed': 'nigella-seeds',
  'anise seed': 'anise-seeds',
  'juniper berry': 'juniper-berries',
  achiote: 'annatto',
  'ground achiote': 'annatto',
  'annatto seed': 'annatto',
  'korean red pepper flake': 'gochugaru',
  'korean chili flake': 'gochugaru',
  'dried guajillo chile': 'dried-chiles',
  'dried ancho chile': 'dried-chiles',
  'guajillo chile': 'dried-chiles',
  'ancho chile': 'dried-chiles',
  'chipotle chile': 'dried-chiles',
  'dried chile': 'dried-chiles',
  'dried red chile': 'dried-chiles',
  candlenut: 'candlenuts',
  tomatillo: 'tomatillos',
  plantain: 'plantains',
  'green plantain': 'plantains',
  'pomegranate seed': 'pomegranate-seeds',
  belacan: 'shrimp-paste',
  'fermented shrimp paste': 'shrimp-paste',
  'sichuan doubanjiang': 'doubanjiang',
  'fermented broad bean paste': 'doubanjiang',
  'chili bean paste': 'doubanjiang',
  'massaman curry paste': 'curry-paste',
  'red curry paste': 'curry-paste',
  'green curry paste': 'curry-paste',
  'yellow curry paste': 'curry-paste',
  'aji amarillo paste': 'curry-paste',
  'tamarind pulp': 'tamarind-paste',
  'bouillon cube': 'bouillon-powder',
  'stock cube': 'bouillon-powder',
  'rice vermicelli noodle': 'rice-vermicelli',
  'bee hoon': 'rice-vermicelli',
  'phyllo pastry': 'phyllo-dough',
  'filo dough': 'phyllo-dough',
  'monterey jack': 'monterey-jack-cheese',
  'jack cheese': 'monterey-jack-cheese',

  // Powder forms of already-canonical spices.
  'coriander powder': 'ground-coriander',
  'cumin powder': 'ground-cumin',
  'cinnamon powder': 'ground-cinnamon',
  'cardamom powder': 'cardamom',
  'garlic powder': 'garlic-powder',
  'onion powder': 'onion-powder',
  'ginger-garlic paste': 'garlic',
  'garlic ginger paste': 'garlic',
  'niter kibbeh': 'ghee',
  'crayfish': 'shrimp',
  'ground crayfish': 'shrimp',
  'pork fatback': 'bacon',
  'sweet pickle relish': 'dill-pickles',
  'oxtail': 'beef-chuck-roast',
  'smoked fish': 'smoked-salmon',
  brandy: 'dry-white-wine',
  cognac: 'dry-white-wine',
  'butter lettuce leaf': 'romaine-lettuce',
  'butter lettuce': 'romaine-lettuce',
  'dulce de leche': 'sweetened-condensed-milk',
  'andouille sausage': 'sausage',
  'pork sausage': 'sausage',
  'italian sausage': 'sausage',
  'chorizo': 'sausage',
  'kielbasa': 'sausage',
  'celeriac': 'celery-root',
  yuca: 'cassava',
  'grape leaf': 'grape-leaves',
  'brined grape leaf': 'grape-leaves',
  prune: 'prunes',
  'dried prune': 'prunes',
  barberry: 'barberries',
  zereshk: 'barberries',
  'dried barberry': 'barberries',
  'rose petal': 'rose-petals',
  'dried rose petal': 'rose-petals',
  'seasoning cube': 'bouillon-powder',
  'mexican blend cheese': 'monterey-jack-cheese',
  'pepper jack cheese': 'monterey-jack-cheese',
  'macaroni': 'elbow-macaroni',
}

const ALIASES: Record<string, string> = { ...INGREDIENT_ALIASES, ...ADDITIONAL_ALIASES }

/**
 * Pantry staples — present in essentially every kitchen, so they never count
 * as an "extra ingredient" when ranking search results.
 *
 * Deliberately CONSERVATIVE. Garlic, onion, butter and flour are *not* here:
 * they are things people actually search for, and treating them as free would
 * collapse most of the library into tier 0 and make the ranking meaningless.
 * Cedar to confirm — this is the one judgement call in the ranking.
 */
export const STAPLE_SLUGS: ReadonlySet<string> = new Set([
  'salt',
  'kosher-salt',
  'water',
  'black-pepper',
  'white-pepper',
  'vegetable-oil',
  'olive-oil',
  'extra-virgin-olive-oil',
  'canola-oil',
  'sunflower-oil',
  'grapeseed-oil',
  'granulated-sugar',
])

/**
 * Ingredients that make a recipe non-vegetarian. Derived from the ingredient
 * join rather than the 1,763-value tag long tail, which is unreliable.
 * `proteins` minus egg, all of `seafood`, plus the animal-derived condiments
 * and fats that hide in other categories.
 */
export const NON_VEGETARIAN_CATEGORIES: ReadonlySet<string> = new Set(['proteins', 'seafood'])
export const VEGETARIAN_EXCEPTIONS: ReadonlySet<string> = new Set(['egg'])
export const NON_VEGETARIAN_SLUGS: ReadonlySet<string> = new Set([
  'fish-sauce', 'oyster-sauce', 'worcestershire-sauce', 'anchovy-paste', 'dashi-stock',
  'chicken-broth', 'beef-broth', 'lard', 'duck-fat', 'gelatin',
])
/** Non-vegan on top of the above: dairy, egg, honey. Not yet exposed as a filter. */
export const NON_VEGAN_CATEGORIES: ReadonlySet<string> = new Set(['dairy'])
export const NON_VEGAN_SLUGS: ReadonlySet<string> = new Set(['egg', 'honey'])

/**
 * Word stems that mark a RAW ingredient string as meat or fish. Applied to
 * EVERY ingredient row in the vegetarian filter, matched and unmatched alike.
 *
 * Two reasons it cannot be limited to unmatched rows. An unmatched "guanciale"
 * is invisible to an id-based check at all. And for a row like "vegetable or
 * chicken broth" the matcher picks one option — whichever the author happened
 * to write first — so an id-only filter would call that recipe vegetarian
 * while "chicken or vegetable broth", the same dish, reads as not. Word order
 * in someone's prose must not decide a dietary result.
 *
 * Consequence, accepted deliberately: a recipe that offers a vegetarian
 * alternative is excluded from vegetarian results. That is a missed result,
 * which is the safe direction — the opposite error puts meat stock in front of
 * someone avoiding it.
 *
 * This is a filter, never a claim: it can only remove recipes from a
 * vegetarian view. Nothing here may ever be rendered as "free from" anything.
 *
 * Matched with a word-boundary regex, not a substring test, so "ham" does not
 * fire on "graham" and "crab" does not fire on "crab apple". Prefix stems like
 * "anchov" are intentional — they must still catch anchovy and anchovies.
 */
export const NON_VEGETARIAN_RAW_PATTERNS: readonly string[] = [
  'beef', 'pork', 'chicken', 'turkey', 'duck', 'lamb', 'mutton', 'veal', 'venison', 'bison',
  'rabbit', 'goat', 'quail', 'goose', 'bacon', 'ham', 'prosciutto', 'pancetta', 'guanciale',
  'sausage', 'chorizo', 'salami', 'pepperoni', 'andouille', 'kielbasa', 'meat', 'oxtail',
  'tripe', 'liver', 'gizzard', 'marrow', 'foie', 'lard', 'tallow', 'suet', 'gelatin',
  'fish', 'anchov', 'sardine', 'tuna', 'salmon', 'halibut', 'tilapia', 'trout', 'mackerel',
  'snapper', 'catfish', 'swordfish', 'shrimp', 'prawn', 'crab', 'lobster', 'crawfish',
  'scallop', 'mussel', 'clam', 'oyster', 'squid', 'octopus', 'calamari', 'caviar', 'roe',
  'dashi', 'bonito', 'katsuobushi', 'shellfish', 'seafood', 'escargot', 'snail',
  'worcestershire', 'belacan', 'nam pla',
]

/** A row whose name is really a section label, e.g. "For the köfte". */
const HEADING_RE = /^for\s+(the\s+)?\S/i

/** Strip accents so "jalapeño" and "jalapeno" are the same key. */
const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Clean a raw ingredient name into its comma segments, dropping the ones that
 * only describe rather than name. Returns segments rather than one string so
 * the cascade can also try the FIRST segment alone — the head ingredient is
 * almost always segment one, and the tail is prose the writer appended
 * ("oxtail, cut into 2-inch pieces"; "scallions, white parts only, smashed").
 */
function cleanSegments(raw: string): string[] {
  let s = deaccent(String(raw ?? '').toLowerCase())
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')

  // Parentheticals and bracketed asides are always commentary.
  s = s.replace(/\([^)]*\)?/g, ' ').replace(/\[[^\]]*\]?/g, ' ')

  // A leading quantity the seeder folded into the name ("2 cups flour").
  s = s.replace(/^[\d\s./¼½¾⅓⅔⅛-]+/, ' ')

  // A trailing purpose clause is never part of the name ("water for boiling",
  // "oil for deep-frying"). Anchored to the end so "cream of tartar" is safe.
  s = s.replace(/\s+for\s+[\w\s-]*$/, ' ')

  // Drop comma segments that only describe the ingredient rather than name it —
  // preparation ("garlic cloves, minced") or a trailing qualifier that the
  // writer moved after the noun ("butter, unsalted"; "beef broth, low-sodium").
  const tidy = (seg: string) =>
    seg
      .replace(/[^a-z0-9'\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  return s
    .split(',')
    .map(tidy)
    .filter((seg) => {
      if (!seg) return false
      const words = seg.split(' ').filter(Boolean)
      return !words.every((w) => {
        const bare = w.replace(/[^a-z-]/g, '')
        return PREP_WORDS.has(bare) || QUALIFIER_SET.has(bare) || SEGMENT_ONLY_WORDS.has(bare)
      })
    })
}

/** Remove one leading qualifier if present. Returns null when none applies. */
function stripOneQualifier(phrase: string): string | null {
  for (const q of LEADING_QUALIFIERS) {
    if (phrase.startsWith(q + ' ') && phrase.length > q.length + 1) {
      return phrase.slice(q.length + 1).trim()
    }
  }
  return null
}

/**
 * Every form of `raw` worth testing against the corpus, most specific first.
 * Exported for the backfill's unmatched-name report and for tests.
 */
export function candidateForms(raw: string): string[] {
  const segments = cleanSegments(raw)
  if (!segments.length) return []

  const out: string[] = []
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v)
  }

  // Whole phrase first, then the first segment alone. Order matters: a real
  // multi-segment name ("half and half") must win before the fallback trims it.
  const bases = segments.length > 1 ? [segments.join(' '), segments[0]] : [segments[0]]

  // "ghee or vegetable oil", "chicken or vegetable broth", "yukon gold or
  // russet potatoes" — each alternative is tried in written order. Taking only
  // the text before "or" fails the common shape where the head noun trails the
  // second alternative ("chicken" is not an ingredient; "vegetable broth" is).
  const alternatives = bases.flatMap((b) => {
    const parts = b.split(/\s+or\s+|\s*\/\s*/).map((a) => a.trim()).filter(Boolean)
    if (parts.length < 2) return parts

    // "canola or vegetable oil" and "chicken or vegetable broth" distribute a
    // shared head noun across both options: the first is "canola oil" and
    // "chicken broth", not the bare words "canola" and "chicken". Rebuild the
    // short options against the last option's head noun, and keep them in
    // written order so the author's first choice wins.
    //
    // Which option wins is a display and extras-counting decision only. It
    // deliberately does NOT decide dietary filtering, because the author's word
    // order is arbitrary — the vegetarian filter scans every raw string instead
    // (see NON_VEGETARIAN_RAW_PATTERNS).
    const head = parts.at(-1)!.split(' ')
    const headNoun = head.length > 1 ? head.at(-1)! : null
    if (!headNoun) return parts

    return parts.flatMap((p, i) =>
      i < parts.length - 1 && p.split(' ').length < head.length ? [`${p} ${headNoun}`, p] : [p],
    )
  })

  // Two passes. Every alternative's precise forms are exhausted before any
  // alternative's head-noun guess is tried — otherwise "ghee or vegetable oil"
  // reduces its first option to the bare word "oil" and resolves to vegetable
  // oil, never reaching the ghee the recipe actually leads with.
  for (const alt of alternatives) {
    // "cilantro sprigs" / "celery ribs" — the trailing measure word is not part
    // of the food's name. Tried after the full form, so "bay leaf" and
    // "curry leaves" still match themselves first.
    const w = alt.split(' ')
    const trimmedUnit =
      w.length > 1 && TRAILING_UNIT_NOUNS.has(w.at(-1)!) ? w.slice(0, -1).join(' ') : null

    for (const variant of [alt, trimmedUnit].filter(Boolean) as string[]) {
      let current: string | null = variant
      let guard = 0
      while (current && guard++ < 12) {
        push(current)
        push(singularizeLastWord(current))
        current = stripOneQualifier(current)
      }
    }
  }

  // Last resort: the final one or two words, usually the head noun
  // ("bone-in lamb shoulder" -> "lamb shoulder").
  for (const alt of alternatives) {
    const words = alt.split(' ')
    for (const n of [2, 1]) {
      if (words.length <= n) continue
      const tail = words.slice(-n).join(' ')
      push(tail)
      push(singularizeLastWord(tail))
    }
  }

  return out
}

export interface MatchResult {
  /** Canonical slug, or null when nothing in the corpus fits. */
  slug: string | null
  /** Which candidate form produced the hit — useful in the backfill report. */
  matchedOn: string | null
  /** True when the row is a section label rather than an ingredient. */
  isHeading: boolean
  /** True when the row is equipment (skewers, twine) rather than food. */
  isNonFood: boolean
}

/**
 * Resolve one raw ingredient string to a canonical slug.
 *
 * `canonicalSlugs` is the live set from the database (including any
 * ADDITIONAL_INGREDIENTS already created), so this stays honest about what
 * actually exists rather than trusting a hardcoded list.
 */
export function matchIngredient(raw: string, canonicalSlugs: ReadonlySet<string>): MatchResult {
  const name = String(raw ?? '').trim()
  const miss = { slug: null, matchedOn: null, isHeading: false, isNonFood: false }
  if (!name) return miss

  // Section labels sometimes carry a bogus amount, so isIngredientHeading()'s
  // quantity check misses them. Position is the reliable signal either way.
  if (HEADING_RE.test(name)) return { ...miss, isHeading: true }

  const lower = deaccent(name.toLowerCase())
  if (NON_FOOD.some((k) => lower.includes(k))) return { ...miss, isNonFood: true }

  for (const form of candidateForms(name)) {
    const aliased = ALIASES[form]
    if (aliased && canonicalSlugs.has(aliased)) return { ...miss, slug: aliased, matchedOn: form }

    const direct = slugifyIngredient(form)
    if (canonicalSlugs.has(direct)) return { ...miss, slug: direct, matchedOn: form }
  }

  return miss
}
