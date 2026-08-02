import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamText } from 'ai'
import { dietaryModel, hasAllergenRestriction } from '@/lib/ai'
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
  protein_max: () => `Modify this recipe so each serving contains at least 40g of protein. Add or swap in protein-dense ingredients (chicken, beef, eggs, Greek yogurt, cottage cheese, tofu, tempeh, legumes) without breaking the dish. Show the complete modified recipe.`,
  make_vegetarian: () => `Modify this recipe to be fully vegetarian. Replace any meat or fish with satisfying vegetarian substitutes that keep the texture and flavor profile. Show the complete modified recipe.`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  change_cuisine: (_: any, { cuisine }: any) => `Reinterpret this recipe in the style of ${cuisine} cuisine. Adjust seasonings, techniques, and ingredients to match that cuisine authentically while keeping the core dish recognizable. Show the complete modified recipe.`,
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    // rawText is needed here: it's the full AI-generated recipe text fed back into the modify prompt.
    // Exclude heavier fields not needed (nutrition, sourceIngredients, tags, etc.)
    select: {
      id: true, title: true, servings: true, cuisine: true, difficulty: true,
      recipeData: true, modifications: true, rawText: true,
    },
  })
  if (!recipe) return new Response('Not found', { status: 404 })

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    const mockMarkdown = `# Modified Recipe\n\nThis is a mock modified recipe for testing.\n\n## Ingredients\n- 400g spaghetti\n- 4 eggs\n- 100g Pecorino Romano\n\n## Instructions\n1. Boil pasta\n2. Combine ingredients off heat\n`
    return new Response(mockMarkdown, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  }

  const body = await req.json()
  const { action, targetServings, targetMethod } = body

  const actionPrompt = actionPrompts[action]
  if (!actionPrompt) return new Response('Invalid action', { status: 400 })

  // F31 + allergen safety: every modify action rewrites ingredients. Without the user's
  // dietary profile the AI could cheerfully suggest almond butter to a tree-nut-allergic
  // user asking to "make vegetarian". Load restrictions and escalate to the paid safety
  // lane whenever an allergen restriction is in play — same rule already applied to
  // /generate, /cook, /substitute, /convert-diet.
  const dietaryProfile = await prisma.dietaryProfile.findUnique({
    where: { userId: session.user.id },
    select: { restrictions: true, dislikedIngredients: true },
  })
  const restrictions = dietaryProfile?.restrictions ?? []
  const isAllergenCall = hasAllergenRestriction(restrictions)

  // Guard the lane actually being used. Allergen calls require Anthropic; free-tier
  // calls only need Cerebras/Groq. The old guard checked ANTHROPIC_API_KEY unconditionally
  // while the call ran on the free tier — it never fired when it mattered.
  const laneConfigured = isAllergenCall
    ? Boolean(process.env.ANTHROPIC_API_KEY)
    : Boolean(process.env.CEREBRAS_API_KEY || process.env.GROQ_API_KEY)
  if (!laneConfigured) {
    return new Response('AI service not configured', { status: 503 })
  }

  const restrictionLines: string[] = []
  if (restrictions.length) {
    restrictionLines.push(
      isAllergenCall
        ? `HARD CONSTRAINT — the user has allergen-bearing restrictions: ${restrictions.join(', ')}. Every ingredient in the modified recipe must be safe under all of them. If a common substitute would violate one (e.g. almond flour for a nut allergy), do not use it — choose a different substitute. If no safe modification exists, say so clearly instead of guessing.`
        : `User dietary restrictions (always apply): ${restrictions.join(', ')}.`
    )
  }
  if (dietaryProfile?.dislikedIngredients?.length) {
    restrictionLines.push(`User dislikes these ingredients (avoid): ${dietaryProfile.dislikedIngredients.join(', ')}.`)
  }
  const restrictionContext = restrictionLines.length ? `\n\n${restrictionLines.join('\n')}` : ''

  try {
    const result = streamText({
      model: dietaryModel(restrictions, { feature: 'recipe-modify', userId: session.user.id }),
      maxOutputTokens: 2048,
      system: `You are an expert chef who helps people modify recipes. Present modifications clearly in markdown.${restrictionContext}`,
      messages: [{
        role: 'user',
        content: `Here is the current recipe:\n${recipe.rawText}\n\n${actionPrompt(recipe, { targetServings, targetMethod })}`,
      }],
    })

    // Frontend reads raw text with getReader() — use toTextStreamResponse (not toDataStreamResponse)
    return result.toTextStreamResponse({
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  } catch {
    return new Response('AI service unavailable', { status: 503 })
  }
}
