import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://5071dc7cb86dd50b8907fdb7c877f95b@o4510954719543296.ingest.us.sentry.io/4511262844190720',
  tracesSampleRate: 0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],
  beforeSend(event) {
    // Filter hydration errors injected by browser extensions (not app bugs)
    if (event.exception?.values?.[0]?.value?.includes('Minified React error')) return null
    return event
  },
})
