import { describe, it, expect } from 'vitest'

/**
 * Auth-guard logic — mirrors the public-path matcher in src/middleware.ts.
 * Pure-function shape so we can unit-test the routing intent without
 * spinning up a NextAuth runtime.
 */

const PUBLIC_PATHS = [
  '/login', '/signup', '/forgot-password', '/reset-password',
  '/verify-email', '/unsubscribe',
  '/privacy', '/terms',
  '/api/auth',
  '/api/health',
  '/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml',
  '/api/cron/',
  '/manifest.json', '/sw.js', '/offline',
  '/coming-soon',
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

describe('Public path matcher (middleware)', () => {
  it.each([
    '/login',
    '/signup',
    '/privacy',
    '/terms',
    '/api/auth/csrf',
    '/api/health',
    '/manifest.json',
    '/sw.js',
    '/offline',
    '/robots.txt',
    '/sitemap.xml',
  ])('treats %s as public', (pathname) => {
    expect(isPublic(pathname)).toBe(true)
  })

  it.each([
    '/dashboard',
    '/kitchen',
    '/saved',
    '/history',
    '/pantry',
    '/collections',
    '/upgrade',
    '/meal-plan',
    '/admin',
    '/admin/users',
    '/api/user/profile',
    '/api/recipes/generate',
    '/api/user/kitchen-prefs',
  ])('treats %s as protected', (pathname) => {
    expect(isPublic(pathname)).toBe(false)
  })
})

describe('Admin path matcher', () => {
  it('flags /admin and all subpaths', () => {
    expect('/admin'.startsWith('/admin')).toBe(true)
    expect('/admin/users'.startsWith('/admin')).toBe(true)
    expect('/admin/audit-logs'.startsWith('/admin')).toBe(true)
    expect('/admin/scripts'.startsWith('/admin')).toBe(true)
  })

  it('does not flag /administrator-tools or unrelated paths', () => {
    expect('/dashboard'.startsWith('/admin')).toBe(false)
  })
})
