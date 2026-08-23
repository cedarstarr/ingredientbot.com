# ingredientbot.com

AI-powered recipe tool. Part of the 14-site portfolio (11 operational + 3 author).

See /home/cedar/Projects/CLAUDE.md for all portfolio-wide rules and standards.

## Site-specific
- Port: 3010 (Playwright)
- Middleware: `src/middleware.ts`
- Core feature: split-panel kitchen page at `/kitchen`

## AI

All AI goes through `@ai-sdk/*` provider packages via `src/lib/ai.ts`. Never import
`@anthropic-ai/sdk` or `openai` directly.

| Lane | Provider | Model | Used by |
|---|---|---|---|
| Primary (text) | Shared AI broker (`AI_BROKER_URL`), direct Groq only if the broker is *down* | `gpt-oss-120b` (broker alias; `openai/gpt-oss-120b` on the direct Groq fallback) | everything not listed below |
| Vision | Google | `gemini-2.5-flash-lite` | `analyze-photo` only — `gpt-oss-120b` is text-only |
| **Allergen safety** | Anthropic | `claude-opus-5` | any call applying an allergen-bearing restriction |

**Allergen calls never run on a free tier.** `dietaryModel(restrictions, ctx)` escalates
to `safetyModel()` when `hasAllergenRestriction()` matches, and `safetyModel()` throws
if `ANTHROPIC_API_KEY` is absent rather than falling back — a silent downgrade is the
exact failure it exists to prevent. Any new route that applies dietary restrictions must
use `dietaryModel()`, not `trackedModel()`.

Note: `trackedModel(provider, modelId, ctx)` ignores its `provider`/`modelId` arguments
entirely — the call always goes to the broker and is logged as `ai-broker`.
Passing `'google'` there does not make it a Google call.

The broker owns the shared provider keys for the whole portfolio and schedules all 11
sites against the ONE shared free-tier budget. Prefer `brokerModel({ feature, priority })`
for new call sites; `priority` defaults to `interactive` (a user is waiting). Cron/batch
callers must pass `priority: 'batch'` **and** `maxRetries: 0` — the broker already retries
across lanes, and an SDK retry on top can exceed Vercel's 300s cron limit. A broker-relayed
429 is never bypassed; only an unreachable broker (no status, or 502/503/504) falls through
to direct Groq. (Was Cerebras until 2026-08-23, when its free tier ended and every call
began returning 402 — note Groq namespaces the model id, so the direct call uses
`openai/gpt-oss-120b`, not the bare broker alias.)
