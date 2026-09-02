/**
 * @description Builds the Recipe↔Ingredient join that powers reverse ingredient search ("What can I make?"). Resolves each recipe's free-text ingredient strings to canonical Ingredient rows via src/lib/ingredient-normalize.ts, creates the curated ingredients the corpus is missing, and mirrors the alias vocabulary and staple flags onto the Ingredient table so the public autocomplete can query them in SQL. Also maintains Recipe.nonStapleIngredientCount, the denominator the search ranking subtracts from. Idempotent — a second run reports the same numbers and writes nothing new.
 * @tables recipe_ingredients, ingredients, recipes
 *
 * Usage:
 *   npx tsx scripts/backfill-recipe-ingredients.ts --dry-run   # report only, no writes
 *   npx tsx scripts/backfill-recipe-ingredients.ts             # apply
 *   npx tsx scripts/backfill-recipe-ingredients.ts --report-unmatched 200
 *
 * Scope: PUBLIC recipes only. `sourceIngredients` means two different things
 * depending on who owns the row — for library recipes it is the full ingredient
 * list, for user-generated ones it is whatever the user typed into the box — so
 * this reads `recipeData.ingredients` (always the real list) and never
 * `sourceIngredients`, and filters to isPublic.
 *
 * Staging first. A production run is a separate, explicit decision.
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { prisma } from './_prisma'
import {
  matchIngredient,
  slugifyIngredient,
  ADDITIONAL_INGREDIENTS,
  INGREDIENT_ALIASES,
  STAPLE_SLUGS,
} from '../src/lib/ingredient-normalize'

interface RawIngredient {
  name?: string
  amount?: string
  unit?: string
}

export async function run(): Promise<{ inserted: number; updated: number; deleted: number }> {
  const dryRun = process.argv.includes('--dry-run')
  const reportIdx = process.argv.indexOf('--report-unmatched')
  const reportLimit = reportIdx >= 0 ? Number(process.argv[reportIdx + 1] ?? 50) : 50

  let inserted = 0
  let updated = 0
  let deleted = 0

  // ---------------------------------------------------------------- corpus
  // Create the curated additions first, so the matcher can resolve against
  // them in the same run rather than needing a second pass.
  const existing = await prisma.ingredient.findMany({ select: { id: true, slug: true } })
  const bySlug = new Map(existing.map((i) => [i.slug, i.id]))

  const missing = ADDITIONAL_INGREDIENTS.filter((a) => !bySlug.has(slugifyIngredient(a.name)))
  if (missing.length) {
    console.log(`${missing.length} curated ingredient(s) missing from the corpus:`)
    for (const m of missing) console.log(`  + ${slugifyIngredient(m.name)} (${m.category})`)
    if (!dryRun) {
      for (const m of missing) {
        // No description: the public glossary only lists rows that have prose,
        // so these stay hidden until seed-ingredient-ai.ts writes their entry.
        const row = await prisma.ingredient.create({
          data: { slug: slugifyIngredient(m.name), name: m.name, category: m.category },
          select: { id: true, slug: true },
        })
        bySlug.set(row.slug, row.id)
        inserted++
      }
    }
  } else {
    console.log('Corpus already has every curated ingredient.')
  }

  const canonicalSlugs = new Set(bySlug.keys())
  // In a dry run the additions do not exist yet; pretend they do, so the
  // reported match rate is the one the real run would achieve.
  if (dryRun) for (const m of missing) canonicalSlugs.add(slugifyIngredient(m.name))

  // ------------------------------------------------- aliases + staple flags
  // src/lib/ingredient-normalize.ts is the source of truth; the columns are a
  // queryable mirror of it. Rebuilt wholesale each run so a removed alias
  // actually disappears instead of lingering in the database forever.
  const aliasesBySlug = new Map<string, string[]>()
  for (const [alias, slug] of Object.entries(INGREDIENT_ALIASES)) {
    if (!canonicalSlugs.has(slug)) continue
    const list = aliasesBySlug.get(slug) ?? []
    if (!list.includes(alias)) list.push(alias)
    aliasesBySlug.set(slug, list)
  }

  const allIngredients = await prisma.ingredient.findMany({
    select: { id: true, slug: true, aliases: true, isStaple: true },
  })
  let aliasWrites = 0
  for (const ing of allIngredients) {
    const wantAliases = (aliasesBySlug.get(ing.slug) ?? []).slice().sort()
    const wantStaple = STAPLE_SLUGS.has(ing.slug)
    const haveAliases = [...ing.aliases].sort()
    const sameAliases =
      haveAliases.length === wantAliases.length && haveAliases.every((a, i) => a === wantAliases[i])
    if (sameAliases && ing.isStaple === wantStaple) continue
    aliasWrites++
    if (!dryRun) {
      await prisma.ingredient.update({
        where: { id: ing.id },
        data: { aliases: wantAliases, isStaple: wantStaple },
      })
      updated++
    }
  }
  console.log(`alias/staple sync: ${aliasWrites} ingredient row(s) ${dryRun ? 'would change' : 'updated'}`)

  const stapleIds = new Set(
    allIngredients.filter((i) => STAPLE_SLUGS.has(i.slug)).map((i) => i.id),
  )
  const missingStaples = [...STAPLE_SLUGS].filter((s) => !canonicalSlugs.has(s))
  if (missingStaples.length) {
    console.warn(`WARNING: staple slug(s) absent from the corpus — they will never be excluded from extras: ${missingStaples.join(', ')}`)
  }

  // -------------------------------------------------------------- the join
  const recipes = await prisma.recipe.findMany({
    where: { isPublic: true },
    select: { id: true, publicSlug: true, recipeData: true, nonStapleIngredientCount: true },
  })
  console.log(`\n${recipes.length} public recipe(s) to process.`)

  // Every existing link in one query. The per-recipe alternative is 998 round
  // trips, and against the pooled Neon endpoint that alone ran past ten
  // minutes before any writing started.
  const existingLinks = await prisma.recipeIngredient.findMany({
    where: { recipe: { isPublic: true } },
    select: { id: true, recipeId: true, rawName: true, ingredientId: true, isStaple: true },
  })
  const linksByRecipe = new Map<string, typeof existingLinks>()
  for (const l of existingLinks) {
    const list = linksByRecipe.get(l.recipeId) ?? []
    list.push(l)
    linksByRecipe.set(l.recipeId, list)
  }
  console.log(`${existingLinks.length} existing join row(s) loaded.`)

  const unmatchedFreq = new Map<string, number>()
  let rows = 0
  let skippedHeading = 0
  let skippedNonFood = 0
  let matchedRows = 0
  let countFixes = 0

  const toCreate: { recipeId: string; rawName: string; ingredientId: string | null; isStaple: boolean }[] = []
  const toUpdate: { id: string; ingredientId: string | null; isStaple: boolean }[] = []
  const toDelete: string[] = []
  /** recipeId list, keyed by the non-staple count they should carry. */
  const countGroups = new Map<number, string[]>()

  for (const recipe of recipes) {
    const data = recipe.recipeData as unknown as { ingredients?: RawIngredient[] }
    const list = Array.isArray(data?.ingredients) ? data.ingredients : []

    // rawName is the join's unique key, so collapse duplicate strings within a
    // recipe before writing rather than letting the insert conflict.
    const desired = new Map<string, { ingredientId: string | null; isStaple: boolean }>()
    for (const item of list) {
      const raw = String(item?.name ?? '').trim()
      if (!raw) continue
      rows++

      const res = matchIngredient(raw, canonicalSlugs)
      if (res.isHeading) { skippedHeading++; continue }
      if (res.isNonFood) { skippedNonFood++; continue }

      const ingredientId = res.slug ? (bySlug.get(res.slug) ?? null) : null
      if (res.slug) matchedRows++
      else unmatchedFreq.set(raw.toLowerCase(), (unmatchedFreq.get(raw.toLowerCase()) ?? 0) + 1)

      desired.set(raw, {
        ingredientId,
        isStaple: ingredientId ? stapleIds.has(ingredientId) : false,
      })
    }

    // Distinct non-staple ingredients: matched rows collapse by ingredientId
    // (one recipe listing both "salt" and "kosher salt" is one ingredient),
    // unmatched rows count once per distinct string, since that is the best
    // identity available for them.
    const nonStapleKeys = new Set<string>()
    for (const [raw, v] of desired) {
      if (v.isStaple) continue
      nonStapleKeys.add(v.ingredientId ? `id:${v.ingredientId}` : `raw:${raw.toLowerCase()}`)
    }
    const nonStapleCount = nonStapleKeys.size

    const current = linksByRecipe.get(recipe.id) ?? []
    const currentByRaw = new Map(current.map((c) => [c.rawName, c]))

    for (const [raw, want] of desired) {
      const have = currentByRaw.get(raw)
      if (!have) {
        toCreate.push({ recipeId: recipe.id, rawName: raw, ...want })
      } else if (have.ingredientId !== want.ingredientId || have.isStaple !== want.isStaple) {
        // The matcher improved (or an ingredient was added) since last run.
        toUpdate.push({ id: have.id, ingredientId: want.ingredientId, isStaple: want.isStaple })
      }
    }

    // Rows whose raw string is no longer in the recipe (edited recipe, or a
    // string now classified as a heading or as equipment).
    for (const c of current) {
      if (!desired.has(c.rawName)) toDelete.push(c.id)
    }

    if (recipe.nonStapleIngredientCount !== nonStapleCount) {
      countFixes++
      const group = countGroups.get(nonStapleCount) ?? []
      group.push(recipe.id)
      countGroups.set(nonStapleCount, group)
    }
  }

  // ---------------------------------------------------------------- writing
  // Batched. Counts are grouped by VALUE, so ~28 updateMany calls cover all
  // 998 recipes instead of 998 individual updates.
  const CHUNK = 500
  if (!dryRun) {
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const batch = toCreate.slice(i, i + CHUNK)
      const res = await prisma.recipeIngredient.createMany({ data: batch, skipDuplicates: true })
      inserted += res.count
    }
    for (const u of toUpdate) {
      await prisma.recipeIngredient.update({
        where: { id: u.id },
        data: { ingredientId: u.ingredientId, isStaple: u.isStaple },
      })
      updated++
    }
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const res = await prisma.recipeIngredient.deleteMany({
        where: { id: { in: toDelete.slice(i, i + CHUNK) } },
      })
      deleted += res.count
    }
    for (const [count, ids] of countGroups) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const res = await prisma.recipe.updateMany({
          where: { id: { in: ids.slice(i, i + CHUNK) } },
          data: { nonStapleIngredientCount: count },
        })
        updated += res.count
      }
    }
  }
  const linkInserts = toCreate.length
  const linkDeletes = toDelete.length

  // -------------------------------------------------------------- reporting
  const considered = rows - skippedHeading - skippedNonFood
  const pct = considered ? ((matchedRows / considered) * 100).toFixed(1) : '0.0'
  console.log(`\ningredient rows seen:   ${rows}`)
  console.log(`  section headings:     ${skippedHeading} (skipped)`)
  console.log(`  equipment, not food:  ${skippedNonFood} (skipped)`)
  console.log(`  considered:           ${considered}`)
  console.log(`  MATCHED to corpus:    ${matchedRows} (${pct}%)`)
  console.log(`  unmatched:            ${considered - matchedRows}`)
  console.log(`\njoin rows ${dryRun ? 'to insert' : 'inserted'}: ${linkInserts} | ${dryRun ? 'to delete' : 'deleted'}: ${linkDeletes}`)
  console.log(`recipes whose non-staple count ${dryRun ? 'would change' : 'changed'}: ${countFixes}`)

  const un = [...unmatchedFreq.entries()].sort((a, b) => b[1] - a[1])
  if (un.length) {
    console.log(`\n${un.length} distinct unmatched name(s). Top ${Math.min(reportLimit, un.length)}:`)
    for (const [name, n] of un.slice(0, reportLimit)) console.log(`${String(n).padStart(4)}  ${name}`)
    console.log(
      '\nUnmatched ingredients still COUNT as extras — they are linked with a null ' +
        'ingredientId, so a recipe needing one never ranks as ready to cook. To resolve ' +
        'more of them, add an alias or a curated row in src/lib/ingredient-normalize.ts ' +
        'and re-run; this script is idempotent.',
    )
  }

  if (dryRun) console.log('\nDry run — no writes made.')
  return { inserted, updated, deleted }
}

if (require.main === module) {
  run()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
