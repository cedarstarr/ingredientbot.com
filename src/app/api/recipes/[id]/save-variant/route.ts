import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateText } from 'ai'
import { trackedModel } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { Difficulty } from '@prisma/client'
import { startOfCurrentMonth } from '@/lib/date-utils'

export const maxDuration = 60

const FREE_TIER_LIMIT = 5

interface RecipeIngredient {
  name: string
  amount: string
  unit: string
}

interface StructuredRecipe {
  title: string
  description?: string
  servings?: number
  prepTimeMin?: number
  cookTimeMin?: number
  cuisine?: string
  difficulty?: string
  ingredients: RecipeIngredient[]
  steps: string[]
  notes?: string
  nutrition?: { calories: number; protein: number; fat: number; carbs: number; fiber: number }
}

// Build the markdown rawText mirror used by the modify route as AI re-feed context (same shape as /cook).
function buildRawText(r: StructuredRecipe): string {
  return [
    `# ${r.title}`,
    `\n${r.description ?? ''}`,
    `\n## Ingredients`,
    (r.ingredients ?? []).map((i) => `- ${i.amount} ${i.unit} ${i.name}`.replace(/\s+/g, ' ').trim()).join('\n'),
    `\n## Instructions`,
    (r.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n'),
    r.notes ? `\n## Notes\n${r.notes}` : '',
  ].join('\n')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { id } = await params
  const body = await req.json()
  const kind: 'modification' | 'substitution' = body.kind

  // Load the source recipe — needed for sourceIngredients, base structure, and ownership check.
  const source = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: {
      title: true, servings: true, cuisine: true, difficulty: true,
      recipeData: true, sourceIngredients: true, nutrition: true,
    },
  })
  if (!source) return Response.json({ error: 'Recipe not found' }, { status: 404 })

  // Free-tier gate — a saved variant creates a new Recipe, so it counts toward the monthly limit
  // exactly like /cook. Without this, modify→save would be an unlimited bypass of the 5/month cap.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true, recipeCount: true, monthlyResetDate: true },
  })
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 })

  const monthStart = startOfCurrentMonth()
  const needsReset = !user.monthlyResetDate || user.monthlyResetDate < monthStart
  if (!user.isPro) {
    const currentCount = needsReset ? 0 : user.recipeCount
    if (currentCount >= FREE_TIER_LIMIT) {
      return Response.json({ error: 'limit_reached', limit: FREE_TIER_LIMIT }, { status: 402 })
    }
  }

  let structured: StructuredRecipe

  if (kind === 'substitution') {
    // Pure data transform — no AI. Apply the user's client-side swaps onto the stored recipe.
    const swaps: Array<{ original: string; name: string; quantity: string }> = body.swaps ?? []
    if (!swaps.length) return Response.json({ error: 'No substitutions to save' }, { status: 400 })

    const base = source.recipeData as unknown as StructuredRecipe
    const swapByOriginal = new Map(swaps.map((s) => [s.original, s]))
    const ingredients = (base.ingredients ?? []).map((ing) => {
      const swap = swapByOriginal.get(ing.name)
      if (!swap) return ing
      return { name: swap.name, amount: swap.quantity, unit: '' }
    })
    structured = { ...base, title: `${source.title} (substituted)`, ingredients }
  } else if (kind === 'modification') {
    // The modify route streams readable markdown, not JSON. Re-structure it into the canonical
    // recipe schema (same one /cook stores) so the saved variant renders on the detail page.
    const modifiedText: string = body.modifiedText ?? ''
    if (!modifiedText.trim()) return Response.json({ error: 'Nothing to save' }, { status: 400 })

    if (process.env.PLAYWRIGHT_TEST === 'true') {
      structured = {
        ...(source.recipeData as unknown as StructuredRecipe),
        title: `${source.title} (modified)`,
      }
    } else {
      if (!process.env.ANTHROPIC_API_KEY) {
        return Response.json({ error: 'AI service not configured' }, { status: 503 })
      }
      let text: string
      try {
        const aiResult = await generateText({
          model: trackedModel('google', 'gemini-2.5-flash-lite', { feature: 'recipe-save-variant', userId: session.user.id }),
          maxOutputTokens: 2048,
          system: `You convert a modified recipe written in prose/markdown into structured JSON. Return ONLY valid JSON, no markdown, no code blocks.
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
}
Preserve every ingredient and step from the modified recipe exactly. If a field is unknown, infer a sensible value.`,
          messages: [{ role: 'user', content: `Original recipe title: "${source.title}".\n\nModified recipe to structure:\n${modifiedText}` }],
        })
        text = aiResult.text
      } catch {
        return Response.json({ error: 'AI service error' }, { status: 500 })
      }
      try {
        const match = text.match(/\{[\s\S]*\}/)
        structured = match ? JSON.parse(match[0]) : null
        if (!structured?.ingredients || !structured?.steps) throw new Error('incomplete')
      } catch {
        return Response.json({ error: 'Failed to structure the modified recipe' }, { status: 500 })
      }
    }
  } else {
    return Response.json({ error: 'Invalid variant kind' }, { status: 400 })
  }

  const rawText = buildRawText(structured)

  const [recipe] = await prisma.$transaction([
    prisma.recipe.create({
      data: {
        userId: session.user.id,
        title: structured.title,
        description: structured.description,
        servings: structured.servings ?? source.servings,
        prepTimeMin: structured.prepTimeMin,
        cookTimeMin: structured.cookTimeMin,
        cuisine: structured.cuisine ?? source.cuisine,
        difficulty: (structured.difficulty as Difficulty | null) ?? source.difficulty,
        sourceIngredients: source.sourceIngredients,
        recipeData: structured as object,
        rawText,
        nutrition: (structured.nutrition as object) ?? (source.nutrition as object) ?? undefined,
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
