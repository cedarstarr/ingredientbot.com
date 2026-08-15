/**
 * @description AI-generated ingredient encyclopedia seeder. Prose fields (description, storage, seasonality) via ai-batch defaults; allergen-bearing fields (allergenProfile, hiddenSources, crossContamination, substitutions) via scripts/lib/allergen-verify.ts on the same paid Azure model (single-model as of 2026-08-05 — NOT verified; the allergen disclaimer must render wherever they are shown). Idempotent on slug.
 * @tables ingredients
 *
 * Usage:
 *   npx tsx scripts/seed-ingredient-ai.ts               # all ~360 default ingredients
 *   npx tsx scripts/seed-ingredient-ai.ts --count 10    # first 10
 *   npx tsx scripts/seed-ingredient-ai.ts --dry-run     # print the plan — NO AI calls, NO DB connection
 *
 * --dry-run is deliberately fully offline (unlike seed-recipes-ai.ts): the
 * allergen lane must never run casually, so the dry run only prints what WOULD
 * be generated and which env is required.
 *
 * Requires in /home/cedar/Projects/.env:
 *   AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY   (generation — no free-lane fallback for allergen fields)
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { z } from 'zod'

// ~360 common ingredients grouped by category. Slugs are derived from names.
const DEFAULT_INPUTS: Record<string, string[]> = {
  produce: [
    'apple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit', 'strawberry', 'blueberry', 'raspberry',
    'blackberry', 'grape', 'watermelon', 'cantaloupe', 'pineapple', 'mango', 'papaya', 'kiwi', 'peach',
    'nectarine', 'plum', 'apricot', 'cherry', 'pear', 'pomegranate', 'fig', 'date', 'cranberry', 'avocado',
    'tomato', 'cherry tomato', 'potato', 'sweet potato', 'carrot', 'celery', 'onion', 'red onion', 'shallot',
    'garlic', 'ginger', 'broccoli', 'cauliflower', 'brussels sprouts', 'green cabbage', 'red cabbage', 'kale',
    'spinach', 'arugula', 'romaine lettuce', 'iceberg lettuce', 'swiss chard', 'collard greens', 'zucchini',
    'yellow squash', 'butternut squash', 'acorn squash', 'pumpkin', 'cucumber', 'bell pepper', 'jalapeno',
    'serrano pepper', 'poblano pepper', 'habanero pepper', 'eggplant', 'cremini mushroom', 'portobello mushroom',
    'shiitake mushroom', 'oyster mushroom', 'asparagus', 'green beans', 'snap peas', 'snow peas', 'sweet corn',
    'beet', 'radish', 'turnip', 'parsnip', 'rutabaga', 'fennel', 'leek', 'green onion', 'artichoke', 'okra',
    'bok choy', 'napa cabbage', 'watercress', 'radicchio',
  ],
  proteins: [
    'chicken breast', 'chicken thigh', 'whole chicken', 'ground chicken', 'turkey breast', 'ground turkey',
    'beef sirloin', 'ribeye steak', 'flank steak', 'ground beef', 'beef chuck roast', 'beef brisket',
    'pork chop', 'pork tenderloin', 'pork shoulder', 'ground pork', 'bacon', 'ham', 'prosciutto',
    'lamb chop', 'ground lamb', 'leg of lamb', 'duck breast', 'veal cutlet', 'venison', 'bison', 'egg',
  ],
  dairy: [
    'whole milk', 'skim milk', 'heavy cream', 'half and half', 'buttermilk', 'butter', 'ghee', 'sour cream',
    'cream cheese', 'cottage cheese', 'ricotta', 'fresh mozzarella', 'cheddar cheese', 'parmesan cheese',
    'gruyere cheese', 'feta cheese', 'goat cheese', 'blue cheese', 'brie', 'swiss cheese', 'provolone',
    'plain yogurt', 'greek yogurt', 'kefir', 'evaporated milk',
  ],
  grains: [
    'all-purpose flour', 'whole wheat flour', 'bread flour', 'cake flour', 'semolina', 'cornmeal', 'corn flour',
    'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'arborio rice', 'wild rice', 'quinoa',
    'couscous', 'bulgur', 'farro', 'pearl barley', 'rolled oats', 'steel-cut oats', 'buckwheat', 'millet',
    'rye flour', 'spaghetti', 'penne pasta', 'egg noodles', 'rice noodles', 'soba noodles', 'udon noodles',
    'panko breadcrumbs', 'corn tortilla', 'flour tortilla', 'pita bread',
  ],
  'nuts-seeds': [
    'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia nut', 'brazil nut', 'pine nut',
    'peanut', 'peanut butter', 'almond butter', 'tahini', 'sesame seeds', 'chia seeds', 'flax seeds',
    'pumpkin seeds', 'sunflower seeds', 'hemp seeds', 'poppy seeds', 'coconut', 'shredded coconut',
    'coconut milk', 'coconut cream',
  ],
  legumes: [
    'chickpeas', 'black beans', 'kidney beans', 'pinto beans', 'navy beans', 'cannellini beans', 'lima beans',
    'mung beans', 'brown lentils', 'red lentils', 'green lentils', 'split peas', 'black-eyed peas', 'edamame',
    'firm tofu', 'silken tofu', 'tempeh', 'soy milk', 'miso paste',
  ],
  condiments: [
    'soy sauce', 'tamari', 'fish sauce', 'oyster sauce', 'hoisin sauce', 'worcestershire sauce', 'sriracha',
    'gochujang', 'sambal oelek', 'harissa paste', 'ketchup', 'yellow mustard', 'dijon mustard',
    'whole grain mustard', 'mayonnaise', 'barbecue sauce', 'teriyaki sauce', 'ponzu', 'mirin', 'rice vinegar',
    'apple cider vinegar', 'balsamic vinegar', 'red wine vinegar', 'white wine vinegar', 'hot sauce',
    'salsa', 'basil pesto', 'marinara sauce', 'tomato paste', 'crushed tomatoes', 'capers', 'kalamata olives',
    'dill pickles', 'horseradish', 'wasabi', 'anchovy paste', 'dashi stock', 'chicken broth', 'vegetable broth',
    'beef broth',
  ],
  baking: [
    'granulated sugar', 'brown sugar', 'powdered sugar', 'honey', 'maple syrup', 'molasses', 'agave nectar',
    'corn syrup', 'baking soda', 'baking powder', 'active dry yeast', 'instant yeast', 'cream of tartar',
    'vanilla extract', 'almond extract', 'cocoa powder', 'dark chocolate', 'milk chocolate', 'white chocolate',
    'chocolate chips', 'gelatin', 'cornstarch', 'arrowroot powder', 'tapioca starch', 'marshmallow',
    'sweetened condensed milk',
  ],
  spices: [
    'kosher salt', 'black pepper', 'white pepper', 'cayenne pepper', 'red pepper flakes', 'paprika',
    'smoked paprika', 'chili powder', 'ground cumin', 'ground coriander', 'turmeric', 'curry powder',
    'garam masala', 'ground cinnamon', 'nutmeg', 'ground cloves', 'allspice', 'cardamom', 'star anise',
    'fennel seeds', 'mustard seeds', 'celery seeds', 'caraway seeds', 'bay leaf', 'dried oregano',
    'fresh basil', 'fresh thyme', 'fresh rosemary', 'fresh sage', 'fresh parsley', 'fresh cilantro',
    'fresh dill', 'fresh mint', 'tarragon', 'chives', 'marjoram', 'saffron', 'sumac', 'zaatar',
    'five-spice powder', 'old bay seasoning', 'italian seasoning', 'onion powder', 'garlic powder',
    'ground ginger',
  ],
  oils: [
    'olive oil', 'extra virgin olive oil', 'vegetable oil', 'canola oil', 'sunflower oil', 'peanut oil',
    'toasted sesame oil', 'coconut oil', 'avocado oil', 'grapeseed oil', 'lard', 'vegetable shortening',
    'duck fat',
  ],
  seafood: [
    'salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'trout', 'mackerel', 'sardines', 'anchovies', 'sea bass',
    'red snapper', 'catfish', 'swordfish', 'mahi mahi', 'shrimp', 'crab', 'lobster', 'crawfish', 'scallops',
    'mussels', 'clams', 'oysters', 'squid', 'octopus', 'smoked salmon', 'canned tuna',
  ],
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

interface IngredientInput {
  slug: string
  name: string
  category: string
}

const ALL_INPUTS: IngredientInput[] = Object.entries(DEFAULT_INPUTS).flatMap(([category, names]) =>
  names.map((name) => ({ slug: slugify(name), name, category })),
)

// Non-allergen prose only — allergen content NEVER comes from this schema.
const ProseSchema = z.object({
  description: z.string().describe('2-3 sentences: what it is, flavor, common uses'),
  storage: z.string().describe('One sentence on how to store it'),
  seasonality: z.string().describe('Peak season, or "year-round" for pantry staples'),
})

const PROSE_SYSTEM =
  'You write concise ingredient encyclopedia entries for a cooking app. Plain home-cook language, no filler. ' +
  'Never mention allergies or allergens — that content is handled by a separate verified pipeline.'

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  return {
    count: Number(get('--count') ?? ALL_INPUTS.length),
    dryRun: args.includes('--dry-run'),
  }
}

// Set only on real runs — dry-run never constructs a Prisma client.
let prismaRef: { $disconnect(): Promise<void> } | null = null

async function main() {
  const { count, dryRun } = parseArgs()
  const inputs = ALL_INPUTS.slice(0, count)

  if (dryRun) {
    // Fully offline by design: allergen generation must never run as a side
    // effect of a preview. No AI providers or DB are contacted.
    console.log(`Dry run — would seed ${inputs.length} ingredients (of ${ALL_INPUTS.length} defaults). No AI or DB calls made.`)
    const byCategory = new Map<string, number>()
    for (const i of inputs) byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + 1)
    for (const [cat, n] of byCategory) console.log(`  ${cat}: ${n}`)
    console.log('\nFirst 5:')
    for (const i of inputs.slice(0, 5)) console.log(`  ${i.slug} (${i.category})`)
    console.log(
      '\nReal run requires AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY (generation, incl. allergen fields).',
    )
    console.log('Prose fields use ai-batch defaults; allergen fields go through scripts/lib/allergen-verify.ts.')
    return
  }

  // Lazy imports so --dry-run never constructs a Prisma client or AI provider.
  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { batchObject } = await import('./lib/ai-batch')
  const { verifyIngredientAllergens, requireVerifierEnv, UNVERIFIED_NOTICE } = await import('./lib/allergen-verify')

  requireVerifierEnv() // fail closed before any generation

  console.log(`Seeding ${inputs.length} ingredients...`)
  let inserted = 0
  let skipped = 0
  let annotated = 0

  try {
    for (const [i, input] of inputs.entries()) {
      const existing = await prisma.ingredient.findUnique({ where: { slug: input.slug }, select: { id: true } })
      if (existing) {
        skipped++
        continue
      }

      const prose = await batchObject(
        `Write the encyclopedia entry for the ingredient: ${input.name} (category: ${input.category}).`,
        ProseSchema,
        // tier is explicit on purpose: visitor-facing encyclopedia prose belongs on the
        // quality lane. It was previously implicit via the lib default, which reads as
        // "nobody chose" rather than "quality was chosen" when auditing spend.
        { system: PROSE_SYSTEM, temperature: 0.5, tier: 'quality' },
      )

      const allergen = await verifyIngredientAllergens(input)
      annotated++

      await prisma.ingredient.create({
        data: {
          slug: input.slug,
          name: input.name,
          category: input.category,
          description: prose.description,
          storage: prose.storage,
          seasonality: prose.seasonality,
          allergenProfile: allergen.allergenProfile,
          hiddenSources: allergen.hiddenSources,
          crossContamination: allergen.crossContamination,
          substitutions: allergen.substitutions,
        },
      })
      inserted++
      console.log(`  [${i + 1}/${inputs.length}] ${input.slug}`)
    }
  } finally {
    console.log(
      `\nDone — inserted ${inserted}, skipped ${skipped} (existing), ${annotated} allergen-annotated.`,
    )
    console.log(UNVERIFIED_NOTICE)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prismaRef?.$disconnect().catch(() => undefined))
