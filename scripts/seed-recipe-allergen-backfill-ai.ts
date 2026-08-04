/**
 * @description Backfills allergen data for EXISTING recipes. Derives allergens/mayContain from each recipe's stored ingredient list via the dual-model gate in scripts/lib/allergen-verify.ts (Azure GPT-5 + independent claude-opus-5 agreement — disagreements go to scripts/allergen-review.jsonl, never the DB). Also backfills MISSING tags and nutrition macros (calories/protein/carbs/fat only) via normal ai-batch. Never overwrites user-entered data; rows with allergenVerifiedAt set are skipped entirely.
 * @tables recipes
 *
 * Usage:
 *   npx tsx scripts/seed-recipe-allergen-backfill-ai.ts               # all unverified recipes
 *   npx tsx scripts/seed-recipe-allergen-backfill-ai.ts --count 25    # first 25
 *   npx tsx scripts/seed-recipe-allergen-backfill-ai.ts --dry-run     # print the plan — NO AI calls, NO DB connection
 *
 * --dry-run is deliberately fully offline: the allergen lane must never run as
 * a side effect of a preview, so the dry run only describes the selection and
 * write rules without contacting AI providers or the database.
 *
 * Requires in /home/cedar/Projects/.env:
 *   AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY   (allergen generation — no free-lane fallback)
 *   ANTHROPIC_API_KEY                              (independent claude-opus-5 cross-check)
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { z } from 'zod'

// Macros only — allergen claims never come from this generation.
const EnrichmentSchema = z.object({
  tags: z.array(z.string()).describe('5-8 short lowercase tags (diet, method, occasion, key ingredient)'),
  nutrition: z.object({
    calories: z.number().int(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
  }),
})

const ENRICH_SYSTEM =
  'You tag recipes and estimate per-serving nutrition macros for a cooking app. ' +
  'Tags are 5-8 short lowercase phrases. Never make allergen or "free from" claims.'

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const rawCount = get('--count')
  return {
    count: rawCount ? Number(rawCount) : undefined,
    dryRun: args.includes('--dry-run'),
  }
}

// Set only on real runs — dry-run never constructs a Prisma client.
let prismaRef: { $disconnect(): Promise<void> } | null = null

async function main() {
  const { count, dryRun } = parseArgs()

  if (dryRun) {
    // Fully offline by design — no AI providers or DB are contacted.
    console.log('Dry run — no AI or DB calls made. A real run would:')
    console.log('  1. Select recipes WHERE allergenVerifiedAt IS NULL' + (count ? ` (limit ${count})` : ''))
    console.log('  2. Derive allergens/mayContain from each recipe\'s stored sourceIngredients via the')
    console.log('     dual-model gate (Azure GPT-5 generate + claude-opus-5 independent cross-check).')
    console.log('     Exact-set agreement -> write + stamp allergenVerifiedAt.')
    console.log('     Disagreement -> scripts/allergen-review.jsonl, NOTHING allergen-related written.')
    console.log('  3. Backfill tags only when tags = [] and nutrition only when NULL (macros only).')
    console.log('     User-entered data is never overwritten.')
    console.log(
      '\nReal run requires AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY and ANTHROPIC_API_KEY (allergen gate).',
    )
    return
  }

  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { batchObject } = await import('./lib/ai-batch')
  const { verifyRecipeAllergens, requireVerifierEnv, REVIEW_FILE } = await import('./lib/allergen-verify')

  requireVerifierEnv() // fail closed before any generation

  // Skip anything already verified — re-running never re-litigates a verified row.
  const recipes = await prisma.recipe.findMany({
    where: { allergenVerifiedAt: null },
    select: {
      id: true,
      title: true,
      sourceIngredients: true,
      recipeData: true,
      tags: true,
      nutrition: true,
    },
    orderBy: { createdAt: 'asc' },
    ...(count ? { take: count } : {}),
  })

  console.log(`Backfilling ${recipes.length} recipes without allergenVerifiedAt...`)
  let verified = 0
  let flagged = 0
  let enriched = 0
  let skippedNoIngredients = 0

  try {
    for (const [i, recipe] of recipes.entries()) {
      // Prefer the full ingredient lines from recipeData (amount + unit + name);
      // fall back to the bare sourceIngredients names.
      const data = recipe.recipeData as { ingredients?: { name: string; amount?: string; unit?: string }[] } | null
      const ingredients =
        data?.ingredients?.map((ing) => `${ing.amount ?? ''} ${ing.unit ?? ''} ${ing.name}`.trim()) ??
        recipe.sourceIngredients

      if (!ingredients.length) {
        skippedNoIngredients++
        console.log(`  [${i + 1}/${recipes.length}] – ${recipe.title}: no stored ingredients, skipping`)
        continue
      }

      // Allergen fields: dual-model gate only.
      const allergen = await verifyRecipeAllergens({ subject: recipe.title, ingredients })

      // Tags/nutrition: normal ai-batch defaults, and ONLY where currently missing.
      const needsTags = recipe.tags.length === 0
      const needsNutrition = recipe.nutrition == null
      let enrichment: z.infer<typeof EnrichmentSchema> | null = null
      if (needsTags || needsNutrition) {
        enrichment = await batchObject(
          `Tag and estimate per-serving macros for this recipe.\nTitle: ${recipe.title}\nIngredients:\n${ingredients
            .map((ing) => `- ${ing}`)
            .join('\n')}`,
          EnrichmentSchema,
          { system: ENRICH_SYSTEM, temperature: 0.3 },
        )
      }

      const updateData = {
        ...(allergen.verified
          ? {
              allergens: allergen.allergens,
              mayContain: allergen.mayContain,
              allergenNotes: allergen.allergenNotes,
              allergenVerifiedAt: allergen.allergenVerifiedAt,
            }
          : {}), // disagreement: NOTHING allergen-related is written
        ...(enrichment && needsTags ? { tags: enrichment.tags.slice(0, 8) } : {}),
        ...(enrichment && needsNutrition ? { nutrition: enrichment.nutrition } : {}),
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.recipe.update({ where: { id: recipe.id }, data: updateData })
      }

      if (allergen.verified) verified++
      else flagged++
      if (enrichment) enriched++
      console.log(
        `  [${i + 1}/${recipes.length}] ${allergen.verified ? '✓' : '⚠ (allergens unverified)'} ${recipe.title}` +
          (enrichment ? ` (+${[needsTags && 'tags', needsNutrition && 'nutrition'].filter(Boolean).join('/')})` : ''),
      )
    }
  } finally {
    console.log(
      `\nDone — allergens: ${verified} verified, ${flagged} sent to review (${REVIEW_FILE}); ` +
        `${enriched} rows enriched with tags/nutrition, ${skippedNoIngredients} skipped (no ingredients).`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prismaRef?.$disconnect().catch(() => undefined))
