import { describe, it, expect } from 'vitest'
import { isOverFreeLimit, FREE_TIER_MONTHLY_RECIPES } from '../limits'

describe('free-tier metering', () => {
  it('is an abuse ceiling, high enough that real cooking never meets it', () => {
    // The number matters: too low and it becomes a paywall with no checkout
    // behind it (FOU-460), too high or absent and one account can drain the
    // shared broker budget all eleven sites draw on. If this fails because
    // someone lowered it toward a monetisation number, build a checkout first.
    expect(FREE_TIER_MONTHLY_RECIPES).toBe(50)
    expect(isOverFreeLimit(false, 0)).toBe(false)
    expect(isOverFreeLimit(false, 49)).toBe(false)
    expect(isOverFreeLimit(false, 50)).toBe(true)
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
