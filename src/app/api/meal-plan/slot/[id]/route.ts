import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/meal-plan/slot/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    // Verify ownership via the meal plan
    const slot = await prisma.mealPlanSlot.findUnique({
      where: { id },
      include: { mealPlan: { select: { userId: true } } },
    })

    if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    if (slot.mealPlan.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.mealPlanSlot.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 })
  }
}
