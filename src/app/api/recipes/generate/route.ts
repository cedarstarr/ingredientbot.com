import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { aiLimiter } from '@/lib/rate-limit'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { ingredients, cuisine, dietary } = await req.json()

  if (!ingredients || ingredients.length < 2) {
    return new Response('Need at least 2 ingredients', { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response('AI service not configured', { status: 503 })
  }

  const anthropic = new Anthropic({ apiKey })

  const dietaryStr = dietary?.length ? `Dietary restrictions: ${dietary.join(', ')}.` : ''
  const cuisineStr = cuisine && cuisine !== 'any' ? `Preferred cuisine: ${cuisine}.` : ''

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are an expert chef. When given a list of ingredients, suggest exactly 4 recipes that use most of them.

CRITICAL: Respond with ONLY newline-delimited JSON objects, one recipe per line, NO other text before or after.
Each line must be a complete valid JSON object with these exact keys:
{"title":"Recipe Name","description":"One sentence description","prepMin":15,"cookMin":25,"servings":4,"cuisine":"Italian","difficulty":"easy"}

difficulty must be exactly: "easy", "medium", or "hard"`,
    messages: [{
      role: 'user',
      content: `I have these ingredients: ${ingredients.join(', ')}. ${cuisineStr} ${dietaryStr} Suggest 4 recipes.`
    }]
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    }
  })
}
