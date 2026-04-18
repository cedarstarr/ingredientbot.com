import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamText } from 'ai'
import { claudeSonnet } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actionPrompts: Record<string, (recipe: any, options: any) => string> = {
  lower_calories: () => `Modify this recipe to reduce calories by at least 20% while keeping it delicious. Use lower-calorie substitutions (e.g., Greek yogurt for cream, lean meats, reduce oil). Show the modified recipe in full with all ingredients and steps.`,
  reduce_fat: () => `Modify this recipe to significantly reduce fat content. Replace high-fat ingredients with lower-fat alternatives. Show the complete modified recipe.`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  change_servings: (recipe: any, { targetServings }: any) => `Adapt this recipe from ${recipe.servings} servings to ${targetServings} servings. Adjust all ingredient quantities proportionally. Show the complete modified recipe.`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  change_method: (_: any, { targetMethod }: any) => `Rewrite this recipe to use ${targetMethod} cooking instead of the original method. Adjust times, temperatures, and any technique-specific instructions. Show the complete modified recipe.`,
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id }
  })
  if (!recipe) return new Response('Not found', { status: 404 })

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    const mockMarkdown = `# Modified Recipe\n\nThis is a mock modified recipe for testing.\n\n## Ingredients\n- 400g spaghetti\n- 4 eggs\n- 100g Pecorino Romano\n\n## Instructions\n1. Boil pasta\n2. Combine ingredients off heat\n`
    return new Response(mockMarkdown, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('AI service not configured', { status: 503 })
  }

  const body = await req.json()
  const { action, targetServings, targetMethod } = body

  const actionPrompt = actionPrompts[action]
  if (!actionPrompt) return new Response('Invalid action', { status: 400 })

  const result = streamText({
    model: claudeSonnet,
    maxOutputTokens: 2048,
    system: 'You are an expert chef who helps people modify recipes. Present modifications clearly in markdown.',
    messages: [{
      role: 'user',
      content: `Here is the current recipe:\n${recipe.rawText}\n\n${actionPrompt(recipe, { targetServings, targetMethod })}`,
    }],
  })

  // Frontend reads raw text with getReader() — use toTextStreamResponse (not toDataStreamResponse)
  return result.toTextStreamResponse({
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}
