import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CollectionsClient } from '@/components/recipe/collections-client'

export const metadata = { title: 'Collections — IngredientBot' }

export default async function CollectionsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const collections = await prisma.recipeCollection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      _count: { select: { recipes: true } },
      // Preview: 3 most recent recipes in each collection
      recipes: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, title: true, cuisine: true },
      },
    },
  })

  return (
    <div className="max-w-4xl mx-auto p-6">
      <CollectionsClient collections={JSON.parse(JSON.stringify(collections))} />
    </div>
  )
}
