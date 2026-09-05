/**
 * @description Seeds the public Allergen reference table (regulatory status, alternate label names, hidden sources, cross-reactivity, dining-out guidance) for the 15 canonical allergens in src/lib/allergens.ts ALLERGEN_VOCABULARY. Content comes ONLY from a paid frontier model — never a free lane, never DeepSeek. Since 2026-09-05 the live path is --from-file: the rows are written in-session by Claude Fable 5.1 into scripts/data/allergen-references.json and validated here against AllergenReferenceSchema (scripts/lib/allergen-verify.ts). Idempotent on slug; rows always land unpublished (published: false) so an editor reviews allergen content before it goes live.
 * @tables allergens
 *
 * Usage:
 *   npx tsx scripts/seed-allergens-ai.ts --from-file scripts/data/allergen-references.json --dry-run   # validate the file + print the plan — NO DB connection
 *   npx tsx scripts/seed-allergens-ai.ts --from-file scripts/data/allergen-references.json             # upsert every valid entry
 *   npx tsx scripts/seed-allergens-ai.ts --from-file … --count 3                                       # first 3 (vocabulary order)
 *   npx tsx scripts/seed-allergens-ai.ts [--count N] [--dry-run]                                       # model-driven mode — see below
 *
 * --dry-run is deliberately fully offline, same as seed-ingredient-ai.ts and
 * seed-recipe-allergen-backfill-ai.ts: this is the highest-liability content
 * on the site, so the dry run only describes the plan without contacting any
 * AI provider or the database. With --from-file it still validates every
 * entry against the schema, so a bad file is caught before anything connects.
 *
 * Model-driven mode calls verifyAllergenReference() (scripts/lib/allergen-verify.ts).
 * It is kept intact but currently has no provider: Azure was removed from
 * scripts/lib/ai-batch.ts on 2026-09-05 and the allergen lane may not use the
 * broker's DeepSeek-only seeding lane. It fails closed before any call.
 *
 * --from-file supplies exactly what verifyAllergenReference() would have
 * returned, and takes the SAME upsert path. The file shape:
 *   {
 *     "writtenBy": "<model or person>",   // provenance — required, echoed in the run log
 *     "writtenOn": "YYYY-MM-DD",
 *     "entries": [ { "slug": "<ALLERGEN_VOCABULARY token>", ...AllergenReferenceSchema fields } ]
 *   }
 * An entry that fails AllergenReferenceSchema, or whose slug is not in the
 * vocabulary, is reported by slug and skipped — never written.
 */
import './lib/load-env' // MUST stay first — see scripts/lib/load-env.ts (import hoisting)
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { ALLERGEN_VOCABULARY, allergenLabel, isAllergen, type Allergen } from '../src/lib/allergens'
import {
  AllergenReferenceSchema,
  normalizeAllergenReference,
  type AllergenReferenceResult,
} from './lib/allergen-verify'

// Version tag for the disclaimer/notice copy in force at the time this
// seeder's prompt rules were authored. Bump alongside a real change to
// ALLERGEN_REFERENCE_RULES, AllergenDisclaimer, or AllergyAwarenessNotice so
// existing rows can be audited against what they were published under.
//
// Writing-model audit trail (the Allergen model has no per-row source column):
//   - 2026-09-05: all 15 rows written by Claude Fable 5.1, in-session, via
//     --from-file scripts/data/allergen-references.json (the file records the
//     same provenance in its `writtenBy` / `writtenOn` fields).
const DISCLAIMER_VERSION = 'v1-2026-08-15'

const FromFileSchema = z.object({
  writtenBy: z.string().min(1),
  writtenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(z.object({ slug: z.string() }).passthrough()),
})

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
    fromFile: get('--from-file'),
  }
}

/**
 * Parse + validate the file. Fully offline. Returns the valid entries keyed by
 * slug (in vocabulary order) and the rejected slugs with their reasons — a
 * rejection is reported, never written, and never stops the valid entries.
 */
function loadFromFile(path: string, targets: Allergen[]) {
  const parsed = FromFileSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
  if (!parsed.success) {
    throw new Error(
      `[--from-file] ${path} is not { writtenBy, writtenOn, entries[] } — provenance is required for allergen content:\n` +
        parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n'),
    )
  }
  const { writtenBy, writtenOn, entries } = parsed.data

  const valid = new Map<Allergen, AllergenReferenceResult>()
  const rejected: { slug: string; reason: string }[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const { slug, ...fields } = entry
    if (seen.has(slug)) {
      rejected.push({ slug, reason: 'duplicate slug in file — later copy ignored' })
      continue
    }
    seen.add(slug)
    if (!isAllergen(slug)) {
      rejected.push({ slug, reason: 'not in ALLERGEN_VOCABULARY' })
      continue
    }
    const result = AllergenReferenceSchema.safeParse(fields)
    if (!result.success) {
      rejected.push({
        slug,
        reason: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; '),
      })
      continue
    }
    valid.set(slug, normalizeAllergenReference(result.data))
  }

  const missing = targets.filter((slug) => !valid.has(slug))
  return { writtenBy, writtenOn, valid, rejected, missing }
}

// Set only on real runs — dry-run never constructs a Prisma client.
let prismaRef: { $disconnect(): Promise<void> } | null = null

async function main() {
  const { count, dryRun, fromFile } = parseArgs()
  const targets: Allergen[] = count ? ALLERGEN_VOCABULARY.slice(0, count) : [...ALLERGEN_VOCABULARY]

  const file = fromFile ? loadFromFile(fromFile, targets) : null
  if (file) {
    console.log(`--from-file ${fromFile}: written by ${file.writtenBy} on ${file.writtenOn}`)
    console.log(`  ${file.valid.size} valid entr${file.valid.size === 1 ? 'y' : 'ies'}, ${file.rejected.length} rejected`)
    for (const r of file.rejected) console.log(`  ✗ ${r.slug}: ${r.reason}`)
    if (file.missing.length) console.log(`  not in file (will be skipped): ${file.missing.join(', ')}`)
  }
  const plan: Allergen[] = file ? targets.filter((slug) => file.valid.has(slug)) : targets

  if (dryRun) {
    // Fully offline by design — no AI providers or DB are contacted.
    console.log('\nDry run — no AI or DB calls made. A real run would:')
    console.log(`  1. Upsert by slug for ${plan.length} canonical allergen(s):`)
    for (const slug of plan) {
      console.log(`       ${slug} (${allergenLabel(slug)})`)
    }
    if (file) {
      console.log('  2. Take alternateNames / regulatoryStatus / hiddenSources / crossReactivity / diningOutGuidance')
      console.log('     from the file — every entry above already passed AllergenReferenceSchema. No model call.')
    } else {
      console.log(
        '  2. Generate alternateNames / regulatoryStatus / hiddenSources / crossReactivity / diningOutGuidance',
      )
      console.log('     via verifyAllergenReference() — a paid frontier model only, no fallback.')
    }
    console.log('     Three-state language only, never "free from", no medical thresholds or severity claims.')
    console.log('  3. Write disclaimerVersion = ' + JSON.stringify(DISCLAIMER_VERSION) + ' on every row.')
    console.log(
      '  4. On CREATE only: published = false. On UPDATE (re-run): published is left untouched — an existing',
    )
    console.log('     editorial approval is never silently reverted by a re-run (FOU-402).')
    if (!file) {
      console.log(
        '\nModel-driven mode currently has no provider (Azure removed 2026-09-05; allergens may not use the DeepSeek lane).',
      )
      console.log('Use --from-file scripts/data/allergen-references.json.')
    }
    return
  }

  const { prisma } = await import('./_prisma')
  prismaRef = prisma
  const { verifyAllergenReference, requireVerifierEnv, UNVERIFIED_NOTICE } = await import('./lib/allergen-verify')

  // --from-file makes no model call, so the provider gate does not apply to it.
  if (!file) requireVerifierEnv() // fail closed before any generation

  console.log(`\nSeeding ${plan.length} allergen reference row(s)...`)
  let created = 0
  let updated = 0

  for (const [i, slug] of plan.entries()) {
    const name = allergenLabel(slug)
    const verified = file ? file.valid.get(slug)! : await verifyAllergenReference({ slug, name })

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
    console.log(`  [${i + 1}/${plan.length}] ${name} (${slug}) — ${existing ? 'updated' : 'created'}`)
  }

  console.log(`\nDone — ${created} created, ${updated} updated. All rows written with published unchanged/false.`)
  console.log('New/created rows are unpublished by default — review before flipping published = true.')
  if (file) console.log(`Written by ${file.writtenBy} on ${file.writtenOn} (${fromFile}).`)
  console.log(UNVERIFIED_NOTICE)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prismaRef?.$disconnect().catch(() => undefined))
