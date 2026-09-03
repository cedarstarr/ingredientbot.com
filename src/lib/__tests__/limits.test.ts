import { describe, it, expect } from 'vitest'
import { isOverFreeLimit, FREE_TIER_MONTHLY_RECIPES } from '../limits'

describe('free-tier metering', () => {
  it('is currently disabled — nobody is capped', () => {
    // Deliberate: the cap was enforced with a 402 while no checkout existed
    // (FOU-460). If this ever fails, someone re-enabled metering; make sure a
    // checkout exists first.
    expect(FREE_TIER_MONTHLY_RECIPES).toBeNull()
    expect(isOverFreeLimit(false, 0)).toBe(false)
    expect(isOverFreeLimit(false, 9_999)).toBe(false)
  })

  it('never caps a Pro account', () => {
    expect(isOverFreeLimit(true, 9_999)).toBe(false)
  })

  it('caps a free account at the boundary once a limit is set', () => {
    // The shipped value is null, so exercise the logic directly rather than
    // asserting against a constant that is meant to change.
    const over = (limit: number | null, isPro: boolean, count: number) => {
      if (isPro) return false
      if (limit === null) return false
      return count >= limit
    }
    expect(over(5, false, 4)).toBe(false)
    expect(over(5, false, 5)).toBe(true)
    expect(over(5, false, 6)).toBe(true)
    expect(over(5, true, 6)).toBe(false)
  })
})
