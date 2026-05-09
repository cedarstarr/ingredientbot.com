import { describe, it, expect, vi, afterEach } from 'vitest'
import { startOfCurrentMonth } from '@/lib/date-utils'

describe('startOfCurrentMonth', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns midnight UTC on the 1st of the current month', () => {
    // Pin "now" to 2026-05-08T17:00:00Z
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T17:00:00Z'))

    const result = startOfCurrentMonth()
    expect(result.toISOString()).toBe('2026-05-01T00:00:00.000Z')
  })

  it('returns a Date instance', () => {
    const result = startOfCurrentMonth()
    expect(result).toBeInstanceOf(Date)
  })

  it('always returns the 1st at midnight UTC regardless of day/time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-31T23:59:59Z'))

    const result = startOfCurrentMonth()
    expect(result.getUTCDate()).toBe(1)
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
  })

  it('handles month boundary — December wraps correctly', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-15T12:00:00Z'))

    const result = startOfCurrentMonth()
    expect(result.getUTCFullYear()).toBe(2026)
    expect(result.getUTCMonth()).toBe(11) // 0-indexed: 11 = December
    expect(result.getUTCDate()).toBe(1)
  })

  it('a date mid-month is always after the start of that month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T00:00:00Z'))

    const midMonth = new Date('2026-03-15T00:00:00Z')
    const start = startOfCurrentMonth()
    expect(midMonth.getTime()).toBeGreaterThan(start.getTime())
  })
})
