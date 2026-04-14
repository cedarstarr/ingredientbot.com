import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { Difficulty } from '@prisma/client'

export const maxDuration = 60

const FREE_TIER_LIMIT = 5

// Returns the first day of the current month at midnight UTC
function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'AI service not configured' }, { status: 503 })
  }

  const { suggestion, ingredients, strictMode, teachMode, leftovers, budgetMode, chefPersonality, dateNightMode } = await req.json()
  if (!suggestion?.title) {
    return Response.json({ error: 'Invalid suggestion' }, { status: 400 })
  }

  // F30: Freemium gate — check + enforce monthly limit
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true, recipeCount: true, monthlyResetDate: true },
  })

  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  if (!user.isPro) {
    const monthStart = startOfCurrentMonth()
    const needsReset = !user.monthlyResetDate || user.monthlyResetDate < monthStart
    const currentCount = needsReset ? 0 : user.recipeCount

    if (currentCount >= FREE_TIER_LIMIT) {
      return Response.json(
        { error: 'limit_reached', limit: FREE_TIER_LIMIT },
        { status: 402 }
      )
    }
  }

  // F31: Load dietary profile for AI system prompt injection
  const dietaryProfile = await prisma.dietaryProfile.findUnique({
    where: { userId: session.user.id },
    select: { restrictions: true, cuisinePrefs: true, dislikedIngredients: true },
  })

  // F31: Build persistent profile context
  const profileLines: string[] = []
  if (dietaryProfile?.restrictions?.length) {
    profileLines.push(`User dietary restrictions (always apply): ${dietaryProfile.restrictions.join(', ')}.`)
  }
  if (dietaryProfile?.dislikedIngredients?.length) {
    profileLines.push(`User dislikes these ingredients (avoid): ${dietaryProfile.dislikedIngredients.join(', ')}.`)
  }
  const profileContext = profileLines.length ? `\n\nUser profile:\n${profileLines.join('\n')}` : ''

  // F61: strict mode — only use explicitly listed ingredients
  const strictContext = strictMode
    ? `\n\nSTRICT MODE: Use ONLY the listed ingredients. Do not assume the user has oil, salt, butter, garlic, onion, or any other pantry staples unless explicitly listed.`
    : ''

  // F64: teach me mode — verbose step-by-step explanations
  const teachContext = teachMode
    ? `\n\nTEACH ME MODE: After each step in the "steps" array, append a brief "Why:" explanation explaining the cooking science or technique. Format: "Do X. Why: This helps Y because Z." Also explain each ingredient's role briefly in the notes field.`
    : ''

  // F28: leftover mode context
  const leftoverContext = leftovers
    ? `\n\nLEFTOVER MODE: These leftovers must feature as the star ingredients: ${leftovers}. Incorporate them prominently to minimize waste.`
    : ''

  // F53: budget mode
  const budgetContext = budgetMode
    ? `\n\nBUDGET MODE: Prioritize cheap ingredients. Avoid expensive proteins. Prefer beans, lentils, eggs, chicken thighs, frozen veg, pantry staples under $2/serving.`
    : ''

  // F70: chef personality
  const personalityContext = chefPersonality === 'french'
    ? `\n\nYou are a classically trained French chef. Use precise culinary terminology, classical techniques, and emphasize proper method.`
    : chefPersonality === 'street'
      ? `\n\nYou are a street food vendor. Emphasize bold flavors, quick cooking, cultural authenticity, and affordable ingredients.`
      : ''

  // F71: date night 3-course mode
  const dateNightContext = dateNightMode
    ? `\n\nDATE NIGHT MODE: This is a Date Night recipe. Make it romantic, impressive, and special. Use elegant plating suggestions in the notes.`
    : ''

  const anthropic = new Anthropic({ apiKey })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are an expert chef. Generate a complete detailed recipe as JSON. Return ONLY valid JSON with no markdown, no code blocks.
Schema:
{
  "title": string,
  "description": string,
  "servings": number,
  "prepTimeMin": number,
  "cookTimeMin": number,
  "cuisine": string,
  "difficulty": "easy" | "medium" | "hard",
  "ingredients": [{"name": string, "amount": string, "unit": string}],
  "steps": [string],
  "notes": string,
  "nutrition": {"calories": number, "protein": number, "fat": number, "carbs": number, "fiber": number}
}${personalityContext}${profileContext}${strictContext}${teachContext}${leftoverContext}${budgetContext}${dateNightContext}`,
    messages: [{
      role: 'user',
      content: `Generate a full recipe for "${suggestion.title}". Description: ${suggestion.description}. Main ingredients available: ${ingredients.join(', ')}. Target servings: ${suggestion.servings || 4}.`
    }]
  })

  const content = response.content[0]
  if (content.type !== 'text') return Response.json({ error: 'Failed to generate recipe' }, { status: 500 })

  let recipeData
  try {
    const match = content.text.match(/\{[\s\S]*\}/)
    recipeData = match ? JSON.parse(match[0]) : null
    if (!recipeData) throw new Error('No JSON found')
  } catch {
    return Response.json({ error: 'Failed to parse recipe' }, { status: 500 })
  }

  const rawText = [
    `# ${recipeData.title}`,
    `\n${recipeData.description}`,
    `\n## Ingredients`,
    recipeData.ingredients.map((i: {amount: string, unit: string, name: string}) => `- ${i.amount} ${i.unit} ${i.name}`).join('\n'),
    `\n## Instructions`,
    recipeData.steps.map((s: string, i: number) => `${i+1}. ${s}`).join('\n'),
    recipeData.notes ? `\n## Notes\n${recipeData.notes}` : ''
  ].join('\n')

  // F30: Wrap recipe creation and usage counter update in a transaction — if either fails,
  // neither is committed, preventing a recipe from being saved without counting toward the limit
  // (or a counter incrementing for a recipe that failed to save).
  const monthStart = startOfCurrentMonth()
  const needsReset = !user.monthlyResetDate || user.monthlyResetDate < monthStart

  const [recipe] = await prisma.$transaction([
    prisma.recipe.create({
      data: {
        userId: session.user.id,
        title: recipeData.title,
        description: recipeData.description,
        servings: recipeData.servings,
        prepTimeMin: recipeData.prepTimeMin,
        cookTimeMin: recipeData.cookTimeMin,
        cuisine: recipeData.cuisine,
        difficulty: recipeData.difficulty as Difficulty | null,
        sourceIngredients: ingredients,
        recipeData: recipeData,
        rawText,
        nutrition: recipeData.nutrition,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        recipeCount: needsReset ? 1 : { increment: 1 },
        monthlyResetDate: needsReset ? monthStart : undefined,
      },
    }),
  ])

  return Response.json({ id: recipe.id })
}
