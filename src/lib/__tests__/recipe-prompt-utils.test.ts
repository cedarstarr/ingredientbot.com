import { describe, it, expect } from 'vitest'
import { buildCookingMethodContext, buildSpiceContext } from '@/lib/recipe-prompt-utils'

describe('buildCookingMethodContext', () => {
  it('returns empty string for non-string input', () => {
    expect(buildCookingMethodContext(undefined)).toBe('')
    expect(buildCookingMethodContext(null)).toBe('')
    expect(buildCookingMethodContext(42)).toBe('')
    expect(buildCookingMethodContext({})).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(buildCookingMethodContext('')).toBe('')
  })

  it('returns empty string for sentinel "any"', () => {
    expect(buildCookingMethodContext('any')).toBe('')
  })

  it('returns empty string for unknown method (default branch)', () => {
    expect(buildCookingMethodContext('Hibachi')).toBe('')
  })

  it('handles Sheet Pan', () => {
    expect(buildCookingMethodContext('Sheet Pan')).toContain('SHEET PAN')
    expect(buildCookingMethodContext('Sheet Pan')).toContain('single sheet pan')
  })

  it('handles One-Pot', () => {
    expect(buildCookingMethodContext('One-Pot')).toContain('ONE-POT')
    expect(buildCookingMethodContext('One-Pot')).toContain('single pot/pan')
  })

  it('handles Air Fryer', () => {
    expect(buildCookingMethodContext('Air Fryer')).toContain('AIR FRYER')
    expect(buildCookingMethodContext('Air Fryer')).toContain('air fryer')
  })

  it('handles Slow Cooker', () => {
    expect(buildCookingMethodContext('Slow Cooker')).toContain('SLOW COOKER')
    expect(buildCookingMethodContext('Slow Cooker')).toContain('Crock-Pot')
  })

  it('handles Instant Pot', () => {
    expect(buildCookingMethodContext('Instant Pot')).toContain('INSTANT POT')
    expect(buildCookingMethodContext('Instant Pot')).toContain('pressure cooker')
  })

  it('handles Microwave Only', () => {
    expect(buildCookingMethodContext('Microwave Only')).toContain('MICROWAVE ONLY')
    expect(buildCookingMethodContext('Microwave Only')).toContain('microwave')
  })

  it('handles No Stove', () => {
    expect(buildCookingMethodContext('No Stove')).toContain('NO STOVE')
    expect(buildCookingMethodContext('No Stove')).toContain('Oven-free')
  })

  it('is case-sensitive (matches the dropdown values exactly)', () => {
    // Guards against silent fallthrough if a caller passes a lowercased value
    expect(buildCookingMethodContext('sheet pan')).toBe('')
    expect(buildCookingMethodContext('SHEET PAN')).toBe('')
  })
})

describe('buildSpiceContext', () => {
  it('always includes the SPICE LEVEL prefix', () => {
    expect(buildSpiceContext(0)).toContain('SPICE LEVEL:')
    expect(buildSpiceContext(3)).toContain('SPICE LEVEL:')
  })

  it('labels level 0 as Mild', () => {
    expect(buildSpiceContext(0)).toContain('Mild')
  })

  it('labels level 1 as Medium', () => {
    expect(buildSpiceContext(1)).toContain('Medium')
  })

  it('labels level 2 as Hot', () => {
    expect(buildSpiceContext(2)).toContain('Hot')
  })

  it('labels level 3 as Fire', () => {
    expect(buildSpiceContext(3)).toContain('Fire')
  })

  it('clamps values above 3 to Fire', () => {
    expect(buildSpiceContext(99)).toContain('Fire')
    expect(buildSpiceContext(4)).toContain('Fire')
  })

  it('clamps negative values to Mild', () => {
    expect(buildSpiceContext(-5)).toContain('Mild')
    expect(buildSpiceContext(-1)).toContain('Mild')
  })

  it('defaults non-integer numeric input to Mild', () => {
    expect(buildSpiceContext(1.5)).toContain('Mild')
    expect(buildSpiceContext(NaN)).toContain('Mild')
  })

  it('defaults non-numeric input to Mild', () => {
    expect(buildSpiceContext(undefined)).toContain('Mild')
    expect(buildSpiceContext(null)).toContain('Mild')
    expect(buildSpiceContext('hot')).toContain('Mild')
    expect(buildSpiceContext({})).toContain('Mild')
  })
})
