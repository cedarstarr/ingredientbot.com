import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateText } from 'ai'
import { claudeSonnet } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { logAICall } from '@/lib/ai-log'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return NextResponse.json({ nutrition: { calories: 620, protein: 32, fat: 24, carbs: 68, fiber: 3 } })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 })
  }

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

  const ingredientList = ingredients
    .map(i => `${i.amount} ${i.unit} ${i.name}`.trim())
    .join(', ')

  const { text, usage } = await generateText({
    model: claudeSonnet,
    maxOutputTokens: 256,
    system: `You are a registered dietitian. Estimate the nutritional content of a recipe per serving.
Return ONLY valid JSON with no markdown, no code blocks, no extra text:
{"calories": number, "protein": number, "fat": number, "carbs": number, "fiber": number}
Values are per serving. Calories in kcal, macros in grams. Round to nearest whole number.`,
    messages: [{
      role: 'user',
      content: `Recipe: "${recipe.title}" (${recipe.servings} servings)
Ingredients: ${ingredientList}

Estimate nutrition per serving.`,
    }],
  })

  logAICall({
    feature: "nutrition-estimate",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    userId: session.user.id,
  })

  let nutrition: { calories: number; protein: number; fat: number; carbs: number; fiber: number }
  try {
    const match = text.match(/\{[\s\S]*\}/)
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
