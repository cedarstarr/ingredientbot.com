import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { aiLimiter } from '@/lib/rate-limit'

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

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Response('AI service not configured', { status: 503 })

  const anthropic = new Anthropic({ apiKey })

  const recipeData = recipe.recipeData as { title?: string; ingredients?: string[]; instructions?: string[] }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: `You are a professional chef. Suggest ingredient substitutions for a recipe. Respond with JSON:
{
  "substitutions": [
    {
      "name": "substitute ingredient name",
      "quantity": "adjusted quantity",
      "notes": "how it changes the dish",
      "similarity": "high|medium|low"
    }
  ],
  "tip": "brief chef's note about the swap"
}`,
    messages: [{
      role: 'user',
      content: `Recipe: ${recipeData.title || recipe.title}
Ingredients: ${(recipeData.ingredients || recipe.sourceIngredients).join(', ')}
Missing: ${missingIngredient}

Suggest 2-3 substitutions for "${missingIngredient}" that work in this specific recipe context.`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Failed to parse substitutions' }, { status: 500 })
  }

  return NextResponse.json(JSON.parse(jsonMatch[0]))
}
