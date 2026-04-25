import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { HistoryClient } from '@/components/recipe/history-client'

export const metadata = { title: 'Recipe History — Robot Food' }

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; cooked?: string; page?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { q, tag, cooked, page } = await searchParams
  const PAGE_SIZE = 20
  const currentPage = Math.max(1, parseInt(page ?? '1', 10))

  const where = {
    userId: session.user.id,
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { sourceIngredients: { has: q.toLowerCase() } },
      ],
    }),
    ...(tag && { tags: { has: tag } }),
    ...(cooked === '1' && { cookedCount: { gt: 0 } }),
  }

  const [recipes, total] = await Promise.all([
    prisma.recipe.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        description: true,
        cuisine: true,
        difficulty: true,
        prepTimeMin: true,
        cookTimeMin: true,
        servings: true,
        tags: true,
        cookedCount: true,
        lastCookedAt: true,
        sourceIngredients: true,
        fromPhoto: true,
        createdAt: true,
        collection: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.recipe.count({ where }),
  ])

  // Gather all distinct tags for filter chips — take: 500 prevents unbounded scan
  // (tags is a Postgres String[] so Prisma can't use distinct on it directly)
  const allTagRows = await prisma.recipe.findMany({
    where: { userId: session.user.id },
    select: { tags: true },
    take: 500,
  })
  const allTags = [...new Set(allTagRows.flatMap(r => r.tags))].sort()

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <HistoryClient
        recipes={JSON.parse(JSON.stringify(recipes))}
        allTags={allTags}
        total={total}
        currentPage={currentPage}
        totalPages={totalPages}
        initialQ={q ?? ''}
        initialTag={tag ?? ''}
        initialCooked={cooked === '1'}
      />
    </div>
  )
}
