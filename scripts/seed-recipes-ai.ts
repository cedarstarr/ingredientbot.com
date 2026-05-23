/**
 * @description AI-generated recipe seeder. Generates recipes via Cerebras (Llama 3.3 70B), falls back to Groq. Idempotent — skips recipes whose title already exists.
 * @tables recipes
 *
 * Usage:
 *   npx tsx scripts/seed-recipes-ai.ts              # generates default 50 dish ideas
 *   npx tsx scripts/seed-recipes-ai.ts --count 10   # generate 10
 *   npx tsx scripts/seed-recipes-ai.ts --dry-run    # generate but don't write to DB
 *
 * Requires CEREBRAS_API_KEY (and GROQ_API_KEY for fallback) in /home/cedar/Projects/.env.
 * Loads from portfolio .env via dotenv.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
config({ path: resolve(__dirname, '../../.env') })
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { batchMap, getStats } from './lib/ai-batch'
import { buildRecipeRecord, type RecipeInput } from './seed-recipes'

const prisma = new PrismaClient()

// Diverse dish prompts — cuisine, dietary, and difficulty are intentionally varied
const DEFAULT_DISHES = [
  'Moroccan lamb tagine with apricots',
  'Vietnamese banh mi sandwich',
  'Korean bibimbap with beef',
  'Japanese miso ramen from scratch',
  'Ethiopian doro wat with injera',
  'Peruvian ceviche with leche de tigre',
  'Spanish paella valenciana',
  'Greek moussaka',
  'Lebanese tabbouleh and falafel plate',
  'Indian palak paneer',
  'Thai green curry with chicken',
  'Mexican mole poblano',
  'Brazilian feijoada',
  'Polish pierogi with potato and cheese',
  'French ratatouille',
  'Hungarian goulash',
  'Turkish lamb kebab with rice pilaf',
  'Filipino chicken adobo',
  'Chinese mapo tofu',
  'Russian beef stroganoff',
  'Vegan jackfruit pulled "pork" sandwiches',
  'Gluten-free chocolate avocado mousse',
  'Keto cauliflower mac and cheese',
  'High-protein turkey meatball bowl',
  'One-pot lemon orzo with shrimp',
  'Sheet-pan harissa chicken with vegetables',
  'Slow-cooker carnitas tacos',
  'Air-fryer crispy tofu with peanut sauce',
  'Pressure cooker risotto with mushrooms',
  'Cold soba noodle salad with sesame dressing',
  'Shakshuka with feta and herbs',
  'Buddha bowl with quinoa and tahini',
  'Smoky black bean chili',
  'Roasted butternut squash soup with sage',
  'Crispy chickpea Caesar salad',
  'Watermelon and feta summer salad',
  'Banana bread with walnuts',
  'Fluffy buttermilk pancakes',
  'Overnight oats with berries and almonds',
  'Avocado toast with poached egg',
  'French toast with caramelized bananas',
  'Breakfast burrito with chorizo',
  'Sourdough bread bowl with clam chowder',
  'Homemade pesto pasta with cherry tomatoes',
  'Cast-iron skillet pizza',
  'Beef bourguignon',
  'Lemon roasted whole chicken',
  'Crispy pork belly with hoisin glaze',
  'Pan-seared salmon with miso butter',
  'Garlic butter shrimp pasta',
]

// Generation schema: kept lenient because providers' strict JSON schema modes
// (Cerebras rejects min/maxLength on strings, Groq requires every field in `required`).
// Tighter bounds are validated post-generation if needed.
const RecipeSchema = z.object({
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
  nutrition: z.object({
    calories: z.number().int(),
    protein: z.number(),
    fat: z.number(),
    carbs: z.number(),
    fiber: z.number(),
  }),
})

type GeneratedRecipe = z.infer<typeof RecipeSchema>

const SYSTEM_PROMPT = [
  'You are a recipe writer for a cooking app. Output realistic, well-tested recipes with accurate timing and nutrition estimates.',
  'Use plain home-cook language. Avoid filler ("delicious", "amazing"). Be specific about quantities and technique.',
  'Nutrition values are per-serving estimates.',
].join(' ')

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  return {
    count: Number(get('--count') ?? DEFAULT_DISHES.length),
    dryRun: args.includes('--dry-run'),
  }
}

async function main() {
  if (!process.env.CEREBRAS_API_KEY && !process.env.GROQ_API_KEY) {
    throw new Error(
      'Missing CEREBRAS_API_KEY and GROQ_API_KEY — add to /home/cedar/Projects/.env',
    )
  }

  const { count, dryRun } = parseArgs()
  const dishes = DEFAULT_DISHES.slice(0, count)

  const admin = await prisma.user.findUnique({
    where: { email: 'cedarbarrett@gmail.com' },
  })
  if (!admin && !dryRun) {
    throw new Error('Admin user not found — run seed-admin-user.ts first')
  }

  console.log(`Generating ${dishes.length} recipes${dryRun ? ' (dry run)' : ''}...`)
  const start = Date.now()

  const generated = await batchMap(
    dishes,
    async (dish, { object }) =>
      object(
        `Generate a recipe for: ${dish}. Pick reasonable serving size, cook time, and difficulty for the dish.`,
        RecipeSchema,
        { system: SYSTEM_PROMPT, temperature: 0.7 },
      ),
    {
      onProgress: (done, total, item) =>
        console.log(`  [${done}/${total}] ${item}`),
      onError: (err, item, i) => {
        console.warn(`  ✗ [${i}] ${item}: ${(err as Error).message}`)
        return 'skip'
      },
    },
  )

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const s = getStats()
  console.log(
    `\nGenerated ${generated.length}/${dishes.length} in ${elapsed}s ` +
      `(cerebras ok=${s.cerebras.ok} fail=${s.cerebras.failed}, ` +
      `groq ok=${s.groq.ok} fail=${s.groq.failed})`,
  )

  if (dryRun) {
    console.log('\nDry run — first recipe preview:')
    console.log(JSON.stringify(generated[0], null, 2))
    return
  }

  let inserted = 0
  let skipped = 0
  for (const r of generated) {
    const existing = await prisma.recipe.findFirst({
      where: { title: r.title, userId: admin!.id },
      select: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }
    await prisma.recipe.create({
      data: buildRecipeRecord(r as unknown as RecipeInput, admin!.id),
    })
    inserted++
    console.log(`  ✓ ${r.title}`)
  }

  console.log(`\nDone — inserted ${inserted}, skipped ${skipped} (already existed).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
