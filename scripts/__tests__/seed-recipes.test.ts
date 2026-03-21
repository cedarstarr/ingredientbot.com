import { describe, it, expect, vi } from 'vitest'

// Mock @prisma/client before importing the module under test
vi.mock('@prisma/client', () => {
  const PrismaClient = function () {
    return {
      user: { findUnique: vi.fn() },
      recipe: { create: vi.fn() },
      $disconnect: vi.fn(),
    }
  }
  return { PrismaClient }
})

import { buildRawText, buildRecipeRecord, type RecipeInput } from '../seed-recipes'

// A minimal, representative recipe fixture used across tests
const sampleRecipe: RecipeInput = {
  title: 'Test Pasta',
  description: 'A simple test pasta dish.',
  servings: 4,
  prepTimeMin: 10,
  cookTimeMin: 20,
  cuisine: 'Italian',
  difficulty: 'easy',
  ingredients: [
    { name: 'pasta', amount: '200', unit: 'g' },
    { name: 'tomato sauce', amount: '1', unit: 'cup' },
    { name: 'parmesan', amount: '2', unit: 'tbsp' },
  ],
  steps: [
    'Boil the pasta in salted water until al dente.',
    'Warm the tomato sauce in a separate pan.',
    'Drain the pasta and toss with the sauce.',
  ],
  notes: 'Top with fresh basil for extra flavour.',
  nutrition: { calories: 350, protein: 12, fat: 8, carbs: 55, fiber: 4 },
}

const sampleRecipeNoNotes: RecipeInput = {
  ...sampleRecipe,
  notes: undefined as unknown as string,
}

describe('buildRawText', () => {
  it('starts with a Markdown h1 containing the recipe title', () => {
    const text = buildRawText(sampleRecipe)
    expect(text).toMatch(/^# Test Pasta/)
  })

  it('includes the recipe description', () => {
    const text = buildRawText(sampleRecipe)
    expect(text).toContain('A simple test pasta dish.')
  })

  it('includes an Ingredients section header', () => {
    const text = buildRawText(sampleRecipe)
    expect(text).toContain('## Ingredients')
  })

  it('lists each ingredient as a bullet in the format "- amount unit name"', () => {
    const text = buildRawText(sampleRecipe)
    expect(text).toContain('- 200 g pasta')
    expect(text).toContain('- 1 cup tomato sauce')
    expect(text).toContain('- 2 tbsp parmesan')
  })

  it('includes an Instructions section header', () => {
    const text = buildRawText(sampleRecipe)
    expect(text).toContain('## Instructions')
  })

  it('numbers the steps starting from 1', () => {
    const text = buildRawText(sampleRecipe)
    expect(text).toContain('1. Boil the pasta in salted water until al dente.')
    expect(text).toContain('2. Warm the tomato sauce in a separate pan.')
    expect(text).toContain('3. Drain the pasta and toss with the sauce.')
  })

  it('includes a Notes section when notes are present', () => {
    const text = buildRawText(sampleRecipe)
    expect(text).toContain('## Notes')
    expect(text).toContain('Top with fresh basil for extra flavour.')
  })

  it('omits the Notes section when notes are absent', () => {
    const text = buildRawText(sampleRecipeNoNotes)
    expect(text).not.toContain('## Notes')
  })

  it('returns a non-empty string', () => {
    const text = buildRawText(sampleRecipe)
    expect(text.length).toBeGreaterThan(0)
  })

  it('returns a string (not an array or other type)', () => {
    const text = buildRawText(sampleRecipe)
    expect(typeof text).toBe('string')
  })
})

describe('buildRecipeRecord', () => {
  const userId = 'user_abc123'

  it('sets userId to the provided value', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    expect(record.userId).toBe(userId)
  })

  it('copies scalar fields from the recipe input', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    expect(record.title).toBe('Test Pasta')
    expect(record.description).toBe('A simple test pasta dish.')
    expect(record.servings).toBe(4)
    expect(record.prepTimeMin).toBe(10)
    expect(record.cookTimeMin).toBe(20)
    expect(record.cuisine).toBe('Italian')
    expect(record.difficulty).toBe('easy')
  })

  it('extracts ingredient names into sourceIngredients array', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    expect(record.sourceIngredients).toEqual(['pasta', 'tomato sauce', 'parmesan'])
  })

  it('stores the full recipe object as recipeData', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    expect(record.recipeData).toEqual(sampleRecipe)
  })

  it('sets rawText to the output of buildRawText', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    const expectedRawText = buildRawText(sampleRecipe)
    expect(record.rawText).toBe(expectedRawText)
  })

  it('sets nutrition to the recipe nutrition object', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    expect(record.nutrition).toEqual({ calories: 350, protein: 12, fat: 8, carbs: 55, fiber: 4 })
  })

  it('shape has all fields needed by Prisma recipe.create', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    const requiredKeys = [
      'userId',
      'title',
      'description',
      'servings',
      'prepTimeMin',
      'cookTimeMin',
      'cuisine',
      'difficulty',
      'sourceIngredients',
      'recipeData',
      'rawText',
      'nutrition',
    ]
    for (const key of requiredKeys) {
      expect(record).toHaveProperty(key)
    }
  })

  it('sourceIngredients length matches the ingredients array length', () => {
    const record = buildRecipeRecord(sampleRecipe, userId)
    expect(record.sourceIngredients).toHaveLength(sampleRecipe.ingredients.length)
  })

  it('works with a different userId producing the same shape', () => {
    const record1 = buildRecipeRecord(sampleRecipe, 'user_111')
    const record2 = buildRecipeRecord(sampleRecipe, 'user_222')
    expect(record1.userId).toBe('user_111')
    expect(record2.userId).toBe('user_222')
    // All other fields should be identical
    expect(record1.title).toBe(record2.title)
    expect(record1.sourceIngredients).toEqual(record2.sourceIngredients)
  })
})
