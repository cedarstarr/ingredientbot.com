import { cerebras } from '@ai-sdk/cerebras'
import { google } from '@ai-sdk/google'
import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai'
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { logAICall } from './ai-log'

// Vision side-path: gpt-oss-120b is text-only, so the photo-analysis route
// keeps Gemini Flash Lite for image inputs. Don't use for text-only calls.
// Unaffected by the broker — Google has its own per-site quota.
export const geminiFlashVision = google('gemini-2.5-flash-lite')

// Portfolio AI standard (2026-08-01): the free-tier text lane goes through the
// shared AI broker, which owns the Cerebras/Groq keys and schedules every site's
// traffic against the ONE free-tier budget they all share. Before it, each site
// fell back Cerebras -> Groq blind to what the other ten were spending, so two
// crons landing on the same minute was a silent 429 for whoever lost.
const CANONICAL_MODEL = 'gpt-oss-120b'

// Kept for the direct-to-provider fallback below, not for normal traffic.
const DIRECT_MODEL = 'gpt-oss-120b'

export type AiPriority = 'interactive' | 'batch'

export interface AiContext {
  /** Feature slug — shows up in the broker ledger for per-feature cost attribution. */
  feature: string
  /** `interactive` when a user is waiting on the response; batch work must not preempt it. */
  priority?: AiPriority
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const e = err as { statusCode?: number; status?: number }
    return e.statusCode ?? e.status
  }
  return undefined
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * True only when the broker itself is unreachable or broken — never for a 429 it
 * relayed. Bypassing a relayed 429 would re-create exactly the uncoordinated
 * collisions the broker exists to prevent; going direct when the broker is *down*
 * just restores the old behaviour, so the worst case is the status quo.
 */
function brokerIsDown(err: unknown): boolean {
  const status = statusOf(err)
  if (status === undefined) return true // network/DNS/timeout — no HTTP response at all
  return status === 502 || status === 503 || status === 504
}

function brokerMiddleware(ctx: AiContext): LanguageModelMiddleware {
  return {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate()
      } catch (err) {
        if (!brokerIsDown(err)) throw err
        console.warn(`[ai] broker unreachable (${describe(err)}); direct Cerebras fallback for ${ctx.feature}`)
        return await cerebras(DIRECT_MODEL).doGenerate(params)
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream()
      } catch (err) {
        if (!brokerIsDown(err)) throw err
        console.warn(`[ai] broker unreachable (${describe(err)}); direct Cerebras stream fallback for ${ctx.feature}`)
        return await cerebras(DIRECT_MODEL).doStream(params)
      }
    },
  }
}

/**
 * A model that routes through the broker, tagged so its spend is attributable.
 *
 * Priority defaults to `interactive`: almost every caller here is a user-facing
 * recipe route, and an untagged user request must fail fast rather than sit in a
 * batch queue for minutes. Cron/batch callers pass `priority: 'batch'` explicitly.
 */
/**
 * The broker exposes a *lane* through the model id. `gpt-oss-120b` is a
 * permanent alias for the free-text lane, which its own description scopes to
 * "prose generation with no schema" and which is served by the shared
 * gpt-oss-120b pool.
 *
 * Schema-bearing `generateObject` calls therefore belong on a structured lane,
 * not free-text. Sending them to free-text worked only for as long as Cerebras
 * happened to tolerate it: when it went down and the same calls rerouted to
 * Groq, the schema never reached the model and generateObject failed
 * validation on arrival — a completely different, well-formed JSON shape came
 * back instead. See FOU-424.
 */
const STRUCTURED_LANE = 'structured-extraction'

export function brokerModel(ctx: AiContext, lane: string = CANONICAL_MODEL) {
  const provider = createOpenAICompatible({
    name: 'ai-broker',
    baseURL: process.env.AI_BROKER_URL ?? '',
    apiKey: process.env.AI_BROKER_KEY ?? '',
    headers: {
      'x-feature': ctx.feature,
      'x-priority': ctx.priority ?? 'interactive',
    },
    // Only the structured lanes get real json_schema requests. Without this the
    // SDK falls back to json_object, which sends the *word* JSON but not the
    // schema — the model then answers with well-formed JSON of entirely its own
    // shape, and generateObject fails validation on arrival. Free-text stays
    // false: its gpt-oss-120b pool is not schema-capable and, by design, never
    // carries a schema.
    supportsStructuredOutputs: lane !== CANONICAL_MODEL,
  })
  return wrapLanguageModel({
    model: provider.chatModel(lane),
    middleware: brokerMiddleware(ctx),
  })
}

// Accept legacy 'google' for backward compat; the free text lane is the broker.
type Provider = 'cerebras' | 'groq' | 'google' | 'anthropic' | 'ai-broker'
type ModelCtx = { feature: string; userId?: string | null; priority?: AiPriority }

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

// Signature preserved for backward compat — the provider/modelId arguments have
// always been logging labels only, and are now ignored for logging too: the call
// goes to the broker, so recording anything else would misattribute the spend.
export function trackedModel(_provider: Provider, _modelId: string, ctx: ModelCtx) {
  return wrapLanguageModel({
    model: brokerModel({ feature: ctx.feature, priority: ctx.priority ?? 'interactive' }),
    middleware: loggingMiddleware('ai-broker', CANONICAL_MODEL, ctx),
  })
}

/**
 * Structured-output sibling of `trackedModel` — same logging and attribution,
 * routed to the broker's structured lane so a schema is actually honoured.
 * Every `generateObject` call must use this, not `trackedModel`/`brokerModel`
 * on the default lane; schemaless `generateText` calls stay on `trackedModel`.
 * See FOU-424.
 */
export function trackedStructuredModel(ctx: ModelCtx) {
  return wrapLanguageModel({
    model: brokerModel({ feature: ctx.feature, priority: ctx.priority ?? 'interactive' }, STRUCTURED_LANE),
    middleware: loggingMiddleware('ai-broker', STRUCTURED_LANE, ctx),
  })
}

// ---------------------------------------------------------------------------
// Allergen safety path
//
// A wrong allergen answer is a safety failure, not a quality failure, so these
// calls never touch the free tier: no Cerebras, no Groq, no broker, no silent
// downgrade. The broker schedules a shared free-tier budget and can queue or
// shed load — acceptable for tagging a recipe, not for telling someone with a
// nut allergy what is safe to eat. This lane stays direct to Anthropic.
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
    : trackedModel('ai-broker', CANONICAL_MODEL, ctx)
}
