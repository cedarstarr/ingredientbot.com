import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateObject, NoObjectGeneratedError } from 'ai'
import { z } from 'zod'
import { brokerModel } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'

export const maxDuration = 60

const MIN_RECIPES = 2
const MAX_RECIPES = 3

// F90: one ordered step per timeline entry. A required array, not z.record —
// z.record breaks structured output on the broker's gpt-oss-120b model.
const timelineStepSchema = z.object({
  minuteOffset: z.number().describe('Minutes from the start of cooking when this step begins (0-based).'),
  recipeId: z.string().describe('Must exactly match one of the given recipe ids.'),
  recipeTitle: z.string(),
  instruction: z.string(),
})
const timelineSchema = z.object({
  steps: z.array(timelineStepSchema),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
    const { success } = await aiLimiter.check(ip)
    if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const body = await req.json().catch(() => null)
    const rawIds = body?.recipeIds
    const recipeIds: string[] = Array.isArray(rawIds)
      ? [...new Set(rawIds.filter((id): id is string => typeof id === 'string'))]
      : []

    if (recipeIds.length < MIN_RECIPES || recipeIds.length > MAX_RECIPES) {
      return NextResponse.json(
        { error: `Select ${MIN_RECIPES}-${MAX_RECIPES} recipes to orchestrate` },
        { status: 400 },
      )
    }

    // Single query, no N+1 — scoped to the caller's own recipes, which doubles as
    // the ownership check: any id belonging to another user simply isn't returned,
    // and the count mismatch below catches it.
    const recipes = await prisma.recipe.findMany({
      where: { id: { in: recipeIds }, userId: session.user.id },
      select: { id: true, title: true, servings: true, prepTimeMin: true, cookTimeMin: true, recipeData: true },
    })

    if (recipes.length !== recipeIds.length) {
      return NextResponse.json({ error: 'One or more recipes were not found' }, { status: 404 })
    }

    if (process.env.PLAYWRIGHT_TEST === 'true') {
      const mockSteps = recipes
        .flatMap((r, i) => [
          { minuteOffset: i * 5, recipeId: r.id, recipeTitle: r.title, instruction: `Start prepping ${r.title}.` },
          { minuteOffset: i * 5 + 15, recipeId: r.id, recipeTitle: r.title, instruction: `${r.title} goes on the heat.` },
        ])
        .sort((a, b) => a.minuteOffset - b.minuteOffset)
      return NextResponse.json({ steps: mockSteps })
    }

    const laneConfigured = Boolean(
      process.env.AI_BROKER_URL || process.env.CEREBRAS_API_KEY || process.env.GROQ_API_KEY,
    )
    if (!laneConfigured) {
      return NextResponse.json({ error: "couldn't build a timeline just now" }, { status: 503 })
    }

    const validIds = new Set(recipes.map((r) => r.id))
    const recipeSummaries = recipes
      .map((r) => {
        const data = r.recipeData as unknown as { steps?: string[] } | null
        const steps = Array.isArray(data?.steps) ? data.steps : []
        return [
          `Recipe "${r.title}" (id: "${r.id}") — serves ${r.servings ?? '?'}, prep ${r.prepTimeMin ?? '?'}min / cook ${r.cookTimeMin ?? '?'}min:`,
          steps.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(no steps recorded)',
        ].join('\n')
      })
      .join('\n\n')

    try {
      const result = await generateObject({
        model: brokerModel({ feature: 'meal-plan-orchestrate', priority: 'interactive' }),
        maxOutputTokens: 2048,
        schema: timelineSchema,
        system: `You are a kitchen timing coordinator. Given ${recipes.length} recipes being cooked together for one meal, interleave their steps into ONE ordered cooking timeline so everything finishes around the same time.

Each timeline entry needs:
- minuteOffset: minutes from when cooking starts (0-based, integers)
- recipeId: must exactly match one of the given recipe ids, verbatim
- recipeTitle: the recipe's title
- instruction: the step itself, written so it's clear on its own without the original recipe in front of you

Use passive time (oven, simmering, resting, marinating) in one recipe as the window to work on active steps of another. Order the output array by minuteOffset ascending.`,
        messages: [{ role: 'user', content: recipeSummaries }],
      })

      // Defensive filter: drop any hallucinated recipeId that doesn't match what
      // was actually sent, then re-sort in case the model didn't order strictly.
      const steps = result.object.steps
        .filter((s) => validIds.has(s.recipeId))
        .sort((a, b) => a.minuteOffset - b.minuteOffset)

      if (steps.length === 0) {
        return NextResponse.json({ error: "couldn't build a timeline just now" }, { status: 503 })
      }

      return NextResponse.json({ steps })
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        console.error('meal-plan orchestrate: model output failed schema validation', {
          finishReason: err.finishReason,
          rawText: err.text,
        })
      } else {
        console.error('meal-plan orchestrate failed:', err)
      }
      return NextResponse.json({ error: "couldn't build a timeline just now" }, { status: 503 })
    }
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
