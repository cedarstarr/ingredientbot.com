import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, createdAt: true },
    })

    return NextResponse.json(user)
  } catch (err) {
    logger.error({ err }, 'GET /api/user/profile failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const { name } = body ?? {}
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name },
    })

    return NextResponse.json({ message: 'Profile updated' })
  } catch (err) {
    logger.error({ err }, 'PATCH /api/user/profile failed')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
