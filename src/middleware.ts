import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import type { NextAuthRequest } from 'next-auth'

const { auth } = NextAuth(authConfig)

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

function addSecurityHeaders(response: NextResponse, requestId?: string) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
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
]

export default auth(async function middleware(request: NextAuthRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const pathname = request.nextUrl.pathname

  const host = request.headers.get('host') ?? ''
  if (host.startsWith('staging.')) {
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    response.headers.set('x-request-id', requestId)
    return response
  }

  if (process.env.COMING_SOON === 'true' && !pathname.startsWith('/api/') && pathname !== '/coming-soon') {
    const url = request.nextUrl.clone()
    url.pathname = '/coming-soon'
    const response = NextResponse.rewrite(url)
    response.headers.set('x-request-id', requestId)
    return response
  }

  // Allow public paths without auth
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
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
      path.startsWith('/api/auth/')
    if (!isVerifyEmailPath) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/verify-email', request.url)), requestId)
    }
  }

  // Admin protection
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)), requestId)
    }
    if (!user.isAdmin) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/kitchen', request.url)), requestId)
    }
  }

  // Redirect logged-in users away from login/signup pages
  if ((pathname.startsWith('/login') || pathname.startsWith('/signup')) && user && emailVerified) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/kitchen', request.url)), requestId)
  }

  return addSecurityHeaders(NextResponse.next(), requestId)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
