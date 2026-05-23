import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateText } from 'ai'
import { geminiFlashVision } from '@/lib/ai'
import { aiLimiter } from '@/lib/rate-limit'
import { getCached, setCached, sha256 } from '@/lib/recipe-cache'
import * as Sentry from '@sentry/nextjs'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

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

  try {
    const formData = await req.formData()
    const photo = formData.get('photo') as File | null
    if (!photo) return Response.json({ error: 'No photo provided' }, { status: 400 })

    if (photo.size > 5 * 1024 * 1024) {
      return Response.json({ error: 'Photo must be under 5MB' }, { status: 400 })
    }

    const arrayBuffer = await photo.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    const base64 = buf.toString('base64')
    // Validate the browser-supplied mime against an allowlist rather than trusting the
    // type assertion — keeps malformed/unsupported uploads from burning a Gemini call.
    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
    type AllowedMime = typeof ALLOWED_MIMES[number]
    const candidate = (photo.type || 'image/jpeg').toLowerCase()
    if (!ALLOWED_MIMES.includes(candidate as AllowedMime)) {
      return Response.json({ error: 'Unsupported image type. Use JPEG, PNG, WEBP, or GIF.' }, { status: 400 })
    }
    const mimeType = candidate as AllowedMime

    // Cache by raw image bytes — identical re-uploads short-circuit the LLM call.
    const inputHash = sha256(buf)
    const cached = await getCached<{ ingredients: string[] }>('photo', inputHash)
    if (cached) return Response.json(cached)

    const { text } = await generateText({
      model: geminiFlashVision,
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
  } catch (error) {
    if (isRedirectError(error)) throw error
    console.error('analyze-photo error:', error)
    Sentry.captureException(error)
    return NextResponse.json({ error: 'Failed to analyze photo' }, { status: 500 })
  }
}
