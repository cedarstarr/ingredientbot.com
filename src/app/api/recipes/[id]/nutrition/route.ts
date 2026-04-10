import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, title: true, servings: true, recipeData: true, nutrition: true },
  })
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return cached nutrition if already estimated
  if (recipe.nutrition) return NextResponse.json({ nutrition: recipe.nutrition })

  const recipeData = recipe.recipeData as {
    ingredients?: { name: string; amount: string; unit: string }[]
    servings?: number
  }
  const ingredients = recipeData.ingredients ?? []
  if (ingredients.length === 0) {
    return NextResponse.json({ error: 'No ingredients found in recipe' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey })
  const ingredientList = ingredients
    .map(i => `${i.amount} ${i.unit} ${i.name}`.trim())
    .join(', ')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: `You are a registered dietitian. Estimate the nutritional content of a recipe per serving.
Return ONLY valid JSON with no markdown, no code blocks, no extra text:
{"calories": number, "protein": number, "fat": number, "carbs": number, "fiber": number}
Values are per serving. Calories in kcal, macros in grams. Round to nearest whole number.`,
    messages: [
      {
        role: 'user',
        content: `Recipe: "${recipe.title}" (${recipe.servings} servings)
Ingredients: ${ingredientList}

Estimate nutrition per serving.`,
      },
    ],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'AI did not return text' }, { status: 500 })
  }

  let nutrition: { calories: number; protein: number; fat: number; carbs: number; fiber: number }
  try {
    const match = content.text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found')
    nutrition = JSON.parse(match[0])
    // Validate required keys exist
    const required = ['calories', 'protein', 'fat', 'carbs', 'fiber']
    for (const key of required) {
      if (typeof nutrition[key as keyof typeof nutrition] !== 'number') {
        throw new Error(`Missing key: ${key}`)
      }
    }
  } catch {
    return NextResponse.json({ error: 'Failed to parse nutrition estimate' }, { status: 500 })
  }

  await prisma.recipe.update({
    where: { id },
    data: { nutrition },
  })

  return NextResponse.json({ nutrition })
}
