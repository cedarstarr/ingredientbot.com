import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamText } from 'ai'
import { brokerModel } from '@/lib/ai'
import { aiLimiter, clientIp } from '@/lib/rate-limit'

// F89: Voice sous-chef — hands-free Q&A while the user is mid-recipe in cooking mode.
// interactive priority (15s broker fail-fast) keeps this within maxDuration comfortably.
export const maxDuration = 30

function errorKind(err: unknown): 'rate-limited' | 'stream-error' {
  const status =
    err && typeof err === 'object'
      ? ((err as { statusCode?: number; status?: number }).statusCode ??
        (err as { statusCode?: number; status?: number }).status)
      : undefined
  return status === 429 ? 'rate-limited' : 'stream-error'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })

    const ip = clientIp(req)
    const { success } = await aiLimiter.check(ip)
    if (!success) return new Response('Too many requests', { status: 429 })

    // id comes from the URL segment only — the recipe body/question can never
    // substitute a different id for authorization (an id in the JSON body is
    // never trusted for ownership).
    const { id } = await params
    const recipe = await prisma.recipe.findFirst({
      where: { id, userId: session.user.id },
      // Exclude rawText (db.Text) — the sous-chef only needs steps/ingredients context.
      select: { id: true, title: true, recipeData: true, sourceIngredients: true },
    })
    if (!recipe) return new Response('Not found', { status: 404 })

    const body = await req.json().catch(() => null)
    const question = typeof body?.question === 'string' ? body.question.trim().slice(0, 500) : ''
    const currentStepIndex = Number.isInteger(body?.currentStepIndex) ? body.currentStepIndex : 0
    if (!question) return new Response('Question is required', { status: 400 })

    if (process.env.PLAYWRIGHT_TEST === 'true') {
      const encoder = new TextEncoder()
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: 'Mock sous-chef answer for testing.' })}\n\n`)
          )
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(mockStream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      })
    }

    const laneConfigured = Boolean(process.env.AI_BROKER_URL || process.env.CEREBRAS_API_KEY || process.env.GROQ_API_KEY)
    if (!laneConfigured) {
      return new Response('AI service not configured', { status: 503 })
    }

    const recipeData = recipe.recipeData as {
      title?: string
      ingredients?: unknown
      steps?: string[]
    }
    const steps = Array.isArray(recipeData.steps) ? recipeData.steps : []
    const currentStepText = steps[currentStepIndex] ?? null

    // gpt-oss-120b is weaker than a frontier model at cooking judgment (accepted for
    // v1) — the system prompt leans hard on "don't invent" because a fabricated
    // instruction here (e.g. a wrong internal temp) is a food-safety failure, not a
    // quality miss. role:'system' is passed as the top-level param, never inside
    // messages[] — AI SDK v7 rejects role:'system' in messages[] at runtime.
    const systemPrompt = `You are a calm sous-chef answering a hands-free spoken question from someone actively cooking — greasy hands, phone propped up, glancing not reading.

Recipe: ${recipeData.title || recipe.title}
Full ingredient list: ${JSON.stringify(recipeData.ingredients ?? recipe.sourceIngredients ?? [])}
Full steps: ${JSON.stringify(steps)}

They are currently on step ${currentStepIndex + 1} of ${steps.length || '?'}: "${currentStepText ?? '(step text unavailable)'}"

Answer only using the recipe above and ordinary, well-established food-safety practice. Never invent an ingredient, quantity, temperature, or instruction that isn't in the recipe or isn't standard safe kitchen knowledge — a wrong answer here (e.g. undercooked poultry) is a safety failure, not a quality miss. If you don't know or the recipe doesn't say, say so plainly instead of guessing. Reference their current step when relevant. Keep the answer to 2-3 short sentences — it will be read aloud.`

    const result = streamText({
      model: brokerModel({ feature: 'sous-chef', priority: 'interactive' }),
      maxOutputTokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let sawText = false
          for await (const chunk of result.textStream) {
            if (chunk) sawText = true
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
          }
          // An empty completion is still a failure to answer — never let the sheet
          // sit there silently implying success.
          if (!sawText) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'empty' })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorKind(err) })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    if ((err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT')) throw err
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
