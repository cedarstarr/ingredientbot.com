/**
 * @description Repairs drifted `cuisine` labels on the public recipe library. The AI seeder used to store the model's own cuisine string, so rows came back as "ethiopian", "tex-mex" or "Southern United States" and split the /recipes browse page into duplicate sections (24 of 998 rows, 2026-08-29 audit). Rewrites each library recipe's cuisine to the canonical DEFAULT_DISHES key it was generated from, matched by publicSlug. Idempotent — a second run updates nothing. Only touches public recipes owned by the house library user.
 * @tables recipes
 *
 * Usage:
 *   npx tsx scripts/normalize-recipe-cuisines.ts             # apply
 *   npx tsx scripts/normalize-recipe-cuisines.ts --dry-run   # report only, no writes
 *
 * The seeder now stamps the canonical key at insert time, so this is a one-off
 * backfill for rows created before that fix — kept because it is the only thing
 * that can repair an existing database, and re-running it is free.
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { prisma } from './_prisma'
import { ALL_DISHES, LIBRARY_EMAIL } from './seed-public-recipes-ai'

export async function run(): Promise<{ inserted: number; updated: number; deleted: number }> {
  const dryRun = process.argv.includes('--dry-run')

  const library = await prisma.user.findUnique({
    where: { email: LIBRARY_EMAIL },
    select: { id: true },
  })
  if (!library) {
    console.log(`No ${LIBRARY_EMAIL} user — public library not seeded here. Nothing to do.`)
    return { inserted: 0, updated: 0, deleted: 0 }
  }

  // publicSlug is derived from the dish name, so it is the stable join key back to
  // the canonical cuisine — the stored title and cuisine both come from the model
  // and either may have drifted.
  const canonicalBySlug = new Map(ALL_DISHES.map((d) => [d.publicSlug, d.cuisine]))

  const recipes = await prisma.recipe.findMany({
    where: { userId: library.id, isPublic: true, publicSlug: { not: null } },
    select: { id: true, publicSlug: true, title: true, cuisine: true },
  })

  const drifted = recipes.filter((r) => {
    const canonical = canonicalBySlug.get(r.publicSlug!)
    return canonical !== undefined && r.cuisine !== canonical
  })

  const unknown = recipes.filter((r) => !canonicalBySlug.has(r.publicSlug!))
  if (unknown.length) {
    // Not an error: a hand-added library recipe has no dish-list entry. Reported so
    // it is a visible choice rather than a silent skip.
    console.warn(`${unknown.length} library recipe(s) are not in the dish list — left untouched:`)
    for (const r of unknown.slice(0, 10)) console.warn(`  /r/${r.publicSlug} (${r.cuisine ?? 'null'})`)
  }

  if (drifted.length === 0) {
    console.log(`All ${recipes.length} library recipes already carry canonical cuisines.`)
    return { inserted: 0, updated: 0, deleted: 0 }
  }

  console.log(`${drifted.length} of ${recipes.length} library recipes have a drifted cuisine:`)
  for (const r of drifted) {
    console.log(`  /r/${r.publicSlug}: "${r.cuisine ?? 'null'}" → "${canonicalBySlug.get(r.publicSlug!)}"`)
  }

  if (dryRun) {
    console.log('\nDry run — no writes made.')
    return { inserted: 0, updated: 0, deleted: 0 }
  }

  let updated = 0
  for (const r of drifted) {
    await prisma.recipe.update({
      where: { id: r.id },
      data: { cuisine: canonicalBySlug.get(r.publicSlug!)! },
    })
    updated++
  }

  console.log(`\nDone — ${updated} cuisine label(s) normalized.`)
  return { inserted: 0, updated, deleted: 0 }
}

if (require.main === module) {
  run()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
