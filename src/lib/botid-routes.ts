// Shared between the client (which attaches BotID headers only to these requests)
// and the server checks. A route checked on the server but missing here fails every
// real submission, so both sides read this one list. (FOU-345)
// Only endpoints reachable WITHOUT a session are listed: every recipe, meal-plan and
// AI route already 401s for anonymous callers, and protecting those would only add a
// failure surface for signed-in users.
export const BOTID_PROTECTED_ROUTES = [
  { path: '/api/auth/signup', method: 'POST' },
  { path: '/api/auth/forgot-password', method: 'POST' },
  { path: '/api/auth/reset-password', method: 'POST' },
] as const

// Mirrors the rewrite prefix withBotId() registers in botid/next/config. Middleware
// must pass it straight through: it is not in PUBLIC_PATHS, so anonymous visitors'
// challenge script would otherwise hit the login redirect or coming-soon gate.
export const BOTID_PROXY_PREFIX = '/149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3'
