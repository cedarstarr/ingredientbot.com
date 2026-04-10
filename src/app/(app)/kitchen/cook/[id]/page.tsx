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
  })

  if (!recipe) notFound()

  return <CookingModeClient recipe={JSON.parse(JSON.stringify(recipe))} />
}
