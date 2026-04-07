import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  ZEPTOMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),

  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),

  CRON_SECRET: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  NEXT_RUNTIME: z.enum(['nodejs', 'edge']).optional(),
})

export const env = (() => {
  // Skip validation during build (no runtime env available)
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return process.env as unknown as z.infer<typeof envSchema>
  }
  // Trim trailing whitespace/newlines from all string env vars
  const trimmed = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => {
      if (typeof v !== 'string') return [k, v]
      const t = v.trim()
      return [k, t === '' ? undefined : t]
    })
  )
  const result = envSchema.safeParse(trimmed)
  if (!result.success) {
    console.error('Invalid environment variables:')
    result.error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    })
    throw new Error('Invalid environment variables — check server logs')
  }
  return result.data
})()
