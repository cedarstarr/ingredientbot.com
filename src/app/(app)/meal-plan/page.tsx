import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { MealPlannerClient } from '@/components/meal-plan/meal-planner-client'

export const metadata = { title: 'Meal Planner — Robot Food' }

/** Normalize a date to the Monday of its week at midnight UTC */
function getWeekStart(from: Date): Date {
  const d = new Date(from)
  // getUTCDay(): 0=Sun,1=Mon,...,6=Sat — shift so Monday=0
  const day = d.getUTCDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day // days to subtract to get to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export default async function MealPlanPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const weekStart = getWeekStart(new Date())
  const weekStartStr = weekStart.toISOString().slice(0, 10)

  const [plan, savedRecipes] = await Promise.all([
    prisma.mealPlan.findUnique({
      where: { userId_weekStart: { userId: session.user.id, weekStart } },
      include: {
        slots: {
          include: {
            recipe: {
              select: { id: true, title: true, cuisine: true, difficulty: true },
            },
          },
        },
      },
    }),
    prisma.recipe.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, cuisine: true, difficulty: true },
    }),
  ])

  const initialPlan = plan ? JSON.parse(JSON.stringify(plan)) : { slots: [] }
  const serializedRecipes = JSON.parse(JSON.stringify(savedRecipes))

  return (
    <MealPlannerClient
      weekStart={weekStartStr}
      initialPlan={initialPlan}
      savedRecipes={serializedRecipes}
    />
  )
}
