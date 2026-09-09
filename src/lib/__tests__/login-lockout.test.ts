import { describe, it, expect } from 'vitest'
import {
  LOCKOUT_FREE_ATTEMPTS,
  LOCKOUT_MAX_MINUTES,
  computeLockoutMinutes,
  isLockedOut,
} from '@/lib/login-lockout'

describe('computeLockoutMinutes — below/at the free-attempt threshold', () => {
  it('does not lock below the threshold', () => {
    for (let attempts = 1; attempts < LOCKOUT_FREE_ATTEMPTS; attempts++) {
      expect(computeLockoutMinutes(attempts)).toBeNull()
    }
  })

  it('does not lock exactly at the threshold', () => {
    expect(computeLockoutMinutes(LOCKOUT_FREE_ATTEMPTS)).toBeNull()
  })
})

describe('computeLockoutMinutes — progressive backoff above the threshold', () => {
  it('locks 1 minute on the first attempt past the threshold', () => {
    expect(computeLockoutMinutes(LOCKOUT_FREE_ATTEMPTS + 1)).toBe(1)
  })

  it('locks 2 minutes on the second attempt past the threshold', () => {
    expect(computeLockoutMinutes(LOCKOUT_FREE_ATTEMPTS + 2)).toBe(2)
  })

  it('locks 4 minutes on the third attempt past the threshold', () => {
    expect(computeLockoutMinutes(LOCKOUT_FREE_ATTEMPTS + 3)).toBe(4)
  })

  it('locks 8 minutes on the fourth attempt past the threshold', () => {
    expect(computeLockoutMinutes(LOCKOUT_FREE_ATTEMPTS + 4)).toBe(8)
  })
})

describe('computeLockoutMinutes — cap', () => {
  it('caps at LOCKOUT_MAX_MINUTES on the fifth attempt past the threshold (would be 16 uncapped)', () => {
    expect(computeLockoutMinutes(LOCKOUT_FREE_ATTEMPTS + 5)).toBe(LOCKOUT_MAX_MINUTES)
  })

  it('never exceeds LOCKOUT_MAX_MINUTES no matter how many further failures accumulate', () => {
    for (const extra of [6, 10, 20, 100]) {
      const minutes = computeLockoutMinutes(LOCKOUT_FREE_ATTEMPTS + extra)
      expect(minutes).not.toBeNull()
      expect(minutes as number).toBeLessThanOrEqual(LOCKOUT_MAX_MINUTES)
    }
  })
})

describe('isLockedOut', () => {
  it('is false for null', () => {
    expect(isLockedOut(null)).toBe(false)
  })

  it('is false for undefined', () => {
    expect(isLockedOut(undefined)).toBe(false)
  })

  it('is false for a lock that already expired', () => {
    const past = new Date(Date.now() - 60_000)
    expect(isLockedOut(past)).toBe(false)
  })

  it('is true for a lock still in the future', () => {
    const future = new Date(Date.now() + 60_000)
    expect(isLockedOut(future)).toBe(true)
  })
})
