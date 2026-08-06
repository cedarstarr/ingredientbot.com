import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Session } from 'next-auth'
import type { NextAuthRequest } from 'next-auth'

/**
 * Regression coverage for the COMING_SOON launch-lock gate in src/middleware.ts.
 *
 * Context (2026-08-06): the identical gate on gurumind.ai redirected every route
 * — including /login itself — to /coming-soon while locked, because the owner's
 * own authenticated-admin bypass wasn't wired into the lock check. That left the
 * site owner unable to sign in to their own locked production site. A portfolio
 * survey confirmed ingredientbot's gate is currently correct: it whitelists
 * /login and /api/* by name, and bypasses the lock for an authenticated admin
 * session (`request.auth?.user?.isAdmin`). These tests exist so that if someone
 * later "cleans up" the whitelist or the isAdmin check, the gurumind lockout
 * reproduces here as a failing test instead of a locked-out production owner.
 *
 * The real middleware default-exports `auth(handler)`, where `auth` comes from
 * NextAuth's factory and performs real JWT/cookie decoding. We mock that factory
 * to a passthrough so these tests exercise the gate's actual branching logic
 * (the code in src/middleware.ts, unmodified) against a `request.auth` value we
 * set directly per test — mocking the auth-check mechanism, not minting real
 * session tokens or exercising NextAuth's crypto.
 */
vi.mock('next-auth', () => ({
  default: () => ({
    auth: (handler: unknown) => handler,
  }),
}))

// The mocked NextAuth factory (above) makes the default export the raw inner
// handler at runtime, which always returns a Response synchronously/via
// promise. Its *type*, though, is still NextAuth's wrapped-middleware
// signature (2 args, `void | Response` return) because vi.mock only replaces
// the runtime module, not next-auth's ambient types. Recast to what it
// actually is at runtime so callers below don't have to null-check a `void`
// that the mock never produces.
const middleware = (await import('../middleware')).default as unknown as (
  request: NextAuthRequest
) => Promise<Response>

function makeRequest(pathname: string, opts: { auth?: Session | null; host?: string } = {}): NextAuthRequest {
  const req = new NextRequest(`https://ingredientbot.com${pathname}`, {
    headers: { host: opts.host ?? 'ingredientbot.com' },
  })
  return Object.assign(req, { auth: opts.auth ?? null }) as unknown as NextAuthRequest
}

const adminSession: Session = {
  user: { id: 'admin-1', isAdmin: true, emailVerified: new Date('2026-01-01') },
  expires: new Date(Date.now() + 86_400_000).toISOString(),
}

const memberSession: Session = {
  user: { id: 'user-1', isAdmin: false, emailVerified: new Date('2026-01-01') },
  expires: new Date(Date.now() + 86_400_000).toISOString(),
}

function isRewrittenToComingSoon(res: Response): boolean {
  return (res.headers.get('x-middleware-rewrite') ?? '').includes('/coming-soon')
}

function isPassedThrough(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1'
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('launch-lock gate (COMING_SOON=true), anonymous visitor', () => {
  beforeEach(() => vi.stubEnv('COMING_SOON', 'true'))

  it('redirects an ordinary public route to /coming-soon', async () => {
    const res = await middleware(makeRequest('/'))
    expect(isRewrittenToComingSoon(res)).toBe(true)
  })

  it('keeps /login reachable (the gurumind regression: the owner must be able to sign in)', async () => {
    const res = await middleware(makeRequest('/login'))
    expect(isRewrittenToComingSoon(res)).toBe(false)
    expect(isPassedThrough(res)).toBe(true)
  })

  it('keeps the auth API routes reachable so /login can actually submit', async () => {
    const res = await middleware(makeRequest('/api/auth/csrf'))
    expect(isRewrittenToComingSoon(res)).toBe(false)
    expect(res.status).not.toBe(401)
  })
})

describe('launch-lock gate (COMING_SOON=true), authenticated bypass', () => {
  beforeEach(() => vi.stubEnv('COMING_SOON', 'true'))

  it('does not redirect an admin session away from a protected route', async () => {
    const res = await middleware(makeRequest('/kitchen', { auth: adminSession }))
    expect(isRewrittenToComingSoon(res)).toBe(false)
    expect(isPassedThrough(res)).toBe(true)
  })

  it('still locks out a signed-in NON-admin — the bypass is isAdmin-scoped, not "any session"', async () => {
    const res = await middleware(makeRequest('/kitchen', { auth: memberSession }))
    expect(isRewrittenToComingSoon(res)).toBe(true)
  })
})

describe('launch-lock gate: an unverifiable session behaves like signed out, not a crash', () => {
  beforeEach(() => vi.stubEnv('COMING_SOON', 'true'))

  it('treats a null/undecodable session as anonymous on the lock gate', async () => {
    const res = await middleware(makeRequest('/', { auth: null }))
    await expect(Promise.resolve(res)).resolves.toBeInstanceOf(Response)
    expect(isRewrittenToComingSoon(res)).toBe(true)
  })

  it('treats a null/undecodable session as anonymous on a protected page while locked (routed to /coming-soon, no throw)', async () => {
    const res = await middleware(makeRequest('/kitchen', { auth: null }))
    expect(isRewrittenToComingSoon(res)).toBe(true)
  })

  it('treats a null/undecodable session as anonymous on a protected API route (401, no throw)', async () => {
    const res = await middleware(makeRequest('/api/user/profile', { auth: null }))
    expect(res.status).toBe(401)
  })
})

describe('gate disabled (COMING_SOON unset or false)', () => {
  it('does not rewrite anything to /coming-soon when unset', async () => {
    const res = await middleware(makeRequest('/kitchen'))
    expect(isRewrittenToComingSoon(res)).toBe(false)
  })

  it('does not rewrite anything to /coming-soon when explicitly false', async () => {
    vi.stubEnv('COMING_SOON', 'false')
    const res = await middleware(makeRequest('/'))
    expect(isRewrittenToComingSoon(res)).toBe(false)
    expect(isPassedThrough(res)).toBe(true)
  })

  it('still applies ordinary auth (redirect to /login) independent of the lock gate', async () => {
    vi.stubEnv('COMING_SOON', 'false')
    const res = await middleware(makeRequest('/kitchen'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('a null/undecodable session on a protected page redirects to /login, not a crash, once unlocked', async () => {
    const res = await middleware(makeRequest('/kitchen', { auth: null }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })
})
