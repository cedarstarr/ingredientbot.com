import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { streamText } from 'ai'
import { claudeHaiku } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  const { id } = await params
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!recipe) return new Response('Not found', { status: 404 })

  const { message, history } = await req.json()
  if (!message?.trim()) return new Response('Message is required', { status: 400 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('AI service not configured', { status: 503 })
  }

  const recipeData = recipe.recipeData as {
    title?: string
    ingredients?: string[]
    instructions?: string[]
  }

  const systemPrompt = `You are a friendly, knowledgeable cooking coach. The user is currently cooking a specific recipe and might ask about:
- Technique questions (how to properly sear, when to flip, how to know it's done)
- Timing questions (can I prep this ahead of time, how long to rest)
- Ingredient questions (can I substitute X, what does Y do in this recipe)
- Troubleshooting (my sauce is too thick/thin, it looks different than expected)

Current recipe:
Title: ${recipeData.title || recipe.title}
Ingredients: ${JSON.stringify(recipeData.ingredients || recipe.sourceIngredients)}
Instructions: ${JSON.stringify(recipeData.instructions || [])}

Be concise but helpful. Reference specific steps from the recipe when relevant. If you don't know something, say so. Add a practical tip when possible.`

  // Build message history
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  if (Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }
  messages.push({ role: 'user', content: message.trim() })

  const result = streamText({
    model: claudeHaiku,
    maxOutputTokens: 500,
    system: systemPrompt,
    messages,
  })

  // Emit SSE events as `data: {"text": "..."}` to match the original contract
  // chosen over toDataStreamResponse because the existing protocol uses a custom {text} shape + [DONE] sentinel
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          )
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`))
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
}
