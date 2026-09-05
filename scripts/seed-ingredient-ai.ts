/**
 * @description AI-generated ingredient encyclopedia seeder. Prose fields (description, storage, seasonality) and the allergen-bearing fields (allergenProfile, hiddenSources, crossContamination, substitutions) — the allergen fields come ONLY from a paid frontier model (single-model, NOT verified; the allergen disclaimer must render wherever they are shown). Model-driven mode creates missing DEFAULT_INPUTS rows (prose on the broker's DeepSeek seeding lane, allergens via scripts/lib/allergen-verify.ts — which has had no provider since Azure was removed on 2026-09-05). --from-file fills existing rows that have no description yet, from a JSON file written in-session by Claude Fable 5.1 and validated here against the same schemas. Idempotent on slug.
 * @tables ingredients
 *
 * Usage:
 *   npx tsx scripts/seed-ingredient-ai.ts --from-file scripts/data/ingredient-entries.json --dry-run   # validate the file + print the plan — NO DB connection
 *   npx tsx scripts/seed-ingredient-ai.ts --from-file scripts/data/ingredient-entries.json             # fill rows whose description IS NULL
 *   npx tsx scripts/seed-ingredient-ai.ts               # model-driven: all ~360 default ingredients
 *   npx tsx scripts/seed-ingredient-ai.ts --count 10    # model-driven: first 10
 *   npx tsx scripts/seed-ingredient-ai.ts --dry-run     # print the plan — NO AI calls, NO DB connection
 *
 * --dry-run is deliberately fully offline (unlike seed-recipes-ai.ts): the
 * allergen lane must never run casually, so the dry run only prints what WOULD
 * be generated and which env is required.
 *
 * --from-file is scoped to rows that exist but carry no description (the stubs
 * backfill-recipe-ingredients.ts creates so recipe links resolve — the public
 * glossary lists a row only once it has prose, so filling `description` is
 * what makes it visible). A row that already has a description is skipped, so
 * a re-run is a no-op; a slug with no row is reported and skipped. File shape:
 *   {
 *     "writtenBy": "<model or person>",   // provenance — required, echoed in the run log
 *     "writtenOn": "YYYY-MM-DD",
 *     "entries": [ { "slug", description, storage, seasonality,            // ProseSchema + the FOU-439 floor
 *                    allergens, mayContain, hiddenSources,                 // IngredientBundleSchema
 *                    crossContamination, substitutions } ]
 *   }
 * A failing entry is reported by slug and skipped — never written.
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
  IngredientBundleSchema,
  normalizeIngredientBundle,
  type IngredientAllergenResult,
} from './lib/allergen-verify'

// ~360 common ingredients grouped by category. Slugs are derived from names.
// Exported so the reverse-search alias vocabulary can be tested against the
// real corpus rather than a hand-copied list that drifts out of date.
export const DEFAULT_INPUTS: Record<string, string[]> = {
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
  'Never mention allergies or allergens — that content is handled by a separate verified pipeline. ' +
  // FOU-439: the ds deployment's json_schema mode is generate-then-parse — a straight " in prose truncates the field.
  'In prose, use curly quotes (\u201c \u201d) for any quoted phrase; never straight double quotes. The JSON delimiters themselves stay straight double quotes — the curly-quote rule applies only to text inside a field. ' +
  // FOU-441: Azure's content filter rejected the unframed "whole chicken" prompt outright (HTTP 400,
  // finish_reason content_filter, label MultiSeverity_ViolenceScore) because the model drifted into
  // butchery. Confining the entry to the kitchen clears the filter and is what the page wants anyway —
  // verified against the exact prompt that failed.
  'Write only about the ingredient as it appears in a kitchen or grocery store — its culinary character, how cooks use it, and how to keep it. ' +
  'Do not describe animal husbandry, slaughter, butchery or processing. ' +
  // The page renders description in a plain <p>, so markdown emphasis would show as literal asterisks.
  'Write plain text only — no markdown, no asterisks for emphasis, no headings.'

// FOU-439 net: a truncated-mid-phrase field is syntactically valid JSON and
// arrives silently. Floors are set well below honest minimums — they catch
// amputation, not brevity.
// A field carrying a brace is envelope debris, not prose: the model closed the JSON string
// with a curly quote and the generate-then-parse layer swallowed the delimiters into the value
// (2 of 364 rows on the 2026-08-28 ingredient run ended "…again.”}   {").
// The asterisks are the same class of leak: the page renders description in a plain <p>, so
// markdown emphasis shows as literal characters (4 of 364 rows).
const cleanProse = (v: string) => !/[{}*]/.test(v)

function validProse(p: z.infer<typeof ProseSchema>): boolean {
  return (
    p.description.trim().length >= 60 &&
    p.storage.trim().length >= 15 &&
    p.seasonality.trim().length >= 4 &&
    cleanProse(p.description) &&
    cleanProse(p.storage) &&
    cleanProse(p.seasonality)
  )
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  return {
    count: Number(get('--count') ?? ALL_INPUTS.length),
    dryRun: args.includes('--dry-run'),
    fromFile: get('--from-file'),
  }
}

// One file entry = the prose the ds lane would have written + the allergen
// bundle verifyIngredientAllergens() would have returned, keyed by slug.
const FileEntrySchema = ProseSchema.extend({ slug: z.string() }).merge(IngredientBundleSchema)

const FromFileSchema = z.object({
  writtenBy: z.string().min(1),
  writtenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(z.object({ slug: z.string() }).passthrough()),
})

type FileRow = { slug: string; prose: z.infer<typeof ProseSchema>; allergen: IngredientAllergenResult }

/** Parse + validate the file. Fully offline. Rejections are reported, never written, and never stop the rest. */
function loadFromFile(path: string) {
  const parsed = FromFileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
  if (!parsed.success) {
    throw new Error(
      `[--from-file] ${path} is not { writtenBy, writtenOn, entries[] } — provenance is required for allergen content:\n` +
        parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n'),
    )
  }
  const { writtenBy, writtenOn, entries } = parsed.data

  const valid: FileRow[] = []
  const rejected: { slug: string; reason: string }[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (seen.has(entry.slug)) {
      rejected.push({ slug: entry.slug, reason: 'duplicate slug in file — later copy ignored' })
      continue
    }
    seen.add(entry.slug)
    const result = FileEntrySchema.safeParse(entry)
    if (!result.success) {
      rejected.push({
        slug: entry.slug,
        reason: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
      })
      continue
    }
    const { slug, description, storage, seasonality, ...bundle } = result.data
    const prose = { description, storage, seasonality }
    if (!validProse(prose)) {
      rejected.push({ slug, reason: 'prose under the FOU-439 floor, or carries {, } or *' })
      continue
    }
    valid.push({ slug, prose, allergen: normalizeIngredientBundle(bundle) })
  }

  return { writtenBy, writtenOn, valid, rejected }
}

/**
 * --from-file run: fill existing description-less rows. Separate from the
 * model-driven loop below because it UPDATES stubs rather than CREATING rows.
 */
async function fillFromFile(path: string, dryRun: boolean) {
  const file = loadFromFile(path)
  console.log(`--from-file ${path}: written by ${file.writtenBy} on ${file.writtenOn}`)
  console.log(`  ${file.valid.length} valid entr${file.valid.length === 1 ? 'y' : 'ies'}, ${file.rejected.length} rejected`)
  for (const r of file.rejected) console.log(`  ✗ ${r.slug}: ${r.reason}`)

  if (dryRun) {
    console.log('\nDry run — no AI or DB calls made. A real run would, for each valid slug:')
    console.log('  - skip it if no ingredient row exists, or if the row already has a description;')
    console.log('  - otherwise write description / storage / seasonality and')
    console.log('    allergenProfile / hiddenSources / crossContamination / substitutions from the file.')
    console.log('  Valid slugs:')
    for (const row of file.valid) console.log(`    ${row.slug}  [${row.allergen.allergenProfile.join(', ') || '—'}]`)
    return
  }

  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { UNVERIFIED_NOTICE } = await import('./lib/allergen-verify')

  let filled = 0
  let alreadyFilled = 0
  let noRow = 0
  for (const [i, row] of file.valid.entries()) {
    const existing = await prisma.ingredient.findUnique({
      where: { slug: row.slug },
      select: { id: true, description: true },
    })
    if (!existing) {
      noRow++
      console.warn(`  ✗ [${i + 1}/${file.valid.length}] ${row.slug}: no ingredient row — not created (--from-file only fills stubs)`)
      continue
    }
    if (existing.description !== null) {
      alreadyFilled++
      continue
    }
    await prisma.ingredient.update({
      where: { id: existing.id },
      data: {
        description: row.prose.description,
        storage: row.prose.storage,
        seasonality: row.prose.seasonality,
        allergenProfile: row.allergen.allergenProfile,
        hiddenSources: row.allergen.hiddenSources,
        crossContamination: row.allergen.crossContamination,
        substitutions: row.allergen.substitutions,
      },
    })
    filled++
    console.log(`  [${i + 1}/${file.valid.length}] ${row.slug}`)
  }

  console.log(
    `\nDone — filled ${filled}, skipped ${alreadyFilled} (already had a description), ${noRow} with no row, ${file.rejected.length} rejected by schema.`,
  )
  console.log(`Written by ${file.writtenBy} on ${file.writtenOn} (${path}).`)
  console.log(UNVERIFIED_NOTICE)
}

// Set only on real runs — dry-run never constructs a Prisma client.
let prismaRef: { $disconnect(): Promise<void> } | null = null

async function main() {
  const { count, dryRun, fromFile } = parseArgs()
  if (fromFile) return fillFromFile(fromFile, dryRun)

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
      '\nReal run requires AZURE_FOUNDRY_RESOURCE + AZURE_FOUNDRY_API_KEY (prose, ds lane) and ' +
        'AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY (allergen fields).',
    )
    console.log('Prose fields use the ds lane (DeepSeek V4 Flash); allergen fields go through scripts/lib/allergen-verify.ts.')
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
  const failures: { name: string; reason: string }[] = []

  try {
    for (const [i, input] of inputs.entries()) {
      const existing = await prisma.ingredient.findUnique({ where: { slug: input.slug }, select: { id: true } })
      if (existing) {
        skipped++
        continue
      }

      // One row must never end the run. providers:['ds'] has no fallback by design, so a
      // content-filter 400 on a single ingredient (FOU-441) previously stranded every later
      // row — 276 of them on 2026-08-28. Record and move on; a re-run retries only the
      // failures, since existing slugs are skipped.
      try {
        let prose: z.infer<typeof ProseSchema> | null = null
        for (let attempt = 1; attempt <= 3 && !prose; attempt++) {
          const candidate = await batchObject(
            `Write the encyclopedia entry for the ingredient: ${input.name} (category: ${input.category}).`,
            ProseSchema,
            // tier is explicit on purpose: visitor-facing encyclopedia prose belongs on the
            // quality lane. It was previously implicit via the lib default, which reads as
            // "nobody chose" rather than "quality was chosen" when auditing spend.
            { system: PROSE_SYSTEM, temperature: 0.5, tier: 'quality', providers: ['ds'] },
          )
          if (validProse(candidate)) prose = candidate
          else console.warn(`  ↻ ${input.name}: prose field under floor (FOU-439) — retry ${attempt}/3`)
        }
        if (!prose) throw new Error(`${input.name}: prose failed the FOU-439 floor three times`)

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
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        failures.push({ name: input.name, reason })
        console.warn(`  ✗ [${i + 1}/${inputs.length}] ${input.name}: ${reason}`)
      }
    }
  } finally {
    console.log(
      `\nDone — inserted ${inserted}, skipped ${skipped} (existing), ${annotated} allergen-annotated.`,
    )
    if (failures.length) {
      console.warn(`\n${failures.length} ingredient(s) failed and were left unwritten:`)
      for (const f of failures) console.warn(`  - ${f.name}: ${f.reason}`)
      console.warn('Re-run the seeder to retry only these — existing rows are skipped.')
    }
    console.log(UNVERIFIED_NOTICE)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prismaRef?.$disconnect().catch(() => undefined))
