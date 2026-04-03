import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { aiLimiter } from '@/lib/rate-limit'

export const maxDuration = 60

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

  // Save mode: persist a previously extracted recipe
  if (save && body.recipeData) {
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

    const recipe = await prisma.recipe.create({
      data: {
        userId: session.user.id,
        title: rd.title,
        description: rd.description ?? null,
        servings: rd.servings ?? 4,
        prepTimeMin: rd.prepTimeMin ?? null,
        cookTimeMin: rd.cookTimeMin ?? null,
        cuisine: rd.cuisine ?? null,
        difficulty: rd.difficulty ?? null,
        sourceIngredients: (rd.ingredients ?? []).map((i) => i.name),
        recipeData: JSON.parse(JSON.stringify(rd)),
        rawText,
        nutrition: rd.nutrition ?? undefined,
      },
    })

    return Response.json({ id: recipe.id })
  }

  // Extract mode: fetch URL and extract recipe via Claude
  if (!url || !isValidUrl(url)) {
    return Response.json({ error: 'Please provide a valid URL' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
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

  const anthropic = new Anthropic({ apiKey })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
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
      content: `Extract the recipe from this webpage. Source URL: ${url}\n\n${truncatedHtml}`
    }]
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    return Response.json({ error: 'Failed to extract recipe' }, { status: 500 })
  }

  try {
    const match = content.text.match(/\{[\s\S]*\}/)
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
