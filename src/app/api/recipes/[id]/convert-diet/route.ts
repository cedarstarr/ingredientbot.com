import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { generateText } from 'ai'
import { claudeSonnet } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { logAICall } from '@/lib/ai-log'

export const maxDuration = 30

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { diet } = await req.json()
  const validDiets = ['gluten-free', 'vegan', 'keto', 'dairy-free', 'nut-free']
  if (!diet || !validDiets.includes(diet)) {
    return NextResponse.json(
      { error: `diet must be one of: ${validDiets.join(', ')}` },
      { status: 400 }
    )
  }

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return NextResponse.json({
      convertedIngredients: ['400g gluten-free pasta', '4 eggs', '100g Pecorino Romano', '150g guanciale'],
      adjustedInstructions: ['Boil gluten-free pasta per package instructions', 'Fry guanciale until crispy', 'Mix eggs and cheese off heat', 'Combine and serve immediately'],
      changes: [{ original: 'Spaghetti', replacement: 'Gluten-free pasta', reason: 'To make the dish gluten-free' }],
      flavorNotes: 'Gluten-free pasta has a slightly different texture but the dish retains its rich, savory character.',
      difficulty: 'same',
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('AI service not configured', { status: 503 })
  }

  const recipeData = recipe.recipeData as {
    title?: string
    ingredients?: string[]
    instructions?: string[]
  }

  const { text, usage } = await generateText({
    model: claudeSonnet,
    maxOutputTokens: 800,
    system: `You are a professional chef specializing in dietary adaptations. Convert recipes to fit specific dietary restrictions while maintaining flavor and texture. Respond with JSON:
{
  "convertedIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "adjustedInstructions": ["step 1", "step 2"],
  "changes": [
    { "original": "original ingredient", "replacement": "new ingredient", "reason": "why" }
  ],
  "flavorNotes": "brief note on how the dish will taste differently",
  "difficulty": "easier|same|harder"
}`,
    messages: [{
      role: 'user',
      content: `Convert this recipe to ${diet}:

Title: ${recipeData.title || recipe.title}
Ingredients: ${JSON.stringify(recipeData.ingredients || recipe.sourceIngredients)}
Instructions: ${JSON.stringify(recipeData.instructions || [])}`,
    }],
  })

  logAICall({
    feature: "diet-conversion",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    userId: session.user.id,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Failed to parse conversion' }, { status: 500 })
  }

  const conversion = JSON.parse(jsonMatch[0])

  // Save as modification on the recipe
  const existingMods = Array.isArray(recipe.modifications) ? recipe.modifications : []
  const newMods = [
    ...existingMods,
    {
      type: 'diet-conversion',
      diet,
      conversion,
      timestamp: new Date().toISOString(),
    },
  ]

  await prisma.recipe.update({
    where: { id },
    data: { modifications: newMods as unknown as Prisma.InputJsonValue },
  })

  return NextResponse.json(conversion)
}
