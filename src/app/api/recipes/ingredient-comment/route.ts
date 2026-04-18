import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { generateText } from 'ai'
import { claudeHaiku } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return Response.json({ comment: 'This ingredient adds a sharp, salty depth that is essential to the dish. A close substitute will work but the flavor will be milder.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'AI service not configured' }, { status: 503 })
  }

  const { recipeTitle, ingredient, action } = await req.json()

  const { text } = await generateText({
    model: claudeHaiku,
    maxOutputTokens: 100,
    messages: [{
      role: 'user',
      content: `In the context of "${recipeTitle}", what is the effect of ${action === 'add' ? 'adding' : 'removing'} ${ingredient}? Reply in exactly 1-2 sentences focusing on flavor, texture, or nutrition. Be specific and helpful.`,
    }],
  })

  return Response.json({ comment: text })
}
