import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  debug: false,
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],
  beforeSend(event, hint) {
    // Suppress health check noise
    if (event.request?.url?.includes('/api/health')) return null
    // Suppress expected auth errors (401/403 are user errors, not server errors)
    const status = (hint?.originalException as { status?: number })?.status
    if (status === 401 || status === 403) return null
    // Suppress rate limit errors (expected behavior, not bugs)
    if (status === 429) return null
    // Suppress Anthropic overload errors (transient infra noise)
    if (status === 529) return null
    return event
  },
})
