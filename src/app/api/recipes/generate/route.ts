import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { aiLimiter } from '@/lib/rate-limit'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { ingredients, cuisine, dietary, expiringIngredients, leftovers, strictMode, teachMode } = await req.json()

  if (!ingredients || ingredients.length < 2) {
    return new Response('Need at least 2 ingredients', { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response('AI service not configured', { status: 503 })
  }

  // F31: Load dietary profile to inject persistent preferences into every generation
  const dietaryProfile = await prisma.dietaryProfile.findUnique({
    where: { userId: session.user.id },
    select: { restrictions: true, cuisinePrefs: true, dislikedIngredients: true },
  })

  const anthropic = new Anthropic({ apiKey })

  const sessionDietaryStr = dietary?.length ? `Dietary restrictions: ${dietary.join(', ')}.` : ''
  const cuisineStr = cuisine && cuisine !== 'any' ? `Preferred cuisine: ${cuisine}.` : ''

  // F31: Build persistent profile context appended to system prompt
  const profileLines: string[] = []
  if (dietaryProfile?.restrictions?.length) {
    profileLines.push(`User dietary restrictions (always apply): ${dietaryProfile.restrictions.join(', ')}.`)
  }
  if (dietaryProfile?.dislikedIngredients?.length) {
    profileLines.push(`User dislikes these ingredients (avoid): ${dietaryProfile.dislikedIngredients.join(', ')}.`)
  }
  if (dietaryProfile?.cuisinePrefs?.length) {
    profileLines.push(`User cuisine preferences (favor when no cuisine specified): ${dietaryProfile.cuisinePrefs.join(', ')}.`)
  }
  const profileContext = profileLines.length ? `\n\nUser profile:\n${profileLines.join('\n')}` : ''

  // F26: expiry-first mode — tell AI to prioritize using expiring items
  const expiryContext = expiringIngredients?.length
    ? `\n\nIMPORTANT: These ingredients are expiring soon and must be prioritized in the recipes: ${(expiringIngredients as string[]).join(', ')}. Each recipe should use at least one of these expiring ingredients.`
    : ''

  // F28: leftover optimizer mode — frame leftovers as star ingredients
  const leftoverContext = leftovers
    ? `\n\nLEFTOVER MODE: The user has these leftover ingredients to use up: ${leftovers}. Create recipes that incorporate them as the star ingredients to minimize waste. The leftovers must feature prominently in every recipe.`
    : ''

  // F61: strict mode — no assumed pantry staples
  const strictContext = strictMode
    ? `\n\nSTRICT MODE: Use ONLY the listed ingredients. Do not assume the user has oil, salt, butter, or any other pantry staples unless explicitly listed.`
    : ''

  // F64: teach me mode — verbose explanations (surfaced in description to fit the suggestion format)
  const teachContext = teachMode
    ? `\n\nTEACH ME MODE: Write descriptions that hint at the cooking technique and explain WHY each recipe method works. Each description should be educational and mention a key technique insight.`
    : ''

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `You are an expert chef. When given a list of ingredients, suggest exactly 4 recipes that use most of them.

CRITICAL: Respond with ONLY newline-delimited JSON objects, one recipe per line, NO other text before or after.
Each line must be a complete valid JSON object with these exact keys:
{"title":"Recipe Name","description":"One sentence description","prepMin":15,"cookMin":25,"servings":4,"cuisine":"Italian","difficulty":"easy"}

difficulty must be exactly: "easy", "medium", or "hard"${profileContext}${expiryContext}${leftoverContext}${strictContext}${teachContext}`,
    messages: [{
      role: 'user',
      content: `I have these ingredients: ${ingredients.join(', ')}. ${cuisineStr} ${sessionDietaryStr} Suggest 4 recipes.`
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
