import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

// Route-level limiters with .check() interface (gracefully no-ops when Redis is unavailable)
function makeLimiter(upstashLimiter: Ratelimit | null) {
  return {
    async check(key: string): Promise<{ success: boolean }> {
      if (!upstashLimiter) return { success: true }
      const { success } = await upstashLimiter.limit(key)
      return { success }
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
