import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateText } from 'ai'
import { trackedModel } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { buildCookingMethodContext, buildSpiceContext } from '@/lib/recipe-prompt-utils'
import { Difficulty } from '@prisma/client'
import { startOfCurrentMonth } from '@/lib/date-utils'

export const maxDuration = 60

const FREE_TIER_LIMIT = 5

export async function POST(req: NextRequest) {
  try {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    // Skip DB write and AI call — return a stable mock recipe id
    return Response.json({ id: 'test-mock-id' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'AI service not configured' }, { status: 503 })
  }

  const {
    suggestion, ingredients, strictMode, teachMode, leftovers, budgetMode, chefPersonality, dateNightMode,
    // F74–F78: modifiers mirrored from the generate route
    cookingMethod, exhaustedMode, proteinMax, restaurantStyle, spiceLevel,
  } = await req.json()
  if (!suggestion?.title) {
    return Response.json({ error: 'Invalid suggestion' }, { status: 400 })
  }

  // F30 + F31: Fetch user gate data and dietary profile in parallel — both needed before AI call
  const [user, dietaryProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPro: true, recipeCount: true, monthlyResetDate: true },
    }),
    prisma.dietaryProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        restrictions: true,
        cuisinePrefs: true,
        dislikedIngredients: true,
        lowSodium: true,
        lowFodmap: true,
        diabetesFriendly: true,
      },
    }),
  ])

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

  // F31: Build persistent profile context
  const profileLines: string[] = []
  if (dietaryProfile?.restrictions?.length) {
    profileLines.push(`User dietary restrictions (always apply): ${dietaryProfile.restrictions.join(', ')}.`)
  }
  if (dietaryProfile?.dislikedIngredients?.length) {
    profileLines.push(`User dislikes these ingredients (avoid): ${dietaryProfile.dislikedIngredients.join(', ')}.`)
  }
  // F79: medical dietary flags
  if (dietaryProfile?.lowSodium) {
    profileLines.push(`Low-sodium: keep sodium per serving under ~500mg, avoid high-sodium ingredients like soy sauce, cured meats, canned broths.`)
  }
  if (dietaryProfile?.lowFodmap) {
    profileLines.push(`Low-FODMAP: avoid onion, garlic, wheat, lactose, and high-FODMAP foods. Substitute appropriately.`)
  }
  if (dietaryProfile?.diabetesFriendly) {
    profileLines.push(`Diabetes-friendly: keep carbs moderate per serving, prefer low-glycemic ingredients, flag any recipe component that spikes blood sugar.`)
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

  // F74: cooking method constraint — shared with /generate via lib helper
  const cookingMethodContext = buildCookingMethodContext(cookingMethod)

  // F75: exhausted mode
  const exhaustedContext = exhaustedMode
    ? `\n\nEXHAUSTED MODE: Minimize active cooking effort. Prefer dump-and-wait, one-step, or passive-cook recipes. Assume the user has about 5 minutes of active effort. Label the recipe as low-effort.`
    : ''

  // F76: protein-max mode
  const proteinMaxContext = proteinMax
    ? `\n\nPROTEIN-MAX MODE: Each serving must contain at least 40g of protein. Prioritize protein-dense ingredients (chicken, beef, eggs, Greek yogurt, cottage cheese, tofu, tempeh, legumes). Display protein grams prominently in the recipe.`
    : ''

  // F77: restaurant recreation
  const restaurantContext = typeof restaurantStyle === 'string' && restaurantStyle.trim()
    ? `\n\nRESTAURANT RECREATION: Recreate the flavor profile and style of "${restaurantStyle.trim().slice(0, 120)}". Use their known signature techniques and flavors, but make it achievable with pantry ingredients.`
    : ''

  // F78: spice level — always inject even at 0=Mild — shared with /generate
  const spiceContext = buildSpiceContext(spiceLevel)

  let text: string
  try {
    const aiResult = await generateText({
      model: trackedModel('google', 'gemini-2.5-flash-lite', { feature: 'cooking-assistant', userId: session.user.id }),
      maxOutputTokens: 2048,
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
}${personalityContext}${profileContext}${strictContext}${teachContext}${leftoverContext}${budgetContext}${dateNightContext}${cookingMethodContext}${exhaustedContext}${proteinMaxContext}${restaurantContext}${spiceContext}`,
    messages: [{
      role: 'user',
      content: `Generate a full recipe for "${suggestion.title}". Description: ${suggestion.description}. Main ingredients available: ${ingredients.join(', ')}. Target servings: ${suggestion.servings || 4}.`,
    }],
    })
    text = aiResult.text
  } catch {
    return Response.json({ error: 'AI service error' }, { status: 500 })
  }

  let recipeData
  try {
    const match = text.match(/\{[\s\S]*\}/)
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
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
