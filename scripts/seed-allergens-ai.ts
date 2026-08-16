/**
 * @description Seeds the public Allergen reference table (regulatory status, alternate label names, hidden sources, cross-reactivity, dining-out guidance) for the 15 canonical allergens in src/lib/allergens.ts ALLERGEN_VOCABULARY. Generated ONLY via scripts/lib/allergen-verify.ts's verifyAllergenReference() on the paid Azure frontier model (tier: 'quality', providers: ['azure']) — no free-lane fallback, ever. Idempotent on slug; rows always land unpublished (published: false) so an editor reviews AI-generated allergen content before it goes live.
 * @tables allergens
 *
 * Usage:
 *   npx tsx scripts/seed-allergens-ai.ts               # all 15 canonical allergens
 *   npx tsx scripts/seed-allergens-ai.ts --count 3      # first 3
 *   npx tsx scripts/seed-allergens-ai.ts --dry-run      # print the plan — NO AI calls, NO DB connection
 *
 * --dry-run is deliberately fully offline, same as seed-ingredient-ai.ts and
 * seed-recipe-allergen-backfill-ai.ts: this is the highest-liability content
 * on the site, so the dry run only describes the plan without contacting any
 * AI provider or the database.
 *
 * Requires in /home/cedar/Projects/.env:
 *   AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY   (generation — no free-lane fallback, this is a hard rule)
 *
 * PROMPT REVIEW: the actual instructions sent to the model live in
 * scripts/lib/allergen-verify.ts (ALLERGEN_REFERENCE_RULES + RULES_LINE +
 * VOCAB_LINE, used by verifyAllergenReference()). Read that file before
 * running this for real — this script only supplies the per-allergen name.
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { ALLERGEN_VOCABULARY, allergenLabel, type Allergen } from '../src/lib/allergens'

// Version tag for the disclaimer/notice copy in force at the time this
// seeder's prompt rules were authored. Bump alongside a real change to
// ALLERGEN_REFERENCE_RULES, AllergenDisclaimer, or AllergyAwarenessNotice so
// existing rows can be audited against what they were published under.
const DISCLAIMER_VERSION = 'v1-2026-08-15'

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
  const targets: Allergen[] = count ? ALLERGEN_VOCABULARY.slice(0, count) : [...ALLERGEN_VOCABULARY]

  if (dryRun) {
    // Fully offline by design — no AI providers or DB are contacted.
    console.log('Dry run — no AI or DB calls made. A real run would:')
    console.log(`  1. Upsert by slug for ${targets.length} canonical allergen(s):`)
    for (const slug of targets) {
      console.log(`       ${slug} (${allergenLabel(slug)})`)
    }
    console.log(
      '  2. Generate alternateNames / regulatoryStatus / hiddenSources / crossReactivity / diningOutGuidance',
    )
    console.log('     via verifyAllergenReference() — the paid Azure frontier model, tier=quality, no fallback.')
    console.log('     Three-state language only, never "free from", no medical thresholds or severity claims.')
    console.log('  3. Write disclaimerVersion = ' + JSON.stringify(DISCLAIMER_VERSION) + ' on every row.')
    console.log(
      '  4. On CREATE only: published = false. On UPDATE (re-run): published is left untouched — an existing',
    )
    console.log('     editorial approval is never silently reverted by a re-run (FOU-402).')
    console.log(
      '\nReal run requires AZURE_OPENAI_RESOURCE + AZURE_OPENAI_API_KEY (no free-lane fallback for this lane).',
    )
    return
  }

  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { verifyAllergenReference, requireVerifierEnv, UNVERIFIED_NOTICE } = await import('./lib/allergen-verify')

  requireVerifierEnv() // fail closed before any generation — throws if Azure creds are absent

  console.log(`Seeding ${targets.length} allergen reference row(s)...`)
  let created = 0
  let updated = 0

  for (const [i, slug] of targets.entries()) {
    const name = allergenLabel(slug)
    const verified = await verifyAllergenReference({ slug, name })

    // Fields shared by both branches of the upsert. `published` is
    // deliberately NOT in here — see the create-vs-update asymmetry rule
    // (FOU-402): a published flag in a shared `data` object silently
    // un-publishes an editor-approved row on every re-run.
    const data = {
      name,
      regulatoryStatus: verified.regulatoryStatus,
      alternateNames: verified.alternateNames,
      hiddenSources: verified.hiddenSources,
      crossReactivity: verified.crossReactivity || null,
      diningOutGuidance: verified.diningOutGuidance || null,
      disclaimerVersion: DISCLAIMER_VERSION,
    }

    const existing = await prisma.allergen.findUnique({ where: { slug }, select: { id: true } })

    await prisma.allergen.upsert({
      where: { slug },
      create: { slug, ...data, published: false },
      update: data,
    })

    if (existing) updated++
    else created++
    console.log(`  [${i + 1}/${targets.length}] ${name} (${slug}) — ${existing ? 'updated' : 'created'}`)
  }

  console.log(`\nDone — ${created} created, ${updated} updated. All rows written with published unchanged/false.`)
  console.log('New/created rows are unpublished by default — review before flipping published = true.')
  console.log(UNVERIFIED_NOTICE)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prismaRef?.$disconnect().catch(() => undefined))
