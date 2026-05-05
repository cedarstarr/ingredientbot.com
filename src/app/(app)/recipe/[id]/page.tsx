import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { RecipeDetailClient } from '@/components/recipe/recipe-detail-client'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  // Fetch recipe and collections in parallel — both are needed before render
  const [recipe, collections] = await Promise.all([
    prisma.recipe.findFirst({
      where: { id, userId: session.user.id },
      include: {
        collection: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.recipeCollection.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, color: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!recipe) notFound()

  return (
    <RecipeDetailClient
      recipe={JSON.parse(JSON.stringify(recipe))}
      collections={JSON.parse(JSON.stringify(collections))}
    />
  )
}
