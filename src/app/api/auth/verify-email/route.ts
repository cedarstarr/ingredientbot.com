import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  if (!token || !email) {
    return NextResponse.json({ error: 'Missing token or email' }, { status: 400 })
  }

  try {
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { token, identifier: email },
    })

    if (!verificationToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    if (new Date() > verificationToken.expires) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: email, token } },
      })
      return NextResponse.json({ error: 'Token expired' }, { status: 400 })
    }

    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    })

    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token } },
    })

    return NextResponse.json({ message: 'Email verified' })
  } catch {
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
  }
}
