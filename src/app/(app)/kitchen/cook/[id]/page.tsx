import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { CookingModeClient } from '@/components/kitchen/cooking-mode-client'

export const metadata = { title: 'Cooking Mode — IngredientBot' }

export default async function CookingModePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    // Exclude rawText (db.Text) — cooking mode needs recipeData/steps but not the raw AI response
    select: {
      id: true, title: true, description: true, cuisine: true, difficulty: true,
      servings: true, prepTimeMin: true, cookTimeMin: true, tags: true,
      recipeData: true, modifications: true, nutrition: true,
      sourceIngredients: true, fromPhoto: true,
      cookedCount: true, lastCookedAt: true,
      isPublic: true, publicSlug: true, rating: true,
      collectionId: true, createdAt: true, updatedAt: true,
    },
  })

  if (!recipe) notFound()

  return <CookingModeClient recipe={JSON.parse(JSON.stringify(recipe))} />
}
