import { describe, it, expect } from 'vitest'
import { computePalate, type ComputePalateInput } from '@/lib/palate'

function recipe(overrides: Partial<ComputePalateInput['recipes'][number]> & { id: string }) {
  return {
    cuisine: null,
    tags: [],
    sourceIngredients: [],
    rating: null,
    modifications: [],
    ...overrides,
  }
}

describe('computePalate', () => {
  it('returns empty arrays for the empty-case (no recipes, no completions)', () => {
    const result = computePalate({ recipes: [], completions: [] })
    expect(result).toEqual({ lovedFlavors: [], avoidedIngredients: [], topCuisines: [] })
  })

  it('surfaces cuisine and tags from a highly-rated recipe (rating >= 4)', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'r1', rating: 5, cuisine: 'Thai', tags: ['spicy', 'citrusy'] }),
      ],
      completions: [],
    })
    expect(result.topCuisines).toEqual(['Thai'])
    expect(result.lovedFlavors.sort()).toEqual(['citrusy', 'spicy'])
    expect(result.avoidedIngredients).toEqual([])
  })

  it('surfaces source ingredients as avoided from a poorly-rated recipe (rating <= 2)', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'r1', rating: 1, cuisine: 'French', sourceIngredients: ['liver', 'anchovy'] }),
      ],
      completions: [],
    })
    expect(result.avoidedIngredients.sort()).toEqual(['anchovy', 'liver'])
    // a low rating should not promote the cuisine as "top"
    expect(result.topCuisines).toEqual([])
    expect(result.lovedFlavors).toEqual([])
  })

  it('treats a repeat-cooked recipe (2+ completions) as a strong positive signal', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'r1', cuisine: 'Mexican', tags: ['smoky'] }),
      ],
      completions: [
        { recipeId: 'r1', outcome: null },
        { recipeId: 'r1', outcome: null },
      ],
    })
    expect(result.topCuisines).toEqual(['Mexican'])
    expect(result.lovedFlavors).toEqual(['smoky'])
  })

  it('a single cook (not repeat) with no rating and no outcome contributes no signal', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'r1', cuisine: 'Mexican', tags: ['smoky'] }),
      ],
      completions: [{ recipeId: 'r1', outcome: null }],
    })
    expect(result.topCuisines).toEqual([])
    expect(result.lovedFlavors).toEqual([])
  })

  it('RecipeCompletion.outcome "great" is a positive signal, "failed" is negative', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'r1', cuisine: 'Japanese', tags: ['umami'] }),
        recipe({ id: 'r2', cuisine: 'German', sourceIngredients: ['sauerkraut'] }),
      ],
      completions: [
        { recipeId: 'r1', outcome: 'great' },
        { recipeId: 'r2', outcome: 'failed' },
      ],
    })
    expect(result.topCuisines).toEqual(['Japanese'])
    expect(result.lovedFlavors).toEqual(['umami'])
    expect(result.avoidedIngredients).toEqual(['sauerkraut'])
  })

  it('"okay" outcome alone is neutral — no rating means no net signal', () => {
    const result = computePalate({
      recipes: [recipe({ id: 'r1', cuisine: 'Korean', tags: ['fermented'] })],
      completions: [{ recipeId: 'r1', outcome: 'okay' }],
    })
    expect(result.topCuisines).toEqual([])
    expect(result.lovedFlavors).toEqual([])
  })

  it('reads ingredient removals out of recipe.modifications (diet-conversion changes) as a dislike signal', () => {
    const result = computePalate({
      recipes: [
        recipe({
          id: 'r1',
          rating: 3, // neutral rating — the removal signal must stand on its own
          modifications: [
            {
              type: 'diet-conversion',
              diet: 'gluten-free',
              conversion: {
                changes: [{ original: 'wheat pasta', replacement: 'rice noodles', reason: 'gluten-free' }],
              },
              timestamp: '2026-08-01T00:00:00.000Z',
            },
          ],
        }),
      ],
      completions: [],
    })
    expect(result.avoidedIngredients).toEqual(['wheat pasta'])
  })

  it('ignores malformed/foreign modifications entries without throwing', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'r1', rating: 5, cuisine: 'Italian', modifications: [{ type: 'something-else' }, 'not-an-object', null] }),
        recipe({ id: 'r2', rating: 5, cuisine: 'Italian', modifications: 'not-an-array' }),
      ],
      completions: [],
    })
    expect(result.topCuisines).toEqual(['Italian'])
    expect(result.avoidedIngredients).toEqual([])
  })

  it('caps each output array at 8 entries, ranked by signal strength', () => {
    const cuisines = Array.from({ length: 12 }, (_, i) => `Cuisine${i}`)
    const result = computePalate({
      recipes: cuisines.map((c, i) => recipe({ id: `r${i}`, rating: 5, cuisine: c })),
      completions: [],
    })
    expect(result.topCuisines).toHaveLength(8)
  })

  it('ranks stronger signals first (repeat-cooked + great outcome beats a single 4-star rating)', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'weak', rating: 4, cuisine: 'Weak Cuisine' }),
        recipe({ id: 'strong', cuisine: 'Strong Cuisine' }),
      ],
      completions: [
        { recipeId: 'strong', outcome: 'great' },
        { recipeId: 'strong', outcome: 'great' },
      ],
    })
    expect(result.topCuisines[0]).toBe('Strong Cuisine')
    expect(result.topCuisines[1]).toBe('Weak Cuisine')
  })

  it('aggregates the same ingredient/tag/cuisine across multiple recipes (case-insensitive)', () => {
    const result = computePalate({
      recipes: [
        recipe({ id: 'r1', rating: 4, cuisine: 'Italian', tags: ['garlicky'] }),
        recipe({ id: 'r2', rating: 4, cuisine: 'italian', tags: ['Garlicky'] }),
      ],
      completions: [],
    })
    expect(result.topCuisines).toEqual(['Italian'])
    expect(result.lovedFlavors).toEqual(['garlicky'])
  })
})
