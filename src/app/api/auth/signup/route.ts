import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import { authLimiter } from '@/lib/rate-limit'
import { passwordSchema, validatePassword } from '@/lib/password-policy'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await authLimiter.check(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const { email, password, name } = body ?? {}

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const parsedPassword = passwordSchema.safeParse(password)
  if (!parsedPassword.success) {
    const issues = parsedPassword.error.issues.map((i) => i.message)
    return NextResponse.json({ error: issues[0] ?? 'Invalid password', issues }, { status: 400 })
  }
  // passwordSchema has no side-channel for email/name, so the personal-info
  // rule is checked separately once we have both in scope.
  const contextIssues = validatePassword(password, { email, name })
  if (contextIssues.length > 0) {
    return NextResponse.json({ error: contextIssues[0], issues: contextIssues }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const verifyToken = crypto.randomBytes(32).toString('hex')
  const verifyExpires = new Date(Date.now() + 24 * 3600 * 1000)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010'
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}&email=${encodeURIComponent(email)}`

  // Wrap both writes in a transaction — if token creation fails, the user row is rolled back,
  // preventing orphaned accounts that can never verify their email.
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        emailVerified: null,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.verificationToken.create({
      data: { identifier: email, token: verifyToken, expires: verifyExpires },
    }),
  ])

  // Send welcome/verify email
  try {
    await sendWelcomeEmail(email, name || null, verifyUrl)
  } catch (err) { console.error('Transactional email send failed', err) }

  return NextResponse.json({ message: 'Account created. Please check your email to verify.' })
}
