import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import type { NextAuthRequest } from 'next-auth'
import { apiRatelimit, authRatelimit, clientIp } from '@/lib/rate-limit'

const { auth } = NextAuth(authConfig)

// FOU-347. This site shipped with no Content-Security-Policy at all — the recipe
// share page and the landing page each render an inline JSON-LD <script>, plus
// next/font and Tailwind's runtime styles, and until now none of it had any
// browser-side backstop against an XSS regression.
//
// SHIPPED REPORT-ONLY ON PURPOSE, matching gurumind.ai and foulweatherlabs.com's
// rollout: 'strict-dynamic' is all-or-nothing, and enforcing on day one with no
// soak period risks a blank page instead of a degraded one. One deploy cycle
// surfaces whatever the Next.js runtime, next-themes-less Tailwind build, and
// next-plausible actually emit. To enforce: rename the header key below (and in
// withSecurityHeaders) from 'Content-Security-Policy-Report-Only' to
// 'Content-Security-Policy'. The nonce plumbing is already real, not a placeholder.
//
// Violations go to Sentry (tunnelRoute '/monitoring', same-origin) rather than the
// browser console, so report-uri needs no matching connect-src entry.
const CSP_REPORT_URI =
  'https://o4510954719543296.ingest.us.sentry.io/api/4511262844190720/security/?sentry_key=5071dc7cb86dd50b8907fdb7c877f95b'

function buildCsp(nonce: string): string {
  // React uses eval() in development to rebuild server error stacks in the browser.
  const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    // Under 'strict-dynamic' the browser ignores host allowlists and 'unsafe-inline'
    // entirely and trusts only the nonce — an injected <script> cannot know a
    // per-request random value, so it does not execute.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    // Styles keep 'unsafe-inline': Tailwind's runtime rules and next/font's injected
    // <style> have no nonce seam, and style injection is not the threat being addressed.
    "style-src 'self' 'unsafe-inline'",
    // No remotePatterns are configured in next.config.ts, so next/image cannot serve
    // a third-party host — 'self' is the true surface, not a guess. data:/blob: cover
    // the photo-analysis upload preview.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Sentry rides tunnelRoute '/monitoring' (same-origin). Plausible is the only
    // genuine cross-origin fetch the browser makes.
    "connect-src 'self' https://plausible.io",
    // Sentry's replayIntegration spawns a blob: compression worker.
    "worker-src 'self' blob:",
    // PWA manifest.json (F43).
    "manifest-src 'self'",
    `report-uri ${CSP_REPORT_URI}`,
  ].join('; ')
}

// Edge-runtime nonce. Buffer is not reliably available here, so this uses
// getRandomValues + btoa rather than the Buffer.from() form in the Next.js docs.
function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

function addSecurityHeaders(response: NextResponse, requestId?: string, csp?: string) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  if (csp) response.headers.set('Content-Security-Policy-Report-Only', csp)
  if (requestId) response.headers.set('x-request-id', requestId)
  return response
}

const PUBLIC_PATHS = [
  '/login', '/signup', '/forgot-password', '/reset-password',
  '/verify-email', '/unsubscribe',
  '/privacy', '/terms',
  '/api/auth',
  '/api/health',
  '/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml',
  '/api/cron/',
  // PWA assets — must be publicly accessible for install/offline flow
  '/manifest.json', '/sw.js', '/offline',
  '/coming-soon',
  // Public recipe share pages — F27
  '/r/',
  // Public browse + ingredient glossary — server-rendered, no client API calls
  '/recipes',
  '/ingredients',
  // Allergen reference glossary — server-rendered, published rows only (FOU Phase 3)
  '/allergens',
]

export default auth(async function middleware(request: NextAuthRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const pathname = request.nextUrl.pathname

  // One nonce per request, forwarded on the REQUEST so Next.js stamps its own inlined
  // bootstrap and flight-data scripts: parseRequestHeaders() in app-render.js reads
  // `content-security-policy` OR `content-security-policy-report-only` off the incoming
  // request and extracts 'nonce-{value}'. Both spellings are set below — either alone
  // would do, and the pair costs nothing. This is the ONLY place a CSP is defined for
  // this site (FOU-347/FOU-288) — next.config.ts's headers() array must never add one.
  const nonce = createNonce()
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  requestHeaders.set('Content-Security-Policy-Report-Only', csp)
  const withNonce = { request: { headers: requestHeaders } }

  // Brute-force protection on the credentials login. This must run BEFORE the
  // PUBLIC_PATHS short-circuit below, which treats all of /api/auth as public,
  // and it stays separate from the general /api limiter that follows — that one
  // exempts /api/auth wholesale, because NextAuth session polling would eat the
  // budget. Leaving the login endpoint with no limit of its own was the defect
  // (FOU-334).
  if (pathname === '/api/auth/callback/credentials' && request.method === 'POST') {
    const { success } = await authRatelimit.check(clientIp(request))
    if (!success) {
      const res = NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
      res.headers.set('x-request-id', requestId)
      return res
    }
  }

  // Global per-IP floor for /api/* (FOU-355). Ahead of the PUBLIC_PATHS
  // short-circuit below so unauthenticated routes are covered rather than
  // skipped. Exempt: /api/auth (session polling, limited above), /api/health
  // (uptime monitors are meant to hammer it), /api/cron (Vercel's scheduler,
  // not a client).
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth') &&
    !pathname.startsWith('/api/health') &&
    !pathname.startsWith('/api/cron')
  ) {
    const { success } = await apiRatelimit.check(clientIp(request))
    if (!success) {
      const res = NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
      res.headers.set('x-request-id', requestId)
      return res
    }
  }

  const host = request.headers.get('host') ?? ''
  if (host.startsWith('staging.')) {
    const response = NextResponse.next(withNonce)
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('x-request-id', requestId)
    response.headers.set('Content-Security-Policy-Report-Only', csp)
    return response
  }

  if (process.env.COMING_SOON === 'true' && !pathname.startsWith('/api/') && pathname !== '/coming-soon' && pathname !== '/login' && !request.auth?.user?.isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    // A rewrite renders a page, so it needs the nonce forwarded exactly like next().
    const response = NextResponse.rewrite(url, withNonce)
    response.headers.set('x-request-id', requestId)
    response.headers.set('Content-Security-Policy-Report-Only', csp)
    return response
  }

  // Allow public paths without auth. The landing page is exact-matched:
  // PUBLIC_PATHS is prefix-matched, so listing '/' there would make every route public.
  const isPublic = pathname === '/' || PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (!isPublic && !request.auth) {
    // API routes return 401 instead of redirecting
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      res.headers.set('x-request-id', requestId)
      return res
    }
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    const res = NextResponse.redirect(url)
    res.headers.set('x-request-id', requestId)
    return res
  }

  const session = request.auth
  const user = session?.user
  const emailVerified = user?.emailVerified ?? null

  // Email verification gate
  if (user && !emailVerified) {
    const path = request.nextUrl.pathname
    const isVerifyEmailPath =
      path.startsWith('/verify-email') ||
      path.startsWith('/api/auth/verify-email') ||
      path.startsWith('/api/auth/resend-verification') ||
      path.startsWith('/api/auth/') ||
      // A forced password change can coincide with an unverified email — the
      // change-password flow must stay reachable rather than looping the user
      // toward /verify-email first (mustChangePassword is only ever cleared here).
      path.startsWith('/change-password') ||
      path.startsWith('/api/user/password')
    if (!isVerifyEmailPath) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/verify-email', request.url)), requestId, csp)
    }
  }

  // Admin protection
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)), requestId, csp)
    }
    if (!user.isAdmin) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/kitchen', request.url)), requestId, csp)
    }
  }

  // Redirect logged-in users away from login/signup pages
  if ((pathname.startsWith('/login') || pathname.startsWith('/signup')) && user && emailVerified) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/kitchen', request.url)), requestId, csp)
  }

  return addSecurityHeaders(NextResponse.next(withNonce), requestId, csp)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
