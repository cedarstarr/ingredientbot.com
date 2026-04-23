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

function addSecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
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
]

export default auth(async function middleware(request: NextAuthRequest) {
  const pathname = request.nextUrl.pathname

  const host = request.headers.get('host') ?? ''
  if (host.startsWith('staging.')) {
    const response = NextResponse.next()
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
    return response
  }

  // Allow public paths without auth
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (!isPublic && !request.auth) {
    // API routes return 401 instead of redirecting
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
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
      return addSecurityHeaders(NextResponse.redirect(new URL('/verify-email', request.url)))
    }
  }

  // Admin protection
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)))
    }
    if (!user.isAdmin) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/kitchen', request.url)))
    }
  }

  // Redirect logged-in users away from login/signup pages
  if ((pathname.startsWith('/login') || pathname.startsWith('/signup')) && user && emailVerified) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/kitchen', request.url)))
  }

  return addSecurityHeaders(NextResponse.next())
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
