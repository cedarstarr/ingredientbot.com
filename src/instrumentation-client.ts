import * as Sentry from '@sentry/nextjs'
import { initBotId } from 'botid/client/core'
import { BOTID_PROTECTED_ROUTES } from '@/lib/botid-routes'

// Invisible bot check on public, unauthenticated form endpoints (FOU-345).
initBotId({ protect: [...BOTID_PROTECTED_ROUTES] })

// Sentry looks for this export the moment an instrumentation-client.ts exists at all
// (this file didn't, before BotID needed it) — without it, client-side navigations
// stop being instrumented as Sentry transactions. sentry.client.config.ts still owns
// Sentry.init() and stays untouched.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
