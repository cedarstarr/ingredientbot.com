import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamText } from 'ai'
import { claudeSonnet } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { logAICall } from '@/lib/ai-log'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const {
    ingredients, cuisine, dietary, expiringIngredients, leftovers,
    strictMode, teachMode,
    impressMe, prepTimeLimit, budgetMode, chefPersonality, dateNightMode, personalityPrompt,
    // F74: cooking method (string). F75: exhausted toggle. F76: protein-max toggle.
    // F77: restaurant recreation free-text. F78: spice level 0..3.
    cookingMethod, exhaustedMode, proteinMax, restaurantStyle, spiceLevel,
  } = await req.json()

  // F54: "Impress Me" bypasses the ingredient count guard
  if (!impressMe && (!ingredients || ingredients.length < 2)) {
    return new Response('Need at least 2 ingredients', { status: 400 })
  }

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    const mockLines = [
      JSON.stringify({ title: 'Classic Spaghetti Carbonara', description: 'A rich Italian pasta dish with eggs and cheese.', prepMin: 15, cookMin: 20, servings: 4, cuisine: 'Italian', difficulty: 'easy' }),
      JSON.stringify({ title: 'Vegetable Stir Fry', description: 'Quick and healthy stir fry with seasonal vegetables.', prepMin: 10, cookMin: 15, servings: 2, cuisine: 'Asian', difficulty: 'easy' }),
      JSON.stringify({ title: 'Mushroom Risotto', description: 'Creamy Italian rice dish with earthy mushrooms.', prepMin: 10, cookMin: 30, servings: 4, cuisine: 'Italian', difficulty: 'medium' }),
      JSON.stringify({ title: 'Garlic Butter Pasta', description: 'Simple pasta with fragrant garlic butter sauce.', prepMin: 5, cookMin: 15, servings: 2, cuisine: 'Italian', difficulty: 'easy' }),
    ].join('\n')
    return new Response(mockLines, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' },
    })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('AI service not configured', { status: 503 })
  }

  // F31: Load dietary profile to inject persistent preferences into every generation
  // F79: also load medical flags (low-sodium, low-FODMAP, diabetes-friendly)
  const dietaryProfile = await prisma.dietaryProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      restrictions: true,
      cuisinePrefs: true,
      dislikedIngredients: true,
      lowSodium: true,
      lowFodmap: true,
      diabetesFriendly: true,
    },
  })

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
  // F79: medical dietary flags — phrased as guidance (disclaimer shown in UI, not medical advice)
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

  // F32: prep time constraint — injected when a limit is selected
  const prepTimeContext = prepTimeLimit
    ? `\n\nConstraint: this recipe must be completable in under ${prepTimeLimit} minutes total prep + cook time.`
    : ''

  // F53: budget mode — cheap ingredients only
  const budgetContext = budgetMode
    ? `\n\nBUDGET MODE: Prioritize recipes using the cheapest possible ingredient combinations. Avoid expensive proteins (lobster, prime beef, exotic produce). Prefer beans, lentils, eggs, chicken thighs, frozen veg, and pantry staples that cost under $2/serving.`
    : ''

  // F70: chef personality prefix
  const personalityContext = personalityPrompt
    ? `\n\n${personalityPrompt}`
    : chefPersonality === 'french'
      ? `\n\nYou are a classically trained French chef. Use precise culinary terminology, classical techniques, and emphasize proper method.`
      : chefPersonality === 'street'
        ? `\n\nYou are a street food vendor. Emphasize bold flavors, quick cooking, cultural authenticity, and affordable ingredients.`
        : ''

  // F71: date night 3-course mode
  const dateNightContext = dateNightMode
    ? `\n\nDATE NIGHT MODE: Generate a 3-course Date Night menu instead of 4 separate recipes. Provide exactly 3 items: a starter (label it "STARTER:"), a main course (label it "MAIN:"), and a dessert (label it "DESSERT:"). All three should use the listed ingredients. Still output as JSON objects, one per line.`
    : ''

  // F54: "Impress Me" mode — AI chooses the ingredients
  const impressMeContext = impressMe
    ? `\n\nIMPRESS ME MODE: The user has no specific ingredients. Choose 6–8 seasonal, interesting ingredients yourself and generate creative, impressive recipes. Include the chosen ingredients in your description.`
    : ''

  // F74: cooking method constraint — equipment-specific instructions
  const cookingMethodContext = buildCookingMethodContext(cookingMethod)

  // F75: exhausted mode — prefer dump-and-wait recipes
  const exhaustedContext = exhaustedMode
    ? `\n\nEXHAUSTED MODE: Minimize active cooking effort. Prefer dump-and-wait, one-step, or passive-cook recipes. Assume the user has about 5 minutes of active effort. Label the recipe as low-effort.`
    : ''

  // F76: protein-max — enforce 40g+ protein per serving
  const proteinMaxContext = proteinMax
    ? `\n\nPROTEIN-MAX MODE: Each serving must contain at least 40g of protein. Prioritize protein-dense ingredients (chicken, beef, eggs, Greek yogurt, cottage cheese, tofu, tempeh, legumes). Display protein grams prominently in the recipe.`
    : ''

  // F77: restaurant recreation — trim the user input to avoid prompt-injection-style bloat
  const restaurantContext = typeof restaurantStyle === 'string' && restaurantStyle.trim()
    ? `\n\nRESTAURANT RECREATION: Recreate the flavor profile and style of "${restaurantStyle.trim().slice(0, 120)}". Use their known signature techniques and flavors, but make it achievable with pantry ingredients.`
    : ''

  // F78: spice level — always inject (even at 0=Mild) so AI knows to restrain itself
  const spiceContext = buildSpiceContext(spiceLevel)

  const result = streamText({
    model: claudeSonnet,
    maxOutputTokens: 1024,
    system: `You are an expert chef. When given a list of ingredients, suggest exactly 4 recipes that use most of them.

CRITICAL: Respond with ONLY newline-delimited JSON objects, one recipe per line, NO other text before or after.
Each line must be a complete valid JSON object with these exact keys:
{"title":"Recipe Name","description":"One sentence description","prepMin":15,"cookMin":25,"servings":4,"cuisine":"Italian","difficulty":"easy"}

difficulty must be exactly: "easy", "medium", or "hard"${personalityContext}${profileContext}${expiryContext}${leftoverContext}${strictContext}${teachContext}${prepTimeContext}${budgetContext}${dateNightContext}${impressMeContext}${cookingMethodContext}${exhaustedContext}${proteinMaxContext}${restaurantContext}${spiceContext}`,
    messages: [{
      role: 'user',
      content: impressMe
        ? 'Impress me with 4 creative recipes. Choose the ingredients yourself.'
        : `I have these ingredients: ${ingredients.join(', ')}. ${cuisineStr} ${sessionDietaryStr} Suggest 4 recipes.`,
    }],
    onFinish: ({ usage }) => {
      logAICall({
        feature: "recipe-generation",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        userId: session.user.id,
      })
    },
  })

  // Frontend reads raw text chunks (newline-delimited JSON), not SSE data: events
  return result.toTextStreamResponse({
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  })
}

// F74: shared between generate and cook routes — map dropdown value to system-prompt injection
// Not exported — Next.js route files only permit HTTP verb exports. The cook route keeps its own copy.
function buildCookingMethodContext(method: unknown): string {
  if (typeof method !== 'string' || !method || method === 'any') return ''
  switch (method) {
    case 'Sheet Pan':
      return `\n\nSHEET PAN: All ingredients should cook on a single sheet pan in the oven. No separate pots or pans.`
    case 'One-Pot':
      return `\n\nONE-POT: All cooking must happen in a single pot/pan for minimal cleanup.`
    case 'Air Fryer':
      return `\n\nAIR FRYER: Recipe must be cookable entirely in a standard air fryer. No stovetop or oven.`
    case 'Slow Cooker':
      return `\n\nSLOW COOKER: Recipe must work in a slow cooker / Crock-Pot. Dump-and-wait style.`
    case 'Instant Pot':
      return `\n\nINSTANT POT: Recipe must use a pressure cooker / Instant Pot. Include pressure-release timing.`
    case 'Microwave Only':
      return `\n\nMICROWAVE ONLY: All cooking steps must be doable in a standard microwave. No stovetop, no oven.`
    case 'No Stove':
      return `\n\nNO STOVE: Do not use the stovetop or oven — assume they're unavailable. Oven-free, stovetop-free.`
    default:
      return ''
  }
}

// F78: spice level 0..3 — always inject so AI doesn't default to "medium"
function buildSpiceContext(level: unknown): string {
  const n = typeof level === 'number' && Number.isInteger(level) ? level : 0
  const clamped = Math.max(0, Math.min(3, n))
  const label = ['Mild', 'Medium', 'Hot', 'Fire'][clamped]
  return `\n\nSPICE LEVEL: ${label}. Calibrate heat accordingly — use appropriate chiles, peppers, and spices. Do not exceed this level.`
}
