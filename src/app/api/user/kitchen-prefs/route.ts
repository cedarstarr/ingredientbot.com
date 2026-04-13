import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// F53 + F70: Load and save kitchen-level user preferences (budgetMode, chefPersonality)
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { budgetMode: true, chefPersonality: true },
  })

  return NextResponse.json(user ?? { budgetMode: false, chefPersonality: 'home' })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const data: { budgetMode?: boolean; chefPersonality?: string } = {}
  if (typeof body.budgetMode === 'boolean') data.budgetMode = body.budgetMode
  if (typeof body.chefPersonality === 'string') {
    const valid = ['home', 'french', 'street']
    if (!valid.includes(body.chefPersonality)) {
      return NextResponse.json({ error: 'Invalid chef personality' }, { status: 400 })
    }
    data.chefPersonality = body.chefPersonality
  }

  await prisma.user.update({ where: { id: session.user.id }, data })
  return NextResponse.json({ ok: true })
}
