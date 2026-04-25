import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

  const { missingIngredient } = await req.json()
  if (!missingIngredient) {
    return NextResponse.json({ error: 'missingIngredient is required' }, { status: 400 })
  }

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return NextResponse.json({
      role: 'Fat and flavor base that crisps up and renders its fat into the dish.',
      substitutions: [
        {
          name: 'Pancetta',
          quantity: '150g',
          flavorImpact: 'Less fatty than the original but delivers a similar cured-pork flavor.',
          textureImpact: 'Crisps up similarly when rendered.',
          confidence: 'works_great',
          techniqueNote: null,
        },
        {
          name: 'Thick-cut bacon',
          quantity: '150g',
          flavorImpact: 'Adds a smokier flavor that changes the character of the dish slightly.',
          textureImpact: 'Crisps well; drain excess fat before combining.',
          confidence: 'works_ok',
          techniqueNote: 'Drain some of the rendered fat before adding pasta.',
        },
      ],
      tip: 'Whichever you use, render the fat slowly over medium heat for the best texture.',
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('AI service not configured', { status: 503 })
  }

  interface RecipeDataShape {
    title?: string
    ingredients?: Array<{ name: string; amount: string; unit: string }>
    steps?: string[]
  }
  const recipeData = recipe.recipeData as RecipeDataShape

  const ingredientList = recipeData.ingredients
    ? recipeData.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`.trim()).join(', ')
    : recipe.sourceIngredients.join(', ')

  const { text, usage } = await generateText({
    model: claudeSonnet,
    maxOutputTokens: 800,
    system: `You are a professional chef and food scientist. Analyze the role an ingredient plays in a recipe and suggest practical substitutions. Respond with valid JSON only, no markdown fences:
{
  "role": "one sentence describing what role this ingredient plays (e.g., binder, acid, fat, leavener, flavor base)",
  "substitutions": [
    {
      "name": "substitute ingredient name",
      "quantity": "adjusted quantity with unit",
      "flavorImpact": "how it changes the flavor (1-2 sentences)",
      "textureImpact": "how it changes the texture (1 sentence)",
      "confidence": "works_great" | "works_ok" | "last_resort",
      "techniqueNote": "any technique adjustment needed, or null"
    }
  ],
  "tip": "brief chef's tip about the substitution"
}`,
    messages: [{
      role: 'user',
      content: `Recipe: ${recipeData.title || recipe.title}
All ingredients: ${ingredientList}
Missing ingredient: ${missingIngredient}

Analyze what role "${missingIngredient}" plays in this specific recipe and suggest 2-3 substitutions ordered from best to last resort.`,
    }],
  })

  logAICall({
    feature: "ingredient-substitute",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    userId: session.user.id,
  })

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Failed to parse substitutions' }, { status: 500 })
  }

  try {
    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 500 })
  }
}
