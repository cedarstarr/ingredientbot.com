import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { logAICall } from './ai-log'

export const claudeSonnet = anthropic('claude-sonnet-4-6')
export const claudeHaiku = anthropic('claude-haiku-4-5-20251001')

export const geminiFlashLite = google('gemini-2.5-flash-lite')
export const geminiFlash = google('gemini-2.5-flash')

// When switching any call to `geminiFlash`, also pass:
//   providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } }
// Flash has thinking mode ON by default — without this, hidden reasoning
// tokens can 2-6× the output cost. Flash-lite has no thinking mode, so
// the option is a no-op there.

type Provider = 'anthropic' | 'google'
type ModelCtx = { feature: string; userId?: string | null }

function loggingMiddleware(provider: Provider, modelId: string, ctx: ModelCtx): LanguageModelMiddleware {
  return {
    specificationVersion: 'v3',
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate()
      logAICall({
        feature: ctx.feature, provider, model: modelId,
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
                feature: ctx.feature, provider, model: modelId,
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

export function trackedModel(provider: Provider, modelId: string, ctx: ModelCtx) {
  const base = provider === 'anthropic' ? anthropic(modelId) : google(modelId)
  return wrapLanguageModel({ model: base, middleware: loggingMiddleware(provider, modelId, ctx) })
}
