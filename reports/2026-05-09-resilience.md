# /qa-resilience — ingredientbot.com — 2026-05-09

## Counts
- Error Boundaries: 0 issues
- Data Fetching: 2 issues (95% of 41 handlers covered)
- Prisma Pooling: 0
- Sentry: 0
- Rate Limiting: 0
- Health Check: 1
- Middleware: 0
- Cron Safety: 0
- Failure-Mode Tests: 1

## Total: 4 issues — 0 AUTO, 4 MANUAL

## MANUAL findings (no code edits applied)
- [MEDIUM] [UNPROTECTED_HANDLER] src/app/api/recipes/analyze-photo/route.ts:POST — req.formData() unguarded
- [MEDIUM] [UNPROTECTED_HANDLER] src/app/api/recipes/[id]/substitute/route.ts:POST — JSON parse + AI call uncaught
- [LOW] [NO_RESILIENCE_SPEC] tests/ — no resilience.spec.ts
- [LOW] [MINIMAL_HEALTH] src/app/api/health/route.ts — returns 200 unconditionally; no DB ping

## Notes
This site is in good resilience shape — pure Next.js conventions in place, Sentry wired, middleware (proxy.ts) present. Two handler hardenings + a real health-ping + a resilience spec are deferred to a follow-up. No code changes in this run.

---

## Manual items resolved 2026-05-09 (follow-up)

Branch: `feat/qa-resilience-ingredientbot-manual` (off `main`).

- [MEDIUM] [UNPROTECTED_HANDLER] `src/app/api/recipes/analyze-photo/route.ts` — wrapped POST body (formData parsing through generateText + JSON post-processing) in a single try/catch. Catch re-throws `isRedirectError`, logs to console, calls `Sentry.captureException`, returns `{ error: 'Failed to analyze photo' }` 500. Imports added: `@sentry/nextjs`, `next/dist/client/components/redirect-error` (Next 16 path).
- [MEDIUM] [UNPROTECTED_HANDLER] `src/app/api/recipes/[id]/substitute/route.ts` — same try/catch shape from `req.json()` through the `generateText` call and JSON parsing. Catch returns `{ error: 'Failed to find substitute' }` 500. Auth + rate-limit + recipe-ownership checks intentionally left outside the try so 401/404/429 paths stay clean.
- [LOW] [MINIMAL_HEALTH] `src/app/api/health/route.ts` — replaced unconditional 200 with `prisma.$queryRaw\`SELECT 1\`` ping. Returns 503 + `{ status: 'error' }` on DB failure.
- [LOW] [NO_RESILIENCE_SPEC] `tests/resilience.spec.ts` — new spec. Mocks `https://api.anthropic.com/**` to 500 via `page.route`, drives the user from `/recipes` into the recipe detail page and opens the substitution panel, then asserts `data-testid="route-error-boundary"` is visible with the user-visible error text. Added `data-testid="route-error-boundary"` to `src/app/error.tsx` root in the same change. Spec is written but NOT executed in this run (per follow-up scope: edits + fast gate only). Targeted the substitute route over analyze-photo because it sits behind a real authenticated page that can render `error.tsx`.

**Verification:** `npx prisma generate && npx tsc --noEmit` clean. No build, no test run. Vercel preview will pick up the branch on push.

**Memory correction noted:** `src/middleware.ts` exists at the standard path — the memory note about `src/proxy.ts` being the middleware is outdated.
