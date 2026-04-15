import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateText } from 'ai'
import { claudeSonnet } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { Difficulty } from '@prisma/client'

export const maxDuration = 60

const FREE_TIER_LIMIT = 5

function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return Response.json({ error: 'Too many requests' }, { status: 429 })

  const body = await req.json()
  const { url, save } = body as { url?: string; save?: boolean; recipeData?: Record<string, unknown> }

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    // Save mode: skip DB write and return a mock id
    if (save && body.recipeData) {
      return Response.json({ id: 'test-mock-id' })
    }
    // Extract mode: return a mock recipe structure
    return Response.json({
      recipe: {
        title: 'Classic Spaghetti Carbonara',
        description: 'A rich Italian pasta dish.',
        servings: 4,
        prepTimeMin: 15,
        cookTimeMin: 20,
        cuisine: 'Italian',
        difficulty: 'easy',
        ingredients: [
          { name: 'Spaghetti', amount: '400', unit: 'g' },
          { name: 'Eggs', amount: '4', unit: '' },
          { name: 'Pecorino Romano', amount: '100', unit: 'g' },
          { name: 'Guanciale', amount: '150', unit: 'g' },
        ],
        steps: ['Boil pasta', 'Fry guanciale until crispy', 'Mix eggs and cheese', 'Combine off heat'],
        notes: 'Remove from heat before adding egg mixture to avoid scrambling.',
        nutrition: { calories: 620, protein: 32, fat: 24, carbs: 68, fiber: 3 },
        dietaryTags: [],
        sourceUrl: url ?? '',
      },
    })
  }

  // Save mode: persist a previously extracted recipe
  if (save && body.recipeData) {
    // F30: Apply the same freemium gate as recipe generation — imports count toward the monthly limit
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
        return Response.json({ error: 'limit_reached', limit: FREE_TIER_LIMIT }, { status: 402 })
      }
    }

    const rd = body.recipeData as {
      title: string
      description?: string
      servings?: number
      prepTimeMin?: number
      cookTimeMin?: number
      cuisine?: string
      difficulty?: string
      ingredients?: { name: string; amount: string; unit: string }[]
      steps?: string[]
      notes?: string
      nutrition?: { calories: number; protein: number; fat: number; carbs: number; fiber: number }
      dietaryTags?: string[]
    }

    const rawText = [
      `# ${rd.title}`,
      rd.description ? `\n${rd.description}` : '',
      `\n## Ingredients`,
      (rd.ingredients ?? []).map((i) => `- ${i.amount} ${i.unit} ${i.name}`).join('\n'),
      `\n## Instructions`,
      (rd.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n'),
      rd.notes ? `\n## Notes\n${rd.notes}` : '',
    ].join('\n')

    const monthStart = startOfCurrentMonth()
    const needsReset = !user.monthlyResetDate || user.monthlyResetDate < monthStart

    const [recipe] = await prisma.$transaction([
      prisma.recipe.create({
        data: {
          userId: session.user.id,
          title: rd.title,
          description: rd.description ?? null,
          servings: rd.servings ?? 4,
          prepTimeMin: rd.prepTimeMin ?? null,
          cookTimeMin: rd.cookTimeMin ?? null,
          cuisine: rd.cuisine ?? null,
          difficulty: (rd.difficulty ?? null) as Difficulty | null,
          sourceIngredients: (rd.ingredients ?? []).map((i) => i.name),
          recipeData: JSON.parse(JSON.stringify(rd)),
          rawText,
          nutrition: rd.nutrition ?? undefined,
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

  // Extract mode: fetch URL and extract recipe via Claude
  if (!url || !isValidUrl(url)) {
    return Response.json({ error: 'Please provide a valid URL' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'AI service not configured' }, { status: 503 })
  }

  // Fetch the recipe page HTML
  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const status = res.status
      if (status === 403 || status === 401) {
        return Response.json({ error: 'This site requires a login or subscription. Try a different URL.' }, { status: 422 })
      }
      return Response.json({ error: `Could not fetch page (HTTP ${status})` }, { status: 422 })
    }

    html = await res.text()
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'The page took too long to load. Try a different URL.'
      : 'Could not fetch the URL. Check that it is accessible.'
    return Response.json({ error: message }, { status: 422 })
  }

  // Truncate excessively large pages to avoid token limits
  const maxChars = 80_000
  const truncatedHtml = html.length > maxChars ? html.slice(0, maxChars) : html

  const { text } = await generateText({
    model: claudeSonnet,
    maxOutputTokens: 2048,
    system: `You are a recipe extraction expert. Given the HTML content of a recipe webpage, extract the recipe into structured JSON. Return ONLY valid JSON with no markdown, no code blocks, no extra text.

If the page does not contain a recognizable recipe, return: {"error": "No recipe found on this page"}

Schema:
{
  "title": string,
  "description": string,
  "servings": number,
  "prepTimeMin": number,
  "cookTimeMin": number,
  "cuisine": string (best guess, e.g. "Italian", "American", "Asian"),
  "difficulty": "easy" | "medium" | "hard" (estimate based on steps/techniques),
  "ingredients": [{"name": string, "amount": string, "unit": string}],
  "steps": [string],
  "notes": string (optional tips from the recipe author),
  "nutrition": {"calories": number, "protein": number, "fat": number, "carbs": number, "fiber": number} (estimate per serving if not provided),
  "dietaryTags": [string] (e.g. "vegetarian", "gluten-free", "dairy-free" — only include if clearly applicable),
  "sourceUrl": string
}

Rules:
- Extract ALL ingredients with precise amounts. If an ingredient has no amount, use "" for amount and "" for unit.
- Each step should be a clear, self-contained instruction.
- If prep/cook times are not stated, estimate them based on the recipe complexity.
- If nutrition info is not provided, estimate it reasonably.
- If servings are not stated, estimate based on ingredient quantities.`,
    messages: [{
      role: 'user',
      content: `Extract the recipe from this webpage. Source URL: ${url}\n\n${truncatedHtml}`,
    }],
  })

  try {
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? JSON.parse(match[0]) : null
    if (!parsed) throw new Error('No JSON found')

    if (parsed.error) {
      return Response.json({ error: parsed.error }, { status: 422 })
    }

    // Ensure sourceUrl is set
    parsed.sourceUrl = url

    return Response.json({ recipe: parsed })
  } catch {
    return Response.json({ error: 'Failed to parse extracted recipe data' }, { status: 500 })
  }
}
