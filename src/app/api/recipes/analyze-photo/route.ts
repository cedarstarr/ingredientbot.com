import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { generateText } from 'ai'
import { trackedModel } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { getCached, setCached, sha256 } from '@/lib/recipe-cache'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await aiLimiter.check(ip)
  if (!success) return new Response('Too many requests', { status: 429 })

  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return Response.json({ ingredients: ['eggs', 'cheddar cheese', 'broccoli', 'leftover rice', 'butter', 'garlic'] })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'AI service not configured' }, { status: 503 })
  }

  const formData = await req.formData()
  const photo = formData.get('photo') as File | null
  if (!photo) return Response.json({ error: 'No photo provided' }, { status: 400 })

  if (photo.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'Photo must be under 5MB' }, { status: 400 })
  }

  const arrayBuffer = await photo.arrayBuffer()
  const buf = Buffer.from(arrayBuffer)
  const base64 = buf.toString('base64')
  const mimeType = (photo.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  // Cache by raw image bytes — identical re-uploads short-circuit the LLM call.
  const inputHash = sha256(buf)
  const cached = await getCached<{ ingredients: string[] }>('photo', inputHash)
  if (cached) return Response.json(cached)

  const { text } = await generateText({
    model: trackedModel('google', 'gemini-2.5-flash-lite', { feature: 'photo-analysis', userId: session.user.id }),
    maxOutputTokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', image: base64, mediaType: mimeType },
        {
          type: 'text',
          text: 'Look at this fridge or pantry photo. List every food item and ingredient you can clearly identify. Return ONLY a JSON array of ingredient name strings, no quantities, no explanations, no markdown. Example: ["eggs", "cheddar cheese", "broccoli", "leftover rice"]. Return only the JSON array.',
        },
      ],
    }],
  })

  try {
    const match = text.match(/\[[\s\S]*\]/)
    const ingredients = match ? JSON.parse(match[0]) : []
    const result = { ingredients }
    await setCached('photo', inputHash, result)
    return Response.json(result)
  } catch {
    return Response.json({ ingredients: [] })
  }
}
