import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { CollectionDetailClient } from '@/components/recipe/collection-detail-client'

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params

  const collection = await prisma.recipeCollection.findFirst({
    where: { id, userId: session.user.id },
    include: {
      recipes: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          cuisine: true,
          difficulty: true,
          prepTimeMin: true,
          cookTimeMin: true,
          tags: true,
          cookedCount: true,
          createdAt: true,
        },
      },
    },
  })

  if (!collection) notFound()

  return (
    <div className="max-w-4xl mx-auto p-6">
      <CollectionDetailClient collection={JSON.parse(JSON.stringify(collection))} />
    </div>
  )
}
