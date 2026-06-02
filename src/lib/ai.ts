import { cerebras } from '@ai-sdk/cerebras'
import { groq } from '@ai-sdk/groq'
import { google } from '@ai-sdk/google'
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
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
    specificationVersion: 'v3',
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
type Provider = 'cerebras' | 'groq' | 'google'
type ModelCtx = { feature: string; userId?: string | null }

function loggingMiddleware(_provider: Provider, _modelId: string, ctx: ModelCtx): LanguageModelMiddleware {
  return {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate()
      logAICall({
        feature: ctx.feature,
        provider: 'cerebras',
        model: PRIMARY_MODEL,
        inputTokens: result.usage.inputTokens.total ?? 0,
        outputTokens: result.usage.outputTokens.total ?? 0,
        userId: ctx.userId,
      })
      return result
    },
    wrapStream: async ({ doStream }) => {
      const { stream, ...rest } = await doStream()
      const transformed = stream.pipeThrough(
        new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'finish') {
              logAICall({
                feature: ctx.feature,
                provider: 'cerebras',
                model: PRIMARY_MODEL,
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
