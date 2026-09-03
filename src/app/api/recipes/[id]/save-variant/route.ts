import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateObject, NoObjectGeneratedError } from 'ai'
import { z } from 'zod'
import { trackedStructuredModel } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { Difficulty } from '@/generated/prisma/client'
import { startOfCurrentMonth } from '@/lib/date-utils'
import { isOverFreeLimit, FREE_TIER_MONTHLY_RECIPES } from '@/lib/limits'

export const maxDuration = 60


interface RecipeIngredient {
  name: string
  amount: string
  unit: string
}

interface StructuredRecipe {
  title: string
  description?: string | null
  servings?: number | null
  prepTimeMin?: number | null
  cookTimeMin?: number | null
  cuisine?: string | null
  difficulty?: string | null
  ingredients: RecipeIngredient[]
  steps: string[]
  notes?: string | null
  nutrition?: { calories: number; protein: number; fat: number; carbs: number; fiber: number } | null
}

// FOU-297 root cause: this branch used to be generateText + a `text.match(/\{[\s\S]*\}/)`
// regex + JSON.parse, trusting a system-prompt instruction ("return ONLY valid JSON") to
// hold. dietaryModel/trackedModel always resolve to the free broker gpt-oss-120b lane
// (the 'google'/gemini-2.5-flash-lite args are logging labels only — see src/lib/ai.ts),
// which is far less reliable than the label suggests at following that instruction on a
// large, deeply-nested schema: it would wrap the JSON in prose or trail off mid-object on
// a long modified recipe, and the regex/JSON.parse pair had no way to tell "truncated" from
// "malformed" apart from failing. generateObject forces JSON-mode at the request layer
// (response_format: json_object, see @ai-sdk/openai-compatible) instead of hoping the model
// complies, and NoObjectGeneratedError below reports the raw text so a failure is diagnosable.
const structuredRecipeSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  servings: z.number().nullable().optional(),
  prepTimeMin: z.number().nullable().optional(),
  cookTimeMin: z.number().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  ingredients: z.array(z.object({ name: z.string(), amount: z.string(), unit: z.string() })),
  steps: z.array(z.string()),
  notes: z.string().nullable().optional(),
  nutrition: z
    .object({ calories: z.number(), protein: z.number(), fat: z.number(), carbs: z.number(), fiber: z.number() })
    .nullable()
    .optional(),
})

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
  try {
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
    if (isOverFreeLimit(user.isPro, currentCount)) {
      return Response.json({ error: 'limit_reached', limit: FREE_TIER_MONTHLY_RECIPES }, { status: 402 })
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
      // This call routes to the shared broker's free gpt-oss-120b lane, not Anthropic (see
      // dietaryModel/trackedModel in src/lib/ai.ts) — gating on ANTHROPIC_API_KEY here checked
      // a key this path never uses, the same stale-guard trap already fixed in the sibling
      // /modify route (FOU-297).
      const laneConfigured = Boolean(process.env.AI_BROKER_URL || process.env.CEREBRAS_API_KEY || process.env.GROQ_API_KEY)
      if (!laneConfigured) {
        return Response.json({ error: 'AI service not configured' }, { status: 503 })
      }
      try {
        const aiResult = await generateObject({
          // FOU-424: generateObject carries a schema, so this must use the broker's
          // structured lane, not the free-text lane trackedModel routes to.
          model: trackedStructuredModel({ feature: 'recipe-save-variant', userId: session.user.id }),
          maxOutputTokens: 4096,
          schema: structuredRecipeSchema,
          system: `You convert a modified recipe written in prose/markdown into structured JSON.
Preserve every ingredient and step from the modified recipe exactly. If a field is unknown, infer a sensible value.`,
          messages: [{ role: 'user', content: `Original recipe title: "${source.title}".\n\nModified recipe to structure:\n${modifiedText}` }],
        })
        structured = aiResult.object
      } catch (err) {
        // FOU-297 acceptance: log the raw model output on parse failure so future failures
        // are diagnosable instead of guessed. NoObjectGeneratedError carries the text that
        // failed schema validation (prose-wrapped or truncated JSON); anything else (network,
        // broker exhausted retries, etc.) is logged as-is. Server-side only — never sent to the client.
        if (NoObjectGeneratedError.isInstance(err)) {
          console.error('save-variant modify structuring: model output failed schema validation', {
            finishReason: err.finishReason,
            rawText: err.text,
          })
        } else {
          console.error('save-variant modify structuring failed:', err)
        }
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
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
