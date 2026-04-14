import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SavedRecipesClient } from '@/components/recipe/saved-recipes-client'

export const metadata = { title: 'Saved Recipes — Robot Food' }

export default async function SavedPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // 500-recipe cap: users with huge libraries are power users who will use /history for search/filter
  const recipes = await prisma.recipe.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      title: true,
      description: true,
      cuisine: true,
      difficulty: true,
      prepTimeMin: true,
      cookTimeMin: true,
      servings: true,
      createdAt: true,
      isPublic: true,
      publicSlug: true,
      rating: true,  // F51
    }
  })

  return (
    <div className="max-w-4xl mx-auto p-6">
      <SavedRecipesClient recipes={JSON.parse(JSON.stringify(recipes))} />
    </div>
  )
}
