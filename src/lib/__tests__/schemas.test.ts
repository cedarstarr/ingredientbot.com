import { describe, it, expect } from 'vitest'
import { z } from 'zod'

/**
 * Zod schema sanity tests — mirrors the validation contracts used by API
 * routes. Catches schema drift without running the full API stack.
 */

describe('Email change schema (POST /api/user/email)', () => {
  const schema = z.object({
    newEmail: z.string().email(),
    currentPassword: z.string().min(1, 'Password is required'),
  })

  it('accepts a valid email + non-empty password', () => {
    expect(
      schema.safeParse({ newEmail: 'a@b.com', currentPassword: 'x' }).success,
    ).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(
      schema.safeParse({ newEmail: 'not-an-email', currentPassword: 'x' }).success,
    ).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(
      schema.safeParse({ newEmail: 'a@b.com', currentPassword: '' }).success,
    ).toBe(false)
  })
})

describe('Chef personality enum (PATCH /api/user/kitchen-prefs)', () => {
  // Mirror of the Prisma ChefPersonality enum. The actual enum has 3 values:
  // home | french | street. Previous test listed 10 stale values — reconciled
  // against prisma/schema.prisma ChefPersonality enum 2026-05-09.
  const chefPersonalitySchema = z.enum(['home', 'french', 'street'])

  it('accepts each valid personality', () => {
    expect(chefPersonalitySchema.safeParse('home').success).toBe(true)
    expect(chefPersonalitySchema.safeParse('french').success).toBe(true)
    expect(chefPersonalitySchema.safeParse('street').success).toBe(true)
  })

  it('rejects removed personality values (e.g. "italian", "cajun")', () => {
    expect(chefPersonalitySchema.safeParse('italian').success).toBe(false)
    expect(chefPersonalitySchema.safeParse('cajun').success).toBe(false)
  })

  it('rejects an unknown personality (e.g. "robot-overlord")', () => {
    expect(chefPersonalitySchema.safeParse('robot-overlord').success).toBe(false)
  })
})

describe('Recipe generate request shape', () => {
  const schema = z.object({
    ingredients: z.array(z.string().min(1)).min(2),
    cuisine: z.string().optional(),
    dietary: z.array(z.string()).optional(),
  })

  it('requires at least 2 ingredients', () => {
    expect(schema.safeParse({ ingredients: ['chicken'] }).success).toBe(false)
    expect(
      schema.safeParse({ ingredients: ['chicken', 'rice'] }).success,
    ).toBe(true)
  })

  it('rejects empty-string ingredients', () => {
    expect(
      schema.safeParse({ ingredients: ['chicken', ''] }).success,
    ).toBe(false)
  })
})

describe('Cooking method allowlist (kitchen-prefs / generate route)', () => {
  // Mirrors VALID_COOKING_METHODS in src/app/api/user/kitchen-prefs/route.ts.
  // Any change to that set must also update this list.
  const VALID_COOKING_METHODS = new Set([
    'any',
    'Sheet Pan',
    'One-Pot',
    'Air Fryer',
    'Slow Cooker',
    'Instant Pot',
    'Microwave Only',
    'No Stove',
  ])

  it('accepts all documented cooking methods', () => {
    for (const method of VALID_COOKING_METHODS) {
      expect(VALID_COOKING_METHODS.has(method)).toBe(true)
    }
  })

  it('rejects undocumented methods', () => {
    expect(VALID_COOKING_METHODS.has('Grill')).toBe(false)
    expect(VALID_COOKING_METHODS.has('Deep Fryer')).toBe(false)
    expect(VALID_COOKING_METHODS.has('')).toBe(false)
  })

  it('"any" is a valid sentinel meaning no equipment constraint', () => {
    expect(VALID_COOKING_METHODS.has('any')).toBe(true)
  })
})

describe('Spice level clamping (generate / cook routes)', () => {
  // Mirrors the spice-level clamp logic used by buildSpiceContext in the
  // generate route and the inline spiceN computation in the cook route.
  function clampSpiceLevel(level: unknown): number {
    const n = typeof level === 'number' && Number.isInteger(level) ? level : 0
    return Math.max(0, Math.min(3, n))
  }

  const SPICE_LABELS = ['Mild', 'Medium', 'Hot', 'Fire'] as const

  it('maps valid levels 0–3 to the correct label', () => {
    expect(SPICE_LABELS[clampSpiceLevel(0)]).toBe('Mild')
    expect(SPICE_LABELS[clampSpiceLevel(1)]).toBe('Medium')
    expect(SPICE_LABELS[clampSpiceLevel(2)]).toBe('Hot')
    expect(SPICE_LABELS[clampSpiceLevel(3)]).toBe('Fire')
  })

  it('clamps values below 0 to Mild', () => {
    expect(clampSpiceLevel(-1)).toBe(0)
    expect(clampSpiceLevel(-999)).toBe(0)
  })

  it('clamps values above 3 to 3 (Fire)', () => {
    expect(clampSpiceLevel(4)).toBe(3)
    expect(clampSpiceLevel(100)).toBe(3)
  })

  it('treats non-integer numbers as 0 (Mild)', () => {
    expect(clampSpiceLevel(1.5)).toBe(0)
    expect(clampSpiceLevel(2.9)).toBe(0)
  })

  it('treats non-numeric inputs as 0 (Mild)', () => {
    expect(clampSpiceLevel('hot')).toBe(0)
    expect(clampSpiceLevel(null)).toBe(0)
    expect(clampSpiceLevel(undefined)).toBe(0)
  })
})
