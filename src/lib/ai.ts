import { cerebras } from '@ai-sdk/cerebras'
import { groq } from '@ai-sdk/groq'
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { logAICall } from './ai-log'

// Vision side-path: gpt-oss-120b is text-only, so the photo-analysis route
// keeps Gemini Flash Lite for image inputs. Don't use for text-only calls.
export const geminiFlashVision = google('gemini-2.5-flash-lite')

// Portfolio AI standard (2026-05-22): Cerebras gpt-oss-120b primary,
// Groq openai/gpt-oss-120b fallback on 429/5xx. Both serve the same model.
const PRIMARY_MODEL = 'gpt-oss-120b'
const FALLBACK_MODEL = 'openai/gpt-oss-120b'

function isRetryable(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { status?: number; statusCode?: number }
    const status = e.status ?? e.statusCode
    if (typeof status === 'number') return status === 429 || (status >= 500 && status < 600)
  }
  return true
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function fallbackMiddleware(): LanguageModelMiddleware {
  return {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate, params }) => {
      try { return await doGenerate() } catch (err) {
        if (!isRetryable(err)) throw err
        console.warn('[ai] Cerebras failed, falling back to Groq:', describe(err))
        return await groq(FALLBACK_MODEL).doGenerate(params)
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try { return await doStream() } catch (err) {
        if (!isRetryable(err)) throw err
        console.warn('[ai] Cerebras stream failed, falling back to Groq:', describe(err))
        return await groq(FALLBACK_MODEL).doStream(params)
      }
    },
  }
}

// Legacy export name preserved — points at Cerebras.
export const geminiFlashLite = wrapLanguageModel({ model: cerebras(PRIMARY_MODEL), middleware: fallbackMiddleware() })

// Accept legacy 'google' for backward compat; everything routes to Cerebras.
type Provider = 'cerebras' | 'groq' | 'google' | 'anthropic'
type ModelCtx = { feature: string; userId?: string | null }

function loggingMiddleware(provider: Provider, modelId: string, ctx: ModelCtx): LanguageModelMiddleware {
  return {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate()
      logAICall({
        feature: ctx.feature,
        provider,
        model: modelId,
        inputTokens: result.usage.inputTokens.total ?? 0,
        outputTokens: result.usage.outputTokens.total ?? 0,
        userId: ctx.userId,
      })
      return result
    },
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream()
      const transformed = stream.pipeThrough(
        new TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'finish') {
              logAICall({
                feature: ctx.feature,
                provider,
                model: modelId,
                inputTokens: chunk.usage.inputTokens.total ?? 0,
                outputTokens: chunk.usage.outputTokens.total ?? 0,
                userId: ctx.userId,
              })
            }
            controller.enqueue(chunk)
          },
        }),
      )
      return { stream: transformed, ...rest }
    },
  }
}

// Signature preserved for backward compat. Internally always routes to Cerebras + Groq fallback.
export function trackedModel(provider: Provider, modelId: string, ctx: ModelCtx) {
  return wrapLanguageModel({
    model: wrapLanguageModel({ model: cerebras(PRIMARY_MODEL), middleware: fallbackMiddleware() }),
    middleware: loggingMiddleware(provider, modelId, ctx),
  })
}

// ---------------------------------------------------------------------------
// Allergen safety path
//
// A wrong allergen answer is a safety failure, not a quality failure, so these
// calls never touch the free tier: no Cerebras, no Groq, no silent downgrade.
// gpt-oss-120b on a free lane is chosen for throughput and can be swapped or
// degraded without notice — acceptable for tagging a recipe, not for telling
// someone with a nut allergy what is safe to eat.
// ---------------------------------------------------------------------------

const SAFETY_MODEL = 'claude-opus-5'

// Restrictions where being wrong is a medical event rather than a preference.
// 'keto'/'halal'/'paleo' etc. are deliberately absent — they carry no allergen risk.
const ALLERGEN_RESTRICTIONS = new Set([
  'nut-free',
  'peanut-free',
  'tree-nut-free',
  'dairy-free',
  'gluten-free',
  'egg-free',
  'soy-free',
  'shellfish-free',
  'fish-free',
  'sesame-free',
])

/** True when any restriction is allergen-bearing (or a custom entry mentioning an allergy). */
export function hasAllergenRestriction(restrictions: readonly string[] | null | undefined): boolean {
  if (!restrictions?.length) return false
  return restrictions.some((r) => {
    const v = r.trim().toLowerCase()
    return ALLERGEN_RESTRICTIONS.has(v) || v.includes('allerg') || v.includes('celiac')
  })
}

/**
 * Paid frontier model for allergen-bearing calls. Fails closed: if the key is
 * absent we throw rather than fall through to a free lane, because a silent
 * downgrade here is exactly the failure this function exists to prevent.
 */
export function safetyModel(ctx: ModelCtx) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is required for allergen-bearing AI calls and is not set. ' +
        'Refusing to downgrade to a free-tier model — see src/components/allergen-disclaimer.tsx.'
    )
  }
  return wrapLanguageModel({
    model: anthropic(SAFETY_MODEL),
    middleware: loggingMiddleware('anthropic', SAFETY_MODEL, ctx),
  })
}

/**
 * Model selector for any call that applies the user's dietary restrictions.
 * Escalates to the paid model only when an allergen is actually in play, so
 * cost tracks risk rather than traffic.
 */
export function dietaryModel(restrictions: readonly string[] | null | undefined, ctx: ModelCtx) {
  return hasAllergenRestriction(restrictions)
    ? safetyModel(ctx)
    : trackedModel('cerebras', PRIMARY_MODEL, ctx)
}
