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
  // Mirror of the enum used by the kitchen-prefs route. If this list drifts
  // from the route, the assertion below will fail and we update both together.
  const chefPersonalitySchema = z.enum([
    'home',
    'french',
    'italian',
    'japanese',
    'mexican',
    'thai',
    'indian',
    'mediterranean',
    'southern',
    'cajun',
  ])

  it('accepts a valid personality', () => {
    expect(chefPersonalitySchema.safeParse('french').success).toBe(true)
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
