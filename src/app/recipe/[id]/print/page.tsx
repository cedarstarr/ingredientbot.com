import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { PrintRecipeView } from '@/components/recipe/print-recipe-view'
import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return { title: 'Print Recipe' }

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { title: true },
  })
  return { title: recipe ? `Print: ${recipe.title}` : 'Print Recipe' }
}

export default async function RecipePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect('/login')

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    // Print view needs full recipe data but not rawText (AI response) or modification history
    select: {
      id: true, title: true, description: true, cuisine: true, difficulty: true,
      servings: true, prepTimeMin: true, cookTimeMin: true, tags: true,
      recipeData: true, nutrition: true, sourceIngredients: true,
      isPublic: true, publicSlug: true, createdAt: true, updatedAt: true,
    },
  })

  if (!recipe) notFound()

  return <PrintRecipeView recipe={JSON.parse(JSON.stringify(recipe))} />
}
