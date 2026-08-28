/**
 * @description Backfills allergen data for EXISTING recipes. Derives allergens/mayContain from each recipe's stored ingredient list via scripts/lib/allergen-verify.ts on the same paid Azure model (single-model as of 2026-08-05 — NOT verified; the allergen disclaimer must render wherever they are shown). Also backfills MISSING tags and nutrition macros (calories/protein/carbs/fat only) via normal ai-batch. Never overwrites user-entered data; rows with allergenAnnotatedAt set are skipped entirely.
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
  const rawConcurrency = get('--concurrency')
  return {
    count: rawCount ? Number(rawCount) : undefined,
    dryRun: args.includes('--dry-run'),
    // Regenerates tags/nutrition on rows that are ALREADY annotated, to replace values
    // written by a provider we no longer want. --since is required so this can never
    // sweep the whole table; createdAt < since additionally excludes rows that
    // seed-public-recipes-ai.ts created and annotated inside the same window.
    redoEnrichment: args.includes('--redo-enrichment'),
    since: get('--since'),
    // 6 workers, not 1. Serial leaves ~92% of the ds lane's 20-rpm cap unused because the
    // process spends every call idle; the shared 18-rpm limiter in ai-batch still caps the
    // total, so this cannot breach quota. Pass --concurrency 1 to force the old behaviour.
    concurrency: rawConcurrency ? Math.max(1, Number(rawConcurrency)) : 6,
  }
}

// Set only on real runs — dry-run never constructs a Prisma client.
let prismaRef: { $disconnect(): Promise<void> } | null = null

async function main() {
  const { count, dryRun, concurrency, redoEnrichment, since } = parseArgs()

  if (dryRun) {
    // Fully offline by design — no AI providers or DB are contacted.
    console.log('Dry run — no AI or DB calls made. A real run would:')
    console.log('  1. Select recipes WHERE allergenAnnotatedAt IS NULL' + (count ? ` (limit ${count})` : ''))
    console.log('  2. Derive allergens/mayContain from each recipe\'s stored sourceIngredients via the')
    console.log('     single paid Azure model (gpt-5.4, tier=quality) — no free-lane fallback.')
    console.log('     Result is written + stamped with allergenAnnotatedAt. NOT verified.')
    console.log('  3. Backfill tags only when tags = [] and nutrition only when NULL (macros only).')
    console.log('     User-entered data is never overwritten.')
    console.log(
      '\nReal run requires AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY (generation, incl. allergen fields).',
    )
    return
  }

  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { batchObject, batchMap } = await import('./lib/ai-batch')
  const { verifyRecipeAllergens, requireVerifierEnv, UNVERIFIED_NOTICE } = await import('./lib/allergen-verify')

  requireVerifierEnv() // fail closed before any generation

  if (redoEnrichment && !since) {
    throw new Error('--redo-enrichment requires --since <ISO timestamp>')
  }
  const sinceDate = since ? new Date(since) : null
  if (sinceDate && Number.isNaN(sinceDate.getTime())) {
    throw new Error(`--since is not a valid timestamp: ${since}`)
  }

  // Default: skip anything already annotated — keeps re-runs idempotent.
  // --redo-enrichment inverts that, targeting rows annotated after --since whose
  // recipe predates it (i.e. rows this backfill touched, not freshly seeded ones).
  const recipes = await prisma.recipe.findMany({
    where:
      redoEnrichment && sinceDate
        ? { allergenAnnotatedAt: { gte: sinceDate }, createdAt: { lt: sinceDate } }
        : { allergenAnnotatedAt: null },
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

  console.log(
    redoEnrichment
      ? `Regenerating tags/nutrition on ${recipes.length} already-annotated recipes (ds lane); allergen fields untouched...`
      : `Backfilling ${recipes.length} recipes without allergenAnnotatedAt...`,
  )
  let annotated = 0
  let enriched = 0
  let skippedNoIngredients = 0

  const failures: { title: string; reason: string }[] = []
  let processed = 0

  try {
    await batchMap(
      recipes,
      async (recipe) => {
        // Prefer the full ingredient lines from recipeData (amount + unit + name);
        // fall back to the bare sourceIngredients names.
        const data = recipe.recipeData as { ingredients?: { name: string; amount?: string; unit?: string }[] } | null
        const ingredients =
          data?.ingredients?.map((ing) => `${ing.amount ?? ''} ${ing.unit ?? ''} ${ing.name}`.trim()) ??
          recipe.sourceIngredients

        if (!ingredients.length) {
          skippedNoIngredients++
          console.log(`  [${++processed}/${recipes.length}] – ${recipe.title}: no stored ingredients, skipping`)
          return null
        }

        // Allergen fields: single paid Azure model, unverified. Skipped entirely on
        // --redo-enrichment — those rows already carry a valid gpt-5-4 result and
        // regenerating it would re-bill the paid lane for identical data.
        const allergen = redoEnrichment ? null : await verifyRecipeAllergens({ subject: recipe.title, ingredients })

        // Tags/nutrition: ds lane, and ONLY where currently missing — unless
        // --redo-enrichment, which rewrites them regardless of what is there.
        const needsTags = redoEnrichment || recipe.tags.length === 0
        const needsNutrition = redoEnrichment || recipe.nutrition == null
        let enrichment: z.infer<typeof EnrichmentSchema> | null = null
        if (needsTags || needsNutrition) {
          enrichment = await batchObject(
            `Tag and estimate per-serving macros for this recipe.\nTitle: ${recipe.title}\nIngredients:\n${ingredients
              .map((ing) => `- ${ing}`)
              .join('\n')}`,
            EnrichmentSchema,
            { system: ENRICH_SYSTEM, temperature: 0.3, tier: 'quality', providers: ['ds'] },
          )
        }

        const updateData = {
          ...(allergen
            ? {
                allergens: allergen.allergens,
                mayContain: allergen.mayContain,
                allergenNotes: allergen.allergenNotes,
                allergenAnnotatedAt: new Date(),
              }
            : {}),
          ...(enrichment && needsTags ? { tags: enrichment.tags.slice(0, 8) } : {}),
          ...(enrichment && needsNutrition ? { nutrition: enrichment.nutrition } : {}),
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.recipe.update({ where: { id: recipe.id }, data: updateData })
        }

        annotated++
        if (enrichment) enriched++
        console.log(
          `  [${++processed}/${recipes.length}] ${recipe.title}` +
            (enrichment ? ` (+${[needsTags && 'tags', needsNutrition && 'nutrition'].filter(Boolean).join('/')})` : ''),
        )
        return null
      },
      {
        concurrency,
        // One bad row must not end the run. The allergen model rejects the occasional
        // recipe outright ("The model produced invalid content"), and a re-run picks up
        // only what is still unannotated, so skipping is both safe and resumable.
        onError: (err, item) => {
          const reason = err instanceof Error ? err.message : String(err)
          const title = (item as { title: string }).title
          failures.push({ title, reason })
          console.warn(`  ✗ ${title}: ${reason}`)
          return 'skip'
        },
      },
    )
  } finally {
    console.log(
      `\nDone — ${annotated} recipes ${redoEnrichment ? 'reprocessed (allergen fields untouched)' : 'allergen-annotated'}, ` +
        `${enriched} rows enriched with tags/nutrition, ${skippedNoIngredients} skipped (no ingredients).`,
    )
    if (failures.length) {
      console.warn(`\n${failures.length} recipe(s) failed and stay unannotated:`)
      for (const f of failures) console.warn(`  - ${f.title}: ${f.reason}`)
      console.warn('Re-run to retry only these — annotated rows are skipped.')
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
