import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://5071dc7cb86dd50b8907fdb7c877f95b@o4510954719543296.ingest.us.sentry.io/4511262844190720',
  tracesSampleRate: 0,
  debug: false,
})
