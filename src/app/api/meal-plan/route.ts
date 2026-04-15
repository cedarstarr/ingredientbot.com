import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MealType } from '@prisma/client'

// GET /api/meal-plan?weekStart=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekStart = req.nextUrl.searchParams.get('weekStart')
  if (!weekStart) return NextResponse.json({ error: 'weekStart is required' }, { status: 400 })

  const date = new Date(weekStart)
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid weekStart date' }, { status: 400 })
  }

  try {
    const plan = await prisma.mealPlan.findUnique({
      where: { userId_weekStart: { userId: session.user.id, weekStart: date } },
      include: {
        slots: {
          include: {
            recipe: {
              select: { id: true, title: true, cuisine: true, difficulty: true },
            },
          },
        },
      },
    })
    return NextResponse.json(plan ?? { slots: [] })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch meal plan' }, { status: 500 })
  }
}

// PUT /api/meal-plan — upsert a slot
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { weekStart, dayOfWeek, mealType, recipeId } = body as {
    weekStart: string
    dayOfWeek: number
    mealType: string
    recipeId: string
  }

  if (!weekStart || dayOfWeek === undefined || !mealType || !recipeId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate mealType against the enum — reject unknown values early
  const validMealTypes: string[] = Object.values(MealType)
  if (!validMealTypes.includes(mealType)) {
    return NextResponse.json({ error: 'Invalid mealType' }, { status: 400 })
  }

  const date = new Date(weekStart)
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid weekStart date' }, { status: 400 })
  }

  try {
    // Verify recipe belongs to the user
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, userId: session.user.id },
    })
    if (!recipe) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

    // Upsert the meal plan
    const plan = await prisma.mealPlan.upsert({
      where: { userId_weekStart: { userId: session.user.id, weekStart: date } },
      create: { userId: session.user.id, weekStart: date },
      update: {},
    })

    // Upsert the slot — mealType is already validated above
    const slot = await prisma.mealPlanSlot.upsert({
      where: { mealPlanId_dayOfWeek_mealType: { mealPlanId: plan.id, dayOfWeek, mealType: mealType as MealType } },
      create: { mealPlanId: plan.id, dayOfWeek, mealType: mealType as MealType, recipeId },
      update: { recipeId },
      include: {
        recipe: { select: { id: true, title: true, cuisine: true, difficulty: true } },
      },
    })
    return NextResponse.json(slot)
  } catch {
    return NextResponse.json({ error: 'Failed to update meal plan' }, { status: 500 })
  }
}
