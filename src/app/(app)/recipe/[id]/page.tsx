import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { RecipeDetailClient } from '@/components/recipe/recipe-detail-client'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  // Fetch recipe, collections, and the most recent AI cook-feedback tip in
  // parallel — all three are needed before render, none depend on each other.
  const [recipe, collections, latestTippedCompletion] = await Promise.all([
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
    // F88: pin the most recent non-null AI tip for this recipe on the detail view.
    prisma.recipeCompletion.findFirst({
      where: { recipeId: id, userId: session.user.id, aiTip: { not: null } },
      orderBy: { cookedAt: 'desc' },
      select: { aiTip: true },
    }),
  ])

  if (!recipe) notFound()

  return (
    <RecipeDetailClient
      recipe={JSON.parse(JSON.stringify(recipe))}
      collections={JSON.parse(JSON.stringify(collections))}
      initialAiTip={latestTippedCompletion?.aiTip ?? null}
    />
  )
}
