/**
 * @description AI-generated PUBLIC recipe library seeder. Creates a house library user (library@ingredientbot.com, no password login) and seeds ~400 public recipes (isPublic + publicSlug) across ~40 cuisines. Recipe body, tags (5-8), and nutrition macros (calories/protein/carbs/fat only — no allergen claims) come from one ai-batch generation via DeepSeek V4 Flash on the Azure Foundry ds lane (AZURE_FOUNDRY_* env); allergens/mayContain come from scripts/lib/allergen-verify.ts on the same paid Azure model (single-model as of 2026-08-05 — NOT verified; the allergen disclaimer must render wherever they are shown). Idempotent on publicSlug.
 * @tables users, recipes
 *
 * Usage:
 *   npx tsx scripts/seed-public-recipes-ai.ts               # all ~400 default dishes
 *   npx tsx scripts/seed-public-recipes-ai.ts --count 10    # first 10
 *   npx tsx scripts/seed-public-recipes-ai.ts --dry-run     # print the plan — NO AI calls, NO DB connection
 *
 * --dry-run is deliberately fully offline: the allergen lane must never run as
 * a side effect of a preview.
 *
 * Requires in /home/cedar/Projects/.env:
 *   AZURE_FOUNDRY_RESOURCE + AZURE_FOUNDRY_API_KEY   (recipe generation, ds lane)
 *   AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY     (allergen generation — no free-lane fallback)
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { z } from 'zod'
import type { RecipeInput } from './seed-recipes'

export const LIBRARY_EMAIL = 'library@ingredientbot.com'
export const LIBRARY_NAME = 'IngredientBot Library'

// ~400 dishes, 10 per cuisine across ~40 cuisines.
const DEFAULT_DISHES: Record<string, string[]> = {
  Italian: [
    'spaghetti carbonara', 'lasagna alla bolognese', 'osso buco with gremolata', 'risotto alla milanese',
    'chicken piccata', 'gnocchi al pesto', 'pasta e fagioli', 'saltimbocca alla romana', 'panzanella salad',
    'tiramisu',
  ],
  French: [
    'coq au vin', 'boeuf bourguignon', 'quiche lorraine', 'ratatouille', 'salade nicoise', 'croque monsieur',
    'sole meuniere', 'cassoulet', 'crepes suzette', 'creme brulee',
  ],
  Spanish: [
    'paella de mariscos', 'tortilla espanola', 'gambas al ajillo', 'patatas bravas', 'gazpacho andaluz',
    'pollo al ajillo', 'fabada asturiana', 'pisto manchego', 'churros con chocolate', 'crema catalana',
  ],
  Portuguese: [
    'bacalhau a bras', 'caldo verde', 'frango piri-piri', 'arroz de marisco', 'bifanas', 'polvo a lagareiro',
    'acorda de camarao', 'feijoada transmontana', 'pasteis de nata', 'arroz doce',
  ],
  Greek: [
    'moussaka', 'souvlaki with tzatziki', 'spanakopita', 'avgolemono soup', 'gemista stuffed vegetables',
    'pastitsio', 'horiatiki village salad', 'gigantes plaki', 'kleftiko lamb', 'galaktoboureko',
  ],
  Turkish: [
    'iskender kebab', 'lahmacun', 'manti dumplings', 'imam bayildi', 'menemen', 'kofte with bulgur pilaf',
    'pide with cheese', 'mercimek corbasi lentil soup', 'borek with spinach', 'baklava',
  ],
  Lebanese: [
    'chicken shawarma plate', 'kibbeh', 'fattoush salad', 'mujadara', 'batata harra', 'kafta skewers',
    'stuffed grape leaves', 'shish taouk', 'manakish zaatar', 'knafeh',
  ],
  Moroccan: [
    'chicken tagine with preserved lemon', 'lamb tagine with apricots', 'harira soup', 'couscous royale',
    'zaalouk eggplant dip', 'bastilla chicken pie', 'kefta mkaouara meatball tagine', 'rfissa',
    'moroccan carrot salad', 'mint tea cookies (ghriba)',
  ],
  Ethiopian: [
    'doro wat', 'misir wat red lentils', 'tibs sauteed beef', 'shiro wat', 'gomen collard greens',
    'kitfo', 'atkilt wat cabbage and carrots', 'azifa lentil salad', 'ful medames breakfast', 'injera flatbread',
  ],
  Nigerian: [
    'jollof rice', 'egusi soup with pounded yam', 'suya skewers', 'moin moin', 'pepper soup',
    'akara bean fritters', 'ofada rice with ayamase', 'chicken stew with fried plantain', 'okra soup', 'puff puff',
  ],
  Indian: [
    'butter chicken', 'palak paneer', 'chana masala', 'rogan josh', 'chicken biryani', 'aloo gobi',
    'dal makhani', 'tandoori chicken', 'malai kofta', 'gulab jamun',
  ],
  Pakistani: [
    'chicken karahi', 'nihari', 'haleem', 'seekh kebabs', 'aloo keema', 'chapli kebab', 'daal chawal',
    'chicken pulao', 'paya curry', 'sheer khurma',
  ],
  Thai: [
    'pad thai with shrimp', 'green curry with chicken', 'tom yum goong', 'massaman beef curry', 'som tum papaya salad',
    'pad krapow gai basil chicken', 'khao soi', 'tom kha gai', 'larb moo', 'mango sticky rice',
  ],
  Vietnamese: [
    'pho bo', 'banh mi thit', 'bun cha', 'goi cuon fresh spring rolls', 'com tam broken rice with pork chop',
    'cao lau noodles', 'banh xeo crispy pancake', 'bo kho beef stew', 'ga kho gung ginger chicken', 'che ba mau',
  ],
  Chinese: [
    'mapo tofu', 'kung pao chicken', 'char siu pork', 'beef chow fun', 'hot and sour soup', 'dan dan noodles',
    'sweet and sour pork', 'congee with century egg', 'scallion pancakes', 'egg fried rice',
  ],
  Japanese: [
    'chicken katsu curry', 'miso ramen', 'oyakodon', 'chicken teriyaki', 'okonomiyaki', 'agedashi tofu',
    'gyoza dumplings', 'chirashi bowl', 'nikujaga beef and potato stew', 'matcha mochi',
  ],
  Korean: [
    'bibimbap', 'kimchi jjigae', 'bulgogi', 'japchae', 'tteokbokki', 'sundubu jjigae soft tofu stew',
    'dakgalbi spicy chicken', 'kimchi fried rice', 'galbi short ribs', 'hotteok sweet pancakes',
  ],
  Filipino: [
    'chicken adobo', 'sinigang na baboy', 'kare-kare', 'lumpia shanghai', 'pancit canton', 'lechon kawali',
    'tinola', 'sisig', 'arroz caldo', 'halo-halo',
  ],
  Indonesian: [
    'nasi goreng', 'beef rendang', 'satay ayam with peanut sauce', 'gado-gado', 'soto ayam', 'mie goreng',
    'ayam bakar', 'tempeh orek', 'nasi uduk', 'pisang goreng',
  ],
  Malaysian: [
    'chicken laksa', 'nasi lemak', 'char kway teow', 'beef massaman rendang', 'roti canai with dhal',
    'mee goreng mamak', 'ayam percik', 'sambal prawns', 'kangkung belacan', 'cendol',
  ],
  Mexican: [
    'tacos al pastor', 'chicken enchiladas verdes', 'chiles rellenos', 'pozole rojo', 'cochinita pibil',
    'mole poblano', 'sopa de tortilla', 'carne asada with salsa verde', 'elote street corn', 'tres leches cake',
  ],
  Peruvian: [
    'ceviche clasico', 'lomo saltado', 'aji de gallina', 'papa a la huancaina', 'arroz con pollo peruano',
    'anticuchos', 'causa rellena', 'seco de res', 'tacu tacu', 'picarones',
  ],
  Brazilian: [
    'feijoada completa', 'moqueca de peixe', 'coxinha', 'pao de queijo', 'picanha with farofa',
    'bobo de camarao', 'escondidinho', 'frango a passarinho', 'acaraje', 'brigadeiros',
  ],
  Argentinian: [
    'asado short ribs with chimichurri', 'empanadas mendocinas', 'milanesa napolitana', 'locro stew',
    'provoleta', 'choripan', 'matambre arrollado', 'pastel de papa', 'humita en chala', 'alfajores',
  ],
  Colombian: [
    'bandeja paisa', 'ajiaco santafereno', 'arepas con queso', 'sancocho de gallina', 'lechona tolimense',
    'patacones with hogao', 'carne en polvo', 'changua breakfast soup', 'arroz con coco', 'arroz con leche',
  ],
  Cuban: [
    'ropa vieja', 'lechon asado with mojo', 'picadillo', 'arroz con frijoles negros', 'vaca frita',
    'cuban sandwich', 'camarones enchilados', 'tostones', 'yuca con mojo', 'flan cubano',
  ],
  Jamaican: [
    'jerk chicken', 'curry goat', 'ackee and saltfish', 'brown stew chicken', 'oxtail with butter beans',
    'escovitch fish', 'rice and peas', 'callaloo', 'jamaican beef patties', 'gizzada tarts',
  ],
  American: [
    'buttermilk fried chicken', 'classic meatloaf with mashed potatoes', 'clam chowder', 'cobb salad',
    'philly cheesesteak', 'bbq baby back ribs', 'lobster roll', 'chicken pot pie', 'sloppy joes', 'apple pie',
  ],
  'Southern US': [
    'shrimp and grits', 'chicken and dumplings', 'fried green tomatoes', 'collard greens with ham hock',
    'biscuits and sausage gravy', 'country fried steak', 'pimento cheese sandwiches', 'hoppin john',
    'cornbread skillet', 'peach cobbler',
  ],
  Cajun: [
    'chicken and sausage gumbo', 'crawfish etouffee', 'jambalaya', 'red beans and rice', 'blackened catfish',
    'shrimp creole', 'dirty rice', 'boudin balls', 'muffuletta sandwich', 'bananas foster',
  ],
  'Tex-Mex': [
    'beef fajitas', 'chili con carne', 'cheese enchiladas with chili gravy', 'queso fundido', 'crispy beef tacos',
    'king ranch chicken casserole', 'frito pie', 'breakfast tacos', 'borracho beans', 'sopapillas',
  ],
  British: [
    'fish and chips', 'shepherds pie', 'bangers and mash with onion gravy', 'beef wellington',
    'chicken tikka masala', 'toad in the hole', 'ploughmans lunch', 'cottage pie', 'full english breakfast',
    'sticky toffee pudding',
  ],
  Irish: [
    'irish beef stew', 'colcannon', 'dublin coddle', 'boxty potato pancakes', 'corned beef and cabbage',
    'irish soda bread', 'shepherds pie with lamb', 'seafood chowder', 'champ', 'bread and butter pudding',
  ],
  German: [
    'sauerbraten', 'schnitzel with spaetzle', 'bratwurst with sauerkraut', 'rouladen', 'kartoffelsuppe',
    'jagerschnitzel', 'kasespatzle', 'currywurst', 'flammkuchen', 'apfelstrudel',
  ],
  Polish: [
    'pierogi ruskie', 'bigos hunters stew', 'kotlet schabowy', 'zurek sour rye soup', 'golabki cabbage rolls',
    'placki ziemniaczane potato pancakes', 'kielbasa with onions', 'rosol chicken soup', 'kopytka', 'sernik cheesecake',
  ],
  Hungarian: [
    'chicken paprikash', 'beef goulash', 'lecso', 'stuffed peppers toltott paprika', 'langos',
    'porkolt pork stew', 'halaszle fishermans soup', 'krumplifozelek potato stew', 'chicken schnitzel', 'somloi galuska',
  ],
  Russian: [
    'beef stroganoff', 'borscht with sour cream', 'pelmeni dumplings', 'chicken kiev', 'olivier salad',
    'solyanka soup', 'blini with smoked salmon', 'golubtsy stuffed cabbage', 'kotleti meat patties', 'syrniki',
  ],
  Ukrainian: [
    'ukrainian borscht', 'varenyky with potato', 'chicken kyiv', 'holubtsi', 'deruny potato pancakes',
    'salo with garlic on rye', 'okroshka cold soup', 'banosh cornmeal porridge', 'kapusniak sauerkraut soup', 'medivnyk honey cake',
  ],
  Swedish: [
    'swedish meatballs', 'gravlax with mustard sauce', 'jansson temptation potato gratin', 'raggmunk',
    'pyttipanna hash', 'toast skagen', 'kalops beef stew', 'inlagd sill pickled herring plate', 'pea soup with pancakes',
    'kanelbullar cinnamon buns',
  ],
  Georgian: [
    'khachapuri adjaruli', 'khinkali dumplings', 'chicken satsivi', 'lobio bean stew', 'chakhokhbili chicken stew',
    'badrijani nigvzit eggplant rolls', 'mtsvadi pork skewers', 'kharcho soup', 'pkhali vegetable pates', 'churchkhela',
  ],
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const ALL_DISHES: { cuisine: string; dish: string; publicSlug: string }[] = Object.entries(
  DEFAULT_DISHES,
).flatMap(([cuisine, dishes]) => dishes.map((dish) => ({ cuisine, dish, publicSlug: slugify(dish) })))

// Kept lenient like seed-recipes-ai.ts (providers' strict JSON modes reject
// min/max bounds). Nutrition is macros ONLY — allergen claims never come from
// this generation.
const PublicRecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  servings: z.number().int(),
  prepTimeMin: z.number().int(),
  cookTimeMin: z.number().int(),
  cuisine: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
      unit: z.string(),
    }),
  ),
  steps: z.array(z.string()),
  notes: z.string(),
  tags: z.array(z.string()).describe('5-8 short lowercase tags (diet, method, occasion, key ingredient)'),
  nutrition: z.object({
    calories: z.number().int(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
})

const SYSTEM_PROMPT = [
  'You are a recipe writer for a cooking app. Output realistic, well-tested recipes with accurate timing and nutrition estimates.',
  'Use plain home-cook language. Avoid filler ("delicious", "amazing"). Be specific about quantities and technique.',
  'Nutrition values are per-serving estimates. Tags are 5-8 short lowercase phrases.',
  'Never make allergen or "free from" claims anywhere in the text — allergen data is handled by a separate verified pipeline.',
  // FOU-439: the ds deployment's json_schema mode is generate-then-parse — a straight " in prose truncates the field.
  'In prose, use curly quotes (\u201c \u201d) for any quoted phrase; never straight double quotes.',
].join(' ')

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  return {
    count: Number(get('--count') ?? ALL_DISHES.length),
    dryRun: args.includes('--dry-run'),
  }
}

// Set only on real runs — dry-run never constructs a Prisma client.
let prismaRef: { $disconnect(): Promise<void> } | null = null

async function main() {
  const { count, dryRun } = parseArgs()
  const dishes = ALL_DISHES.slice(0, count)

  if (dryRun) {
    // Fully offline by design — no AI providers or DB are contacted.
    const cuisines = new Set(dishes.map((d) => d.cuisine))
    console.log(
      `Dry run — would seed ${dishes.length} public recipes across ${cuisines.size} cuisines (of ${ALL_DISHES.length} defaults). No AI or DB calls made.`,
    )
    console.log(`House user: ${LIBRARY_EMAIL} (find-or-create, no password login).`)
    console.log('\nFirst 5:')
    for (const d of dishes.slice(0, 5)) console.log(`  /r/${d.publicSlug}  (${d.cuisine})`)
    console.log(
      '\nReal run requires AZURE_FOUNDRY_RESOURCE + AZURE_FOUNDRY_API_KEY (recipe generation, ds lane) and ' +
        'AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY (allergen fields).',
    )
    return
  }

  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { batchObject } = await import('./lib/ai-batch')
  const { verifyRecipeAllergens, requireVerifierEnv, UNVERIFIED_NOTICE } = await import('./lib/allergen-verify')
  const { buildRecipeRecord } = await import('./seed-recipes')

  requireVerifierEnv() // fail closed before any generation

  // House user that owns the public library. No password → cannot log in via
  // credentials (mirrors how User.password is nullable for OAuth-style rows).
  const library = await prisma.user.upsert({
    where: { email: LIBRARY_EMAIL },
    update: {},
    create: { email: LIBRARY_EMAIL, name: LIBRARY_NAME, emailVerified: new Date() },
  })

  console.log(`Seeding ${dishes.length} public recipes as ${LIBRARY_EMAIL}...`)
  let inserted = 0
  let skipped = 0
  let annotated = 0

  try {
    for (const [i, { cuisine, dish, publicSlug }] of dishes.entries()) {
      const existing = await prisma.recipe.findUnique({ where: { publicSlug }, select: { id: true } })
      if (existing) {
        skipped++
        continue
      }

      // FOU-439 net: a quote-truncated field is valid JSON and arrives silently.
      // Floors are amputation checks, not quality bars: a real recipe cannot have
      // a 3-word description, 2 steps, or 1 ingredient.
      let r: z.infer<typeof PublicRecipeSchema> | null = null
      for (let attempt = 1; attempt <= 3 && !r; attempt++) {
        const c = await batchObject(
          `Generate a recipe for: ${dish} (${cuisine} cuisine). Pick reasonable serving size, cook time, and difficulty.`,
          PublicRecipeSchema,
          // tier is explicit on purpose: this is the public recipe library, so quality
          // lane. Contrast seed-recipes-ai.ts, which is demo-only and pinned to free.
          { system: SYSTEM_PROMPT, temperature: 0.7, tier: 'quality', providers: ['ds'] },
        )
        if (c.description.trim().length >= 60 && c.steps.length >= 3 && c.ingredients.length >= 3) r = c
        else console.warn(`  ↻ ${dish}: recipe under FOU-439 floor — retry ${attempt}/3`)
      }
      if (!r) throw new Error(`${dish}: recipe failed the FOU-439 floor three times`)

      const allergen = await verifyRecipeAllergens({
        subject: r.title,
        ingredients: r.ingredients.map((ing) => `${ing.amount} ${ing.unit} ${ing.name}`.trim()),
      })
      annotated++

      await prisma.recipe.create({
        data: {
          ...buildRecipeRecord(r as unknown as RecipeInput, library.id),
          nutrition: r.nutrition, // macros only — overrides the RecipeInput shape
          tags: r.tags.slice(0, 8),
          isPublic: true,
          publicSlug,
          allergens: allergen.allergens,
          mayContain: allergen.mayContain,
          allergenNotes: allergen.allergenNotes,
          allergenAnnotatedAt: new Date(),
        },
      })
      inserted++
      console.log(`  [${i + 1}/${dishes.length}] /r/${publicSlug}`)
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
