import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ChefPersonality } from '@prisma/client'

// F53 + F70 + F74 + F78: Load and save kitchen-level user preferences
// (budgetMode, chefPersonality, cookingMethod, spiceLevel)

// F74: valid cooking-method values — any change here must also update the kitchen panel <Select>
const VALID_COOKING_METHODS = new Set([
  'any',
  'Sheet Pan',
  'One-Pot',
  'Air Fryer',
  'Slow Cooker',
  'Instant Pot',
  'Microwave Only',
  'No Stove',
])

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      budgetMode: true,
      chefPersonality: true,
      cookingMethod: true,
      spiceLevel: true,
    },
  })

  return NextResponse.json(
    user ?? {
      budgetMode: false,
      chefPersonality: 'home',
      cookingMethod: 'any',
      spiceLevel: 0,
    }
  )
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const data: {
    budgetMode?: boolean
    chefPersonality?: ChefPersonality
    cookingMethod?: string
    spiceLevel?: number
  } = {}

  if (typeof body.budgetMode === 'boolean') data.budgetMode = body.budgetMode
  if (typeof body.chefPersonality === 'string') {
    const valid: string[] = Object.values(ChefPersonality)
    if (!valid.includes(body.chefPersonality)) {
      return NextResponse.json({ error: 'Invalid chef personality' }, { status: 400 })
    }
    data.chefPersonality = body.chefPersonality as ChefPersonality
  }
  if (typeof body.cookingMethod === 'string') {
    if (!VALID_COOKING_METHODS.has(body.cookingMethod)) {
      return NextResponse.json({ error: 'Invalid cooking method' }, { status: 400 })
    }
    data.cookingMethod = body.cookingMethod
  }
  // F78: clamp to 0..3 — slider should never exceed this, but enforce server-side
  if (typeof body.spiceLevel === 'number' && Number.isInteger(body.spiceLevel)) {
    if (body.spiceLevel < 0 || body.spiceLevel > 3) {
      return NextResponse.json({ error: 'Invalid spice level' }, { status: 400 })
    }
    data.spiceLevel = body.spiceLevel
  }

  await prisma.user.update({ where: { id: session.user.id }, data })
  return NextResponse.json({ ok: true })
}
