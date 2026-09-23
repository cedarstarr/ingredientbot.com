import { describe, it, expect } from 'vitest'
import { authConfig } from '@/lib/auth.config'
import type { Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

/**
 * authConfig is the Edge-safe half of the NextAuth setup (no Prisma import,
 * so proxy.ts/middleware.ts can use it without pulling a DB driver into the
 * Edge runtime). Its jwt/session callbacks are pure and shared with the
 * DB-backed callbacks in auth.ts (which override them there), so this is the
 * only place the "sessionsRevokedAt kills the session" contract is exercised
 * without mocking Prisma.
 */

describe('authConfig.callbacks.jwt', () => {
  it('passes the token through unchanged', () => {
    const token = { id: 'u1', isAdmin: true } as unknown as JWT
    expect(authConfig.callbacks.jwt({ token } as never)).toBe(token)
  })
})

describe('authConfig.callbacks.session', () => {
  it('strips the user and expires the session immediately when the token is flagged invalid', () => {
    const token = { id: 'u1', invalid: true } as unknown as JWT
    const session = {
      user: { id: 'u1', isAdmin: false, emailVerified: null },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    } as unknown as Session

    const result = authConfig.callbacks.session({ session, token } as never) as Session
    expect(result.user).toBeUndefined()
    expect(new Date(result.expires).getTime()).toBe(0)
  })

  it('maps id, isAdmin, and emailVerified from the token onto session.user', () => {
    const emailVerified = new Date('2026-01-01T00:00:00.000Z')
    const token = { id: 'u1', isAdmin: true, emailVerified } as unknown as JWT
    const session = {
      user: { id: 'stale', isAdmin: false, emailVerified: null },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    } as unknown as Session

    const result = authConfig.callbacks.session({ session, token } as never) as Session
    expect(result.user?.id).toBe('u1')
    expect(result.user?.isAdmin).toBe(true)
    expect(result.user?.emailVerified).toBe(emailVerified)
  })

  it('defaults emailVerified to null when the token has none', () => {
    const token = { id: 'u1', isAdmin: false } as unknown as JWT
    const session = {
      user: { id: 'u1', isAdmin: false, emailVerified: null },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    } as unknown as Session

    const result = authConfig.callbacks.session({ session, token } as never) as Session
    expect(result.user?.emailVerified).toBeNull()
  })

  it('returns the session unchanged when session.user is absent', () => {
    const token = { id: 'u1', isAdmin: true } as unknown as JWT
    const session = { user: undefined, expires: 'x' } as unknown as Session

    const result = authConfig.callbacks.session({ session, token } as never) as Session
    expect(result).toBe(session)
  })
})
