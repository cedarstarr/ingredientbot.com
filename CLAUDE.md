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

**No AI allergen clearance (FOU-321, decided 2026-08-09, implemented 2026-09-08).**
There used to be an "Allergen safety" lane here (Anthropic `claude-opus-5`, escalated to
by `dietaryModel()` whenever `hasAllergenRestriction()` matched) that let a paid model
tell a user a recipe was safe for their allergy. It's gone — not downgraded to a cheaper
model, removed outright, per the portfolio's "no free model for allergens" rule: there is
no allergen *clearance* model anymore, free or paid. A model that's right 99% of the time
is a good classifier and a bad allergen check; the 1% is an anaphylaxis-grade failure, and
no model closes that gap. `dietaryModel(restrictions, ctx)` now always routes to the same
broker lane as every other text call.

`hasAllergenRestriction()` survives with a narrower job: it **flags** risk for the UI
rather than certifying safety. Routes that compute it (`substitute`, `chat`, `modify`,
`convert-diet`) pass the result back to the frontend (a JSON `allergenFlag` field, or an
`X-Allergen-Flag` header on the two routes that stream plain text), and
`AllergenDisclaimer` (`src/components/allergen-disclaimer.tsx`) renders next to the
output instead of the AI's own text implying a verified-safe answer. Every recipe detail
view already shows `AllergenDisclaimer` unconditionally regardless of this flag. Any new
route that applies dietary restrictions must still use `dietaryModel()`, not
`trackedModel()`, so it's flagged consistently — model choice no longer depends on it,
but the flagging convention does.

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
