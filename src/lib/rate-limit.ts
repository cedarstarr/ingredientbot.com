import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

// Middleware-facing limiter for the credentials login (see src/middleware.ts).
export const authRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'rl:auth',
      analytics: true,
    })
  : null

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
    '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are not set in production — ' +
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
      analytics: true,
    })
  : null

const _aiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:route:ai',
      analytics: true,
    })
  : null

const _formRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'rl:route:form',
      analytics: true,
    })
  : null

const _apiRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      prefix: 'rl:route:api',
      analytics: true,
    })
  : null

export const authLimiter = makeLimiter(_authRatelimit)
export const aiLimiter = makeLimiter(_aiRatelimit)
export const formLimiter = makeLimiter(_formRatelimit)
export const apiLimiter = makeLimiter(_apiRatelimit)

export function rateLimitResponse() {
  return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
}
