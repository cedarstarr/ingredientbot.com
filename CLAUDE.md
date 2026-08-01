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
| Primary (text) | Cerebras, Groq fallback on 429/5xx | `gpt-oss-120b` | everything not listed below |
| Vision | Google | `gemini-2.5-flash-lite` | `analyze-photo` only — `gpt-oss-120b` is text-only |
| **Allergen safety** | Anthropic | `claude-opus-5` | any call applying an allergen-bearing restriction |

**Allergen calls never run on a free tier.** `dietaryModel(restrictions, ctx)` escalates
to `safetyModel()` when `hasAllergenRestriction()` matches, and `safetyModel()` throws
if `ANTHROPIC_API_KEY` is absent rather than falling back — a silent downgrade is the
exact failure it exists to prevent. Any new route that applies dietary restrictions must
use `dietaryModel()`, not `trackedModel()`.

Note: `trackedModel(provider, modelId, ctx)` ignores its `provider`/`modelId` arguments
for routing — they are logging labels only, and the call always goes to Cerebras+Groq.
Passing `'google'` there does not make it a Google call.
