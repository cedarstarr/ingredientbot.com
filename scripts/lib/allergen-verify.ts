/**
 * Dual-model allergen verification gate for batch seed/backfill scripts.
 *
 * A wrong allergen answer is a safety failure, not a quality failure, so no
 * allergen-bearing field is ever written from a single model's guess, and the
 * free Cerebras/Groq lane is never involved:
 *
 *   1. GENERATE via Azure GPT-5 (paid frontier) through ai-batch with
 *      `providers: ['azure']` — hard-fails if Azure env is missing, no
 *      free-lane fallback of any kind.
 *   2. INDEPENDENTLY RE-DERIVE the allergen sets from the same ingredient
 *      list via Anthropic claude-opus-5 (mirrors the runtime safety lane in
 *      src/lib/ai.ts — that lane itself is untouched). Requires
 *      ANTHROPIC_API_KEY; fails closed if absent.
 *   3. Exact-set agreement on `allergens` AND `mayContain` → accept + stamp
 *      allergenVerifiedAt. ANY disagreement → full detail appended to
 *      scripts/allergen-review.jsonl and NOTHING allergen-related is written
 *      to the DB for that row.
 *
 * Three-state honesty: `contains` / `may contain` / absent. Absence of a flag
 * is never a "free from X" claim, and callers must render it that way.
 *
 * Vocabulary is the canonical FDA top-9 + EU-14 union in src/lib/allergens.ts.
 */
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { batchObject } from './ai-batch'
import { ALLERGEN_VOCABULARY, type Allergen } from '../../src/lib/allergens'

// Mirrors SAFETY_MODEL in src/lib/ai.ts. Kept as a local const on purpose:
// importing the runtime module here would drag Next-only deps into a tsx script.
const SAFETY_MODEL = 'claude-opus-5'

export const REVIEW_FILE = resolve(__dirname, '..', 'allergen-review.jsonl')

const AllergenEnum = z.enum(ALLERGEN_VOCABULARY)

const AllergenSetsSchema = z.object({
  allergens: z.array(AllergenEnum).describe('Allergens CONFIRMED present in the listed ingredients'),
  mayContain: z
    .array(AllergenEnum)
    .describe('Plausible but unconfirmed: typical cross-contamination or ambiguous-ingredient risk'),
  notes: z.string().describe('One short sentence explaining any non-obvious flag; empty string if none'),
})

const HiddenSourceSchema = z.object({
  product: z.string(),
  why: z.string(),
})

const SubstitutionSchema = z.object({
  reason: z.string().describe('Allergy-driven reason, e.g. "peanut-free", "dairy-free"'),
  substitute: z.string(),
  ratio: z.string(),
  notes: z.string(),
})

const IngredientBundleSchema = z.object({
  allergens: z.array(AllergenEnum).describe('Allergens this ingredient itself CONTAINS'),
  mayContain: z
    .array(AllergenEnum)
    .describe('Allergens commonly present via cross-contamination / shared processing'),
  hiddenSources: z
    .array(HiddenSourceSchema)
    .describe('Products that commonly and non-obviously contain this ingredient'),
  crossContamination: z
    .string()
    .describe('Short note on shared-equipment / processing contamination risk; empty string if negligible'),
  substitutions: z
    .array(SubstitutionSchema)
    .describe('Allergy-driven substitutions only (reasons like "peanut-free"); empty if none apply'),
})

export type HiddenSource = z.infer<typeof HiddenSourceSchema>
export type Substitution = z.infer<typeof SubstitutionSchema>

export type RecipeAllergenResult =
  | {
      verified: true
      allergens: Allergen[]
      mayContain: Allergen[]
      allergenNotes: string | null
      allergenVerifiedAt: Date
    }
  | { verified: false }

export type IngredientAllergenResult =
  | {
      verified: true
      allergenProfile: Allergen[]
      hiddenSources: HiddenSource[]
      crossContamination: string | null
      substitutions: Substitution[]
    }
  | { verified: false }

/** Fail closed before spending any Azure tokens: both halves of the gate must be able to run. */
export function requireVerifierEnv(): void {
  if (!process.env.AZURE_OPENAI_RESOURCE || !process.env.AZURE_OPENAI_API_KEY) {
    throw new Error(
      '[allergen-verify] AZURE_OPENAI_RESOURCE / AZURE_OPENAI_API_KEY not set — allergen generation is Azure-only, no free-lane fallback.',
    )
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      '[allergen-verify] ANTHROPIC_API_KEY not set — the independent claude-opus-5 cross-check is mandatory. Refusing to write single-model allergen data.',
    )
  }
}

const normalizeSet = (values: string[]): Allergen[] =>
  [...new Set(values.map((v) => v.trim().toLowerCase()))].sort() as Allergen[]

const setsEqual = (a: Allergen[], b: Allergen[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

function appendReview(entry: Record<string, unknown>): void {
  appendFileSync(REVIEW_FILE, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', 'utf8')
}

const VOCAB_LINE = `Allowed allergen values (use these exact snake_case tokens, nothing else): ${ALLERGEN_VOCABULARY.join(', ')}.`

const RULES_LINE = [
  'Rules: "allergens" = confirmed present in the listed ingredients.',
  '"mayContain" = plausible cross-contamination or ambiguous ingredients only.',
  'Never treat absence as proof an allergen is not present.',
  'wheat implies also flagging gluten_cereals; barley/rye/spelt/oats flag gluten_cereals.',
].join(' ')

/** Independent Anthropic re-derivation of the two allergen sets. Never sees Azure's answer. */
async function anthropicDeriveSets(subject: string, ingredients: string[]) {
  const { object } = await generateObject({
    model: anthropic(SAFETY_MODEL),
    schema: AllergenSetsSchema,
    system:
      'You are a food-allergen auditor. You classify ingredient lists against a fixed allergen vocabulary. ' +
      'Be conservative: when an ingredient is ambiguous, use mayContain rather than omitting it. ' +
      VOCAB_LINE,
    prompt:
      `Classify the allergens in this ingredient list.\n` +
      `Item: ${subject}\n` +
      `Ingredients:\n${ingredients.map((i) => `- ${i}`).join('\n')}\n\n` +
      RULES_LINE,
    temperature: 0,
  })
  return object
}

/**
 * Recipe-level gate: derive `allergens` / `mayContain` from an ingredient list
 * via Azure GPT-5, cross-check with claude-opus-5, accept only on exact-set
 * agreement on BOTH sets.
 */
export async function verifyRecipeAllergens(input: {
  subject: string
  ingredients: string[]
}): Promise<RecipeAllergenResult> {
  requireVerifierEnv()

  const azureRaw = await batchObject(
    `Identify allergens in this recipe's ingredient list.\n` +
      `Recipe: ${input.subject}\n` +
      `Ingredients:\n${input.ingredients.map((i) => `- ${i}`).join('\n')}\n\n` +
      RULES_LINE,
    AllergenSetsSchema,
    {
      providers: ['azure'],
      tier: 'quality',
      temperature: 0,
      system: 'You are a food-safety annotator for a recipe app. ' + VOCAB_LINE,
    },
  )

  const anthropicRaw = await anthropicDeriveSets(input.subject, input.ingredients)

  const azure = { allergens: normalizeSet(azureRaw.allergens), mayContain: normalizeSet(azureRaw.mayContain) }
  const claude = {
    allergens: normalizeSet(anthropicRaw.allergens),
    mayContain: normalizeSet(anthropicRaw.mayContain),
  }

  if (setsEqual(azure.allergens, claude.allergens) && setsEqual(azure.mayContain, claude.mayContain)) {
    return {
      verified: true,
      allergens: azure.allergens,
      mayContain: azure.mayContain,
      allergenNotes: azureRaw.notes.trim() || null,
      allergenVerifiedAt: new Date(),
    }
  }

  appendReview({
    kind: 'recipe',
    subject: input.subject,
    ingredients: input.ingredients,
    azure: { ...azure, notes: azureRaw.notes },
    anthropic: { ...claude, notes: anthropicRaw.notes },
    disagreement: {
      allergens: !setsEqual(azure.allergens, claude.allergens),
      mayContain: !setsEqual(azure.mayContain, claude.mayContain),
    },
  })
  return { verified: false }
}

/**
 * Ingredient-level gate: Azure generates the full allergen bundle
 * (allergenProfile + hiddenSources + crossContamination + substitutions);
 * claude-opus-5 independently re-derives the contains/mayContain sets for the
 * ingredient. The whole bundle is accepted only when both sets agree exactly —
 * a model that got the core classification wrong doesn't get to keep its prose.
 */
export async function verifyIngredientAllergens(input: {
  slug: string
  name: string
  category: string
}): Promise<IngredientAllergenResult> {
  requireVerifierEnv()

  const azureRaw = await batchObject(
    `Produce the allergen profile for a single food ingredient.\n` +
      `Ingredient: ${input.name} (category: ${input.category})\n\n` +
      RULES_LINE +
      ' hiddenSources lists products that commonly and non-obviously contain this ingredient. ' +
      'substitutions are allergy-driven only — swaps that remove an allergen this ingredient carries.',
    IngredientBundleSchema,
    {
      providers: ['azure'],
      tier: 'quality',
      temperature: 0,
      system: 'You are a food-safety annotator for an ingredient encyclopedia. ' + VOCAB_LINE,
    },
  )

  const anthropicRaw = await anthropicDeriveSets(input.name, [input.name])

  const azure = { allergens: normalizeSet(azureRaw.allergens), mayContain: normalizeSet(azureRaw.mayContain) }
  const claude = {
    allergens: normalizeSet(anthropicRaw.allergens),
    mayContain: normalizeSet(anthropicRaw.mayContain),
  }

  if (setsEqual(azure.allergens, claude.allergens) && setsEqual(azure.mayContain, claude.mayContain)) {
    return {
      verified: true,
      allergenProfile: azure.allergens,
      hiddenSources: azureRaw.hiddenSources,
      // mayContain has no dedicated Ingredient column — surface it inside the
      // cross-contamination note so the risk is not silently dropped.
      crossContamination:
        [
          azureRaw.crossContamination.trim(),
          azure.mayContain.length ? `May contain (cross-contamination risk): ${azure.mayContain.join(', ')}.` : '',
        ]
          .filter(Boolean)
          .join(' ') || null,
      substitutions: azureRaw.substitutions,
    }
  }

  appendReview({
    kind: 'ingredient',
    slug: input.slug,
    name: input.name,
    category: input.category,
    azure: { ...azure, crossContamination: azureRaw.crossContamination, hiddenSources: azureRaw.hiddenSources, substitutions: azureRaw.substitutions },
    anthropic: { ...claude, notes: anthropicRaw.notes },
    disagreement: {
      allergens: !setsEqual(azure.allergens, claude.allergens),
      mayContain: !setsEqual(azure.mayContain, claude.mayContain),
    },
  })
  return { verified: false }
}
