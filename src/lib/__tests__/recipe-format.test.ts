import { describe, it, expect } from 'vitest'
import { formatDuration, isIngredientHeading } from '../recipe-format'

describe('formatDuration', () => {
  it('shows plain minutes under an hour', () => {
    expect(formatDuration(25)).toBe('25 min')
    expect(formatDuration(59)).toBe('59 min')
  })

  it('shows whole hours without a trailing zero', () => {
    expect(formatDuration(60)).toBe('1 hr')
    expect(formatDuration(120)).toBe('2 hr')
  })

  it('shows hours plus remainder minutes', () => {
    expect(formatDuration(90)).toBe('1 hr 30 min')
    expect(formatDuration(155)).toBe('2 hr 35 min')
  })

  it('keeps very long cooks readable', () => {
    // Texas brisket / injera fermentation — the case that motivated this helper.
    expect(formatDuration(4340)).toBe('72 hr 20 min')
  })

  it('renders nothing for missing or nonsensical times', () => {
    expect(formatDuration(0)).toBe('')
    expect(formatDuration(-5)).toBe('')
    expect(formatDuration(NaN)).toBe('')
  })
})

describe('isIngredientHeading', () => {
  it('treats amount-less "For the ..." rows as section labels', () => {
    expect(isIngredientHeading({ name: 'For the broth and tare', amount: '', unit: '' })).toBe(true)
    expect(isIngredientHeading({ name: 'For assembly', amount: '', unit: '' })).toBe(true)
    expect(isIngredientHeading({ name: 'For the chashu pork', amount: '', unit: '' })).toBe(true)
  })

  it('keeps trailing serving qualifiers as real ingredients', () => {
    expect(isIngredientHeading({ name: 'steamed white rice, for serving', amount: '', unit: '' })).toBe(false)
    expect(isIngredientHeading({ name: 'plain yogurt or lemon wedges, for serving', amount: '', unit: '' })).toBe(false)
    expect(isIngredientHeading({ name: 'salt, to taste', amount: '', unit: '' })).toBe(false)
  })

  it('never treats a quantified row as a heading', () => {
    expect(isIngredientHeading({ name: 'For the broth', amount: '2', unit: 'cups' })).toBe(false)
    expect(isIngredientHeading({ name: 'For the broth', amount: '', unit: 'pinch' })).toBe(false)
  })

  it('ignores blank rows', () => {
    expect(isIngredientHeading({ name: '', amount: '', unit: '' })).toBe(false)
    expect(isIngredientHeading({ name: '   ', amount: '', unit: '' })).toBe(false)
  })
})
