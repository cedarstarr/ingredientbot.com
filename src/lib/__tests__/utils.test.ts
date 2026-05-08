import { describe, it, expect } from 'vitest'
import { cn, formatDate, getBaseUrl, safeJsonLdString } from '@/lib/utils'

describe('cn (Tailwind class merge)', () => {
  it('merges class strings', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('drops falsy values', () => {
    expect(cn('p-2', false && 'p-4', null, undefined, 'text-sm')).toBe('p-2 text-sm')
  })
})

describe('formatDate', () => {
  it('formats an ISO string into a long-form US date', () => {
    expect(formatDate('2026-04-01T00:00:00Z')).toMatch(/2026/)
  })

  it('accepts a Date object', () => {
    expect(formatDate(new Date('2026-01-15T12:00:00Z'))).toMatch(/2026/)
  })
})

describe('getBaseUrl', () => {
  it('falls back to localhost:3010 when no env vars are set', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_URL
    expect(getBaseUrl()).toBe('http://localhost:3010')
  })

  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ingredientbot.com'
    expect(getBaseUrl()).toBe('https://ingredientbot.com')
    delete process.env.NEXT_PUBLIC_SITE_URL
  })
})

describe('safeJsonLdString — XSS-safe JSON-LD', () => {
  it('escapes < and > so attacker-controlled strings cannot break out of <script>', () => {
    const payload = { title: '</script><script>alert(1)</script>' }
    const result = safeJsonLdString(payload)
    expect(result).not.toContain('</script>')
    expect(result).toContain('\\u003c')
  })

  it('escapes U+2028 and U+2029 (which JSON.stringify leaves alone but break JS parsing)', () => {
    const result = safeJsonLdString({ title: 'a b c' })
    expect(result).toContain('\\u2028')
    expect(result).toContain('\\u2029')
  })

  it('escapes ampersands to prevent HTML entity attacks', () => {
    expect(safeJsonLdString({ q: 'a&b' })).toContain('\\u0026')
  })
})
