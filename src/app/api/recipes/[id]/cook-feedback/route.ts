import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateText } from 'ai'
import { brokerModel } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import * as Sentry from '@sentry/nextjs'

export const maxDuration = 30

const VALID_OUTCOMES = new Set(['great', 'okay', 'failed'])

interface RecipeDataShape {
  title?: string
  ingredients?: Array<{ name: string; amount: string; unit: string }>
  steps?: string[]
}

// F88: POST /api/recipes/[id]/cook-feedback — persist the post-cook outcome/note
// on the RecipeCompletion the /cook route just created, then ask the AI for a
// short "next time..." tip grounded in the recipe and what the user reported.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await req.json().catch(() => null)
  const completionId = typeof body?.completionId === 'string' ? body.completionId : null
  const outcome = typeof body?.outcome === 'string' ? body.outcome : null
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : ''

  if (!completionId || !outcome || !VALID_OUTCOMES.has(outcome)) {
    return NextResponse.json({ error: 'completionId and a valid outcome are required' }, { status: 400 })
  }

  // IDOR guard: never trust the caller's completionId on its own — a completion
  // row belonging to another user (or another recipe) must 404, not 200. Both
  // userId and recipeId come from the session/URL, never from the request body.
  const completion = await prisma.recipeCompletion.findFirst({
    where: { id: completionId, userId: session.user.id, recipeId: id },
  })
  if (!completion) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Persist outcome/note unconditionally, before anything AI-related — a user
  // answering the prompt must never lose their answer to an AI hiccup below.
  await prisma.recipeCompletion.update({
    where: { id: completionId },
    data: { outcome, note: note || null },
  })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) {
    // Rate-limited: the feedback is already saved, just skip the tip honestly.
    return NextResponse.json({ outcome, note: note || null, aiTip: null })
  }

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    const mockTip = 'Next time, let the pan get fully hot before adding the protein — it sears instead of steaming.'
    await prisma.recipeCompletion.update({ where: { id: completionId }, data: { aiTip: mockTip } })
    return NextResponse.json({ outcome, note: note || null, aiTip: mockTip })
  }

  const laneConfigured = Boolean(process.env.AI_BROKER_URL || process.env.CEREBRAS_API_KEY || process.env.GROQ_API_KEY)
  if (!laneConfigured) {
    // No AI lane available — still a success from the user's point of view.
    return NextResponse.json({ outcome, note: note || null, aiTip: null })
  }

  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
    select: { title: true, recipeData: true },
  })
  if (!recipe) {
    // Completion was already validated against this recipeId, so this is
    // effectively unreachable — but fail safe rather than crash on a null deref.
    return NextResponse.json({ outcome, note: note || null, aiTip: null })
  }

  const recipeData = recipe.recipeData as RecipeDataShape
  const ingredientList = recipeData.ingredients
    ?.map((i) => `${i.amount} ${i.unit} ${i.name}`.trim())
    .join(', ')

  const outcomeLine =
    outcome === 'great'
      ? 'The user said it turned out great.'
      : outcome === 'okay'
        ? 'The user said it was okay, not great.'
        : 'The user said it failed / didn\'t work out.'

  try {
    const { text } = await generateText({
      model: brokerModel({ feature: 'cook-feedback-tip', priority: 'interactive' }),
      maxOutputTokens: 150,
      system: `You are a friendly, concise cooking coach. Given how a home cook's attempt at a recipe went, give ONE short, concrete "next time" tip (1-2 sentences max) that would plausibly improve the result. Be specific to the recipe and their note, not generic. Respond with the tip text only — no preamble, no quotes, no markdown.`,
      messages: [{
        role: 'user',
        content: `Recipe: "${recipeData.title || recipe.title}"${ingredientList ? `\nIngredients: ${ingredientList}` : ''}

${outcomeLine}${note ? `\nTheir note: "${note}"` : ''}

Give one short, concrete tip for next time.`,
      }],
    })

    const aiTip = text.trim().slice(0, 500) || null
    if (aiTip) {
      await prisma.recipeCompletion.update({ where: { id: completionId }, data: { aiTip } })
    }
    return NextResponse.json({ outcome, note: note || null, aiTip })
  } catch (err) {
    // Never fabricate a tip. The outcome/note are already durably saved above —
    // an AI failure here degrades the feature, it doesn't fail the request.
    console.error('cook-feedback tip generation failed:', err)
    Sentry.captureException(err)
    return NextResponse.json({ outcome, note: note || null, aiTip: null })
  }
}
