import { google } from '@ai-sdk/google'
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { logAICall } from './ai-log'

export const geminiFlashLite = google('gemini-2.5-flash-lite')

// Portfolio standard: Gemini Flash Lite only. Claude Sonnet/Haiku and
// Gemini Flash were removed 2026-05-16 — Flash has thinking mode on by
// default (2-6× output cost) and no recipe route needed a larger model.

type Provider = 'google'
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
  return wrapLanguageModel({ model: google(modelId), middleware: loggingMiddleware(provider, modelId, ctx) })
}
