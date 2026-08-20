// F87: derived taste profile. Nothing here is user-entered — every signal is
// inferred from behaviour (ratings, repeat-cooking, post-cook outcomes, and
// ingredient swaps), matching PalateProfile's own doc comment in schema.prisma.
//
// computePalate() is a pure function: no Prisma, no I/O, fully unit-testable.
// loadPalateInputs() does the one round of fetching; getPalateProfile() glues
// the two together with the lazy 24h-staleness recompute used by the recipe
// routes (no cron — see F87 spec).

import { prisma } from '@/lib/prisma'

const STALE_MS = 24 * 60 * 60 * 1000
const MAX_ITEMS = 8

// Score weights. Larger magnitude = stronger signal. Kept as named constants
// (not inlined) so the relative weighting is a single readable table.
const WEIGHT = {
  ratingPositive: 2, // Recipe.rating >= 4
  ratingNegative: 2, // Recipe.rating <= 2
  repeatCook: 1, // extra bump when a recipe has been cooked more than once
  outcomeGreat: 2, // RecipeCompletion.outcome === 'great'
  outcomeFailed: 2, // RecipeCompletion.outcome === 'failed'
  ingredientRemoval: 2, // an ingredient swapped away via recipe.modifications
} as const

export interface PalateRecipeInput {
  /** Correlates with PalateCompletionInput.recipeId — needed to find repeat-cook / outcome signals. */
  id: string
  cuisine: string | null
  tags: string[]
  sourceIngredients: string[]
  rating: number | null
  /** Json field — shape is loosely typed at the DB level; parsed defensively below. */
  modifications: unknown
}

export interface PalateCompletionInput {
  recipeId: string
  outcome: string | null
}

export interface ComputePalateInput {
  recipes: PalateRecipeInput[]
  completions: PalateCompletionInput[]
}

export interface PalateResult {
  lovedFlavors: string[]
  avoidedIngredients: string[]
  topCuisines: string[]
}

/**
 * Ingredient swaps recorded on Recipe.modifications. The only writer today is
 * the F62 diet-conversion route, which appends
 * `{ type: 'diet-conversion', conversion: { changes: [{ original, replacement }] } }`.
 * We read `original` as an avoided ingredient — the user (or an allergy/diet
 * constraint) chose not to keep it. Defensive parsing throughout: the field is
 * an untyped Json column and older/foreign rows may not match this shape.
 */
function extractRemovedIngredients(modifications: unknown): string[] {
  if (!Array.isArray(modifications)) return []
  const removed: string[] = []
  for (const entry of modifications) {
    if (!entry || typeof entry !== 'object') continue
    const conversion = (entry as { conversion?: unknown }).conversion
    if (!conversion || typeof conversion !== 'object') continue
    const changes = (conversion as { changes?: unknown }).changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      if (change && typeof change === 'object' && typeof (change as { original?: unknown }).original === 'string') {
        const original = (change as { original: string }).original.trim()
        if (original) removed.push(original)
      }
    }
  }
  return removed
}

/** Accumulates weighted scores keyed by a normalized (lowercased/trimmed) key. */
class SignalTally {
  private scores = new Map<string, number>()
  private display = new Map<string, string>()

  add(raw: string, weight: number) {
    const value = raw.trim()
    if (!value) return
    const key = value.toLowerCase()
    this.scores.set(key, (this.scores.get(key) ?? 0) + weight)
    if (!this.display.has(key)) this.display.set(key, value)
  }

  /** Top N by score descending, ties broken alphabetically for determinism. Only positive scores qualify. */
  top(n: number): string[] {
    return [...this.scores.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([key]) => this.display.get(key) ?? key)
  }
}

export function computePalate(input: ComputePalateInput): PalateResult {
  const flavors = new SignalTally() // sourced from tags (closest thing to a flavor descriptor in the schema)
  const avoided = new SignalTally()
  const cuisines = new SignalTally()

  const completionsByRecipe = new Map<string, PalateCompletionInput[]>()
  for (const c of input.completions) {
    const list = completionsByRecipe.get(c.recipeId)
    if (list) list.push(c)
    else completionsByRecipe.set(c.recipeId, [c])
  }

  for (const recipe of input.recipes) {
    let score = 0
    if (typeof recipe.rating === 'number') {
      if (recipe.rating >= 4) score += WEIGHT.ratingPositive
      else if (recipe.rating <= 2) score -= WEIGHT.ratingNegative
    }

    const completions = completionsByRecipe.get(recipe.id)
    if (completions?.length) {
      if (completions.length >= 2) score += WEIGHT.repeatCook // repeat-cooked = strong positive
      for (const c of completions) {
        if (c.outcome === 'great') score += WEIGHT.outcomeGreat
        else if (c.outcome === 'failed') score -= WEIGHT.outcomeFailed
      }
    }

    if (recipe.cuisine) cuisines.add(recipe.cuisine, score)
    if (score > 0) {
      for (const tag of recipe.tags) flavors.add(tag, score)
    } else if (score < 0) {
      for (const ingredient of recipe.sourceIngredients) avoided.add(ingredient, -score)
    }

    // Ingredient removals are a dislike signal independent of the recipe's
    // overall score — a swap-away happened regardless of how the rest of the
    // dish was received.
    for (const removedIngredient of extractRemovedIngredients(recipe.modifications)) {
      avoided.add(removedIngredient, WEIGHT.ingredientRemoval)
    }
  }

  return {
    lovedFlavors: flavors.top(MAX_ITEMS),
    avoidedIngredients: avoided.top(MAX_ITEMS),
    topCuisines: cuisines.top(MAX_ITEMS),
  }
}

/** One round of concurrent queries — no N+1: two findMany calls, not one per recipe. */
export async function loadPalateInputs(userId: string): Promise<ComputePalateInput> {
  const [recipes, completions] = await Promise.all([
    prisma.recipe.findMany({
      where: { userId },
      select: {
        id: true,
        cuisine: true,
        tags: true,
        sourceIngredients: true,
        rating: true,
        modifications: true,
      },
    }),
    prisma.recipeCompletion.findMany({
      where: { userId },
      select: { recipeId: true, outcome: true },
    }),
  ])
  return { recipes, completions }
}

export interface PalateProfileData extends PalateResult {
  computedAt: Date
}

/**
 * Lazy recompute (no cron): returns the cached PalateProfile if it's fresh
 * (<24h old), otherwise recomputes from current data and upserts. Used by both
 * /api/recipes/generate and /api/recipes/cook so their cache keys and prompt
 * injections see the same profile.
 */
export async function getPalateProfile(userId: string): Promise<PalateProfileData | null> {
  const existing = await prisma.palateProfile.findUnique({
    where: { userId },
    select: { lovedFlavors: true, avoidedIngredients: true, topCuisines: true, computedAt: true },
  })

  const isFresh = existing && Date.now() - existing.computedAt.getTime() < STALE_MS
  if (isFresh) return existing

  const { recipes, completions } = await loadPalateInputs(userId)
  // Nothing to learn from yet — don't write an empty row for a brand-new user;
  // leave PalateProfile absent so the settings UI shows the honest empty state.
  if (recipes.length === 0 && completions.length === 0) return existing ?? null

  const computed = computePalate({ recipes, completions })
  const saved = await prisma.palateProfile.upsert({
    where: { userId },
    create: { userId, ...computed },
    update: { ...computed, computedAt: new Date() },
    select: { lovedFlavors: true, avoidedIngredients: true, topCuisines: true, computedAt: true },
  })
  return saved
}
