import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// The Vercel Marketplace Upstash integration provisions KV_REST_API_URL /
// KV_REST_API_TOKEN; a database created directly at upstash.com gives the
// UPSTASH_REDIS_REST_* pair. Accept either so the credentials work whichever
// way the database was provisioned. Redis.fromEnv() only knows the latter.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null

// Middleware-facing limiter for the credentials login (see src/middleware.ts).
// Routed through makeLimiter (FOU-352) so RATE_LIMIT_REQUIRED actually gates it —
// this was previously exported raw and consumed behind an `if (authRatelimit)`
// null guard in middleware.ts, which silently skipped the check (and FAIL_CLOSED)
// whenever Redis was absent.
const _authRatelimitMw = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'rl:auth',
      analytics: false,
    })
  : null

export const authRatelimit = makeLimiter(_authRatelimitMw)

// Middleware-facing global /api floor (FOU-355). Separate from the route-scoped
// limiters further down: those are per-endpoint budgets a caller is expected to
// spend, this is the ceiling on the whole surface. 20/10s rather than the
// route-scoped 30/1m because a single kitchen session legitimately fires many
// short bursts of API calls — a per-minute cap that low would 429 real users.
const _apiRatelimitMw = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '10 s'),
      prefix: 'rl:api',
      analytics: false,
    })
  : null

export const apiRatelimit = makeLimiter(_apiRatelimitMw)

// Vercel-aware client-IP extraction. Only the LEFTMOST x-forwarded-for entry is
// the real client — Vercel appends to any XFF the caller supplied, so using the
// whole header as a rate-limit key lets an attacker mint a fresh bucket per
// request by varying their own XFF value, bypassing the limit entirely.
export function clientIp(req: { headers: { get: (k: string) => string | null } }): string {
  const xff = req.headers.get('x-forwarded-for')
  if (!xff) return 'anonymous'
  return xff.split(',')[0]?.trim() || 'anonymous'
}

// Whether a missing Redis config should deny traffic rather than wave it through.
// Chose an explicit opt-in over "deny whenever NODE_ENV=production" because the
// portfolio currently has NO Upstash credentials in prod — flipping the default
// would 429 every rate-limited route the moment this deploys. Set
// RATE_LIMIT_REQUIRED=true on Vercel once Upstash is provisioned (FOU-323).
const FAIL_CLOSED = process.env.RATE_LIMIT_REQUIRED === 'true'

if (!redis && process.env.NODE_ENV === 'production') {
  // Loud, once per cold start. The prior behaviour degraded silently, which is
  // why the portfolio ran unprotected without anyone noticing.
  console.error(
    '[rate-limit] no Redis credentials in production (UPSTASH_REDIS_REST_* or KV_REST_API_*) — ' +
      `rate limiting is ${FAIL_CLOSED ? 'DENYING all limited requests' : 'DISABLED'}. See FOU-323.`
  )
}

// Route-level limiters with .check() interface.
function makeLimiter(upstashLimiter: Ratelimit | null) {
  return {
    async check(key: string): Promise<{ success: boolean }> {
      if (!upstashLimiter) return { success: !FAIL_CLOSED }
      try {
        const { success } = await upstashLimiter.limit(key)
        return { success }
      } catch (err) {
        // Upstash unreachable mid-request. Deny rather than 500 — an outage in
        // the limiter must not become an open door to the endpoint it guards.
        console.error('[rate-limit] limiter threw, denying request', err)
        return { success: false }
      }
    },
  }
}

const _authRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'rl:route:auth',
      // Upstash analytics writes an extra Redis command per request to a
      // dashboard nobody looks at — disabled to conserve free-tier headroom.
      analytics: false,
    })
  : null

const _aiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:route:ai',
      analytics: false,
    })
  : null

const _formRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'rl:route:form',
      analytics: false,
    })
  : null

export const authLimiter = makeLimiter(_authRatelimit)
export const aiLimiter = makeLimiter(_aiRatelimit)
export const formLimiter = makeLimiter(_formRatelimit)
// `apiLimiter` (30/1m, prefix rl:route:api) lived here with zero callers. Removed
// rather than left dead — two exports named api* with one inert is how the gap
// this fixes went unnoticed. The middleware floor is `apiRatelimit`, above.

export function rateLimitResponse() {
  return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
}
