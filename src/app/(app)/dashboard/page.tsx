import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChefHat, BookOpen, ArrowRight, Clock, Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { CookingHeatmap } from '@/components/recipe/cooking-heatmap'

export const metadata = { title: 'Dashboard — Robot Food' }

// F47: Compute streak from sorted list of unique cook dates (UTC day strings)
function computeStreak(cookDates: string[]): { current: number; longest: number } {
  if (cookDates.length === 0) return { current: 0, longest: 0 }

  const sorted = [...cookDates].sort()
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  // Current streak: count backwards from today or yesterday
  let current = 0
  const lastCook = sorted[sorted.length - 1]
  if (lastCook === todayStr || lastCook === yesterdayStr) {
    current = 1
    let prev = lastCook
    for (let i = sorted.length - 2; i >= 0; i--) {
      const expectedPrev = new Date(new Date(prev).getTime() - 86_400_000).toISOString().split('T')[0]
      if (sorted[i] === expectedPrev) {
        current++
        prev = sorted[i]
      } else {
        break
      }
    }
  }

  // Longest streak: scan all dates
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const expectedNext = new Date(new Date(prev).getTime() + 86_400_000).toISOString().split('T')[0]
    if (sorted[i] === expectedNext) {
      run++
      if (run > longest) longest = run
    } else if (sorted[i] !== prev) {
      // not a duplicate day
      run = 1
    }
  }

  return { current, longest }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  // F47: fetch 84 days of completions for the heatmap (12 weeks × 7 days)
  const heatmapStart = new Date(Date.now() - 83 * 86_400_000)
  heatmapStart.setUTCHours(0, 0, 0, 0)

  const [recentRecipes, totalCount, completionsThisMonth, allCompletions] = await Promise.all([
    prisma.recipe.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, title: true, cuisine: true, prepTimeMin: true, cookTimeMin: true, createdAt: true }
    }),
    prisma.recipe.count({ where: { userId: session.user.id } }),
    prisma.recipeCompletion.count({
      where: { userId: session.user.id, cookedAt: { gte: monthStart } },
    }),
    prisma.recipeCompletion.findMany({
      where: { userId: session.user.id, cookedAt: { gte: heatmapStart } },
      select: { cookedAt: true },
      orderBy: { cookedAt: 'asc' },
    }),
  ])

  // Build unique day set for streak calculation (all time)
  const allTimeCompletions = await prisma.recipeCompletion.findMany({
    where: { userId: session.user.id },
    select: { cookedAt: true },
    orderBy: { cookedAt: 'asc' },
  })
  const uniqueDays = [...new Set(allTimeCompletions.map(c => c.cookedAt.toISOString().split('T')[0]))]
  const { current: currentStreak, longest: longestStreak } = computeStreak(uniqueDays)

  // Build heatmap data: map day-string → count
  const heatmapCounts: Record<string, number> = {}
  for (const c of allCompletions) {
    const day = c.cookedAt.toISOString().split('T')[0]
    heatmapCounts[day] = (heatmapCounts[day] ?? 0) + 1
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back{session.user.name ? `, ${session.user.name}` : ''}!
        </h1>
        <p className="text-muted-foreground mt-1">
          You have <strong>{totalCount}</strong> saved recipe{totalCount !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* F47: Cooking stats row */}
      {(completionsThisMonth > 0 || currentStreak > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Recipes cooked this month</p>
            <p className="text-3xl font-bold text-foreground">{completionsThisMonth}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">Current cooking streak</p>
            </div>
            <p className="text-3xl font-bold text-foreground">
              {currentStreak}
              <span className="text-base font-normal text-muted-foreground ml-1">day{currentStreak !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">Longest streak ever</p>
            <p className="text-3xl font-bold text-foreground">
              {longestStreak}
              <span className="text-base font-normal text-muted-foreground ml-1">day{longestStreak !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>
      )}

      {/* F47: 12-week cooking heatmap */}
      {allCompletions.length > 0 && (
        <CookingHeatmap heatmapCounts={heatmapCounts} startDate={heatmapStart.toISOString()} />
      )}

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <ChefHat className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Start Cooking</h3>
              <p className="text-xs text-muted-foreground">Generate new recipes from your ingredients</p>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link href="/kitchen">
              Go to Kitchen
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Saved Recipes</h3>
              <p className="text-xs text-muted-foreground">{totalCount} recipe{totalCount !== 1 ? 's' : ''} in your collection</p>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/saved">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Recent recipes */}
      {recentRecipes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Recipes</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/saved">View all</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {recentRecipes.map(recipe => {
              const totalMin = (recipe.prepTimeMin || 0) + (recipe.cookTimeMin || 0)
              return (
                <Link
                  key={recipe.id}
                  href={`/recipe/${recipe.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {recipe.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {recipe.cuisine && <Badge variant="secondary" className="text-xs">{recipe.cuisine}</Badge>}
                      {totalMin > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {totalMin}m
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(recipe.createdAt)}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
