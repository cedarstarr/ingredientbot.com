/**
 * @description One-way content sync of the public recipe library and the canonical ingredient corpus from STAGING to PRODUCTION. Production was provisioned without either (0 public recipes, 0 ingredients), which left reverse ingredient search deployed but unable to return a single result. Copies the library user, the ~420 Ingredient rows and the ~998 public recipes, preserving ids and publicSlugs so the two databases stay comparable and a re-run is a no-op. Does NOT regenerate anything with AI — the rows already exist and were produced on the paid frontier lane; regenerating them would spend budget to make worse copies.
 * @tables users, ingredients, recipes
 *
 * Usage:
 *   npx tsx scripts/copy-library-to-prod.ts            # DRY RUN — reports, writes nothing
 *   npx tsx scripts/copy-library-to-prod.ts --apply    # writes to PRODUCTION
 *
 * Dry run is the DEFAULT here, inverting this directory's usual --dry-run
 * convention: every other script targets staging, and this one writes to
 * production. A flag you must remember to add is safer than one you must
 * remember to omit.
 *
 * Reads STAGING from DATABASE_URL and writes PRODUCTION from
 * PRODUCTION_DATABASE_URL. It refuses to run if the two are equal, if the
 * target is not the Railway host, or if the source looks like production — so
 * it cannot copy backwards or into itself.
 *
 * Run scripts/backfill-recipe-ingredients.ts against production afterwards:
 * this moves the source rows, that builds the search join from them.
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/** One-time and production-only: never expose behind the admin Run Now button. */
export const adminRunnable = false

const LIBRARY_EMAIL = 'library@ingredientbot.com'
const CHUNK = 100

function client(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

const host = (u: string) => u.replace(/.*@([^/?]+).*/, '$1')

export async function run(): Promise<{ inserted: number; updated: number; deleted: number }> {
  const apply = process.argv.includes('--apply')

  const stagingUrl = process.env.DATABASE_URL
  const prodUrl = process.env.PRODUCTION_DATABASE_URL
  if (!stagingUrl) throw new Error('DATABASE_URL (staging source) is not set')
  if (!prodUrl) throw new Error('PRODUCTION_DATABASE_URL (target) is not set')
  if (stagingUrl === prodUrl) throw new Error('Source and target are the same database — refusing')

  // Guards against a mis-set env copying the wrong direction.
  if (!/rlwy\.net|railway/i.test(prodUrl)) {
    throw new Error(`Target does not look like the Railway production host: ${host(prodUrl)}`)
  }
  if (/rlwy\.net|railway/i.test(stagingUrl)) {
    throw new Error(`Source looks like production, not staging: ${host(stagingUrl)}`)
  }

  console.log(`source (staging):    ${host(stagingUrl)}`)
  console.log(`target (PRODUCTION): ${host(prodUrl)}`)
  console.log(apply ? '\n*** APPLYING — writing to production ***\n' : '\nDry run — no writes.\n')

  const staging = client(stagingUrl)
  const prod = client(prodUrl)
  let inserted = 0

  try {
    // ---------------------------------------------------------- library user
    const srcLib = await staging.user.findUnique({
      where: { email: LIBRARY_EMAIL },
      select: { id: true, name: true },
    })
    if (!srcLib) throw new Error(`No ${LIBRARY_EMAIL} on staging — nothing to copy`)

    let dstLib = await prod.user.findUnique({
      where: { email: LIBRARY_EMAIL },
      select: { id: true },
    })
    if (!dstLib) {
      console.log(`library user missing in production — will create ${LIBRARY_EMAIL}`)
      if (apply) {
        // Deliberately NO password: a house account that owns content and never
        // signs in. Copying a credential hash between environments would widen
        // the blast radius of a staging leak for no benefit.
        dstLib = await prod.user.create({
          data: {
            id: srcLib.id,
            email: LIBRARY_EMAIL,
            name: srcLib.name ?? 'IngredientBot Library',
          },
          select: { id: true },
        })
        inserted++
      }
    } else {
      console.log('library user already in production')
    }

    // ----------------------------------------------------------- ingredients
    const srcIngredients = await staging.ingredient.findMany()
    const dstSlugs = new Set(
      (await prod.ingredient.findMany({ select: { slug: true } })).map((i) => i.slug),
    )
    const newIngredients = srcIngredients.filter((i) => !dstSlugs.has(i.slug))
    console.log(
      `ingredients: ${srcIngredients.length} on staging, ${dstSlugs.size} in production, ${newIngredients.length} to copy`,
    )

    if (apply && newIngredients.length) {
      for (let i = 0; i < newIngredients.length; i += CHUNK) {
        // Nullable Json columns read back as `null` but only accept
        // `undefined` on write, so they have to be re-mapped rather than
        // spread through verbatim.
        const batch = newIngredients.slice(i, i + CHUNK).map((ing) => ({
          ...ing,
          hiddenSources: (ing.hiddenSources as object) ?? undefined,
          substitutions: (ing.substitutions as object) ?? undefined,
        }))
        const res = await prod.ingredient.createMany({ data: batch, skipDuplicates: true })
        inserted += res.count
      }
    }

    // --------------------------------------------------------------- recipes
    const srcRecipes = await staging.recipe.findMany({
      where: { userId: srcLib.id, isPublic: true, publicSlug: { not: null } },
    })
    const dstRecipeSlugs = new Set(
      (
        await prod.recipe.findMany({
          where: { publicSlug: { not: null } },
          select: { publicSlug: true },
        })
      ).map((r) => r.publicSlug!),
    )
    const newRecipes = srcRecipes.filter((r) => !dstRecipeSlugs.has(r.publicSlug!))
    console.log(
      `public library recipes: ${srcRecipes.length} on staging, ${dstRecipeSlugs.size} in production, ${newRecipes.length} to copy`,
    )

    if (apply && newRecipes.length) {
      if (!dstLib) throw new Error('library user missing in production after create')
      for (let i = 0; i < newRecipes.length; i += CHUNK) {
        const batch = newRecipes.slice(i, i + CHUNK).map((r) => ({
          ...r,
          userId: dstLib!.id,
          // Search-join bookkeeping is rebuilt by the backfill against
          // production's own ingredient ids, never copied.
          nonStapleIngredientCount: 0,
          // Library recipes belong to no collection and are forks of nothing;
          // carrying a staging id in either would dangle.
          collectionId: null,
          forkedFromId: null,
          recipeData: r.recipeData as object,
          nutrition: (r.nutrition as object) ?? undefined,
          modifications: r.modifications as object,
        }))
        const res = await prod.recipe.createMany({ data: batch, skipDuplicates: true })
        inserted += res.count
        console.log(`  copied ${Math.min(i + CHUNK, newRecipes.length)}/${newRecipes.length}`)
      }
    }

    if (!apply) console.log('\nDry run complete — pass --apply to write.')
    else console.log(`\nDone — ${inserted} row(s) inserted.`)

    return { inserted, updated: 0, deleted: 0 }
  } finally {
    await staging.$disconnect()
    await prod.$disconnect()
  }
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
