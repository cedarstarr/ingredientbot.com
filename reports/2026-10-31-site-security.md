# Security audit: ingredientbot.com, 2026-10-31

Scope: all 50 `src/app/api/**/route.ts`, `src/middleware.ts`, `src/lib/{auth,auth.config,rate-limit,ssrf,admin}.ts`, `next.config.ts`, admin pages, public share page. Ownership columns confirmed in `prisma/schema.prisma` (Recipe, RecipeCollection, RecipeCompletion, MealPlan, PantryItem, DietaryProfile, PalateProfile all carry `userId`; MealPlanSlot is owned through MealPlan).

Result: 0 CRITICAL, 0 HIGH, 2 MEDIUM (deferred), 5 LOW. Nothing fixed in code (no HIGH+ finding).

## IDOR sweep (every route)
All recipe/collection/pantry/meal-plan/cook/share/tags/nutrition/modify/substitute/chat/sous-chef/convert-diet/save-variant/cook-feedback handlers resolve rows with `findFirst({ id, userId: session.user.id })` before any read or write. `recipes/[id]/fork` is intentionally `isPublic: true` scoped and copies into the caller's account. `meal-plan/slot/[id]` and `user/pantry/[id]` fetch then compare `userId` before mutating (acceptable). `meal-plan` PUT verifies the recipe belongs to the caller. `admin/*` routes gate on `session.user.isAdmin === true`. Cron routes fail closed on missing `CRON_SECRET`. No IDOR found.

## Findings
1. MEDIUM (deferred, FOU-777), `src/lib/ssrf.ts` + `src/app/api/recipes/import/route.ts:123-170`: SSRF guard is hostname-only, no DNS resolution (nip.io style names, rebinding) and `res.text()` is uncapped.
2. MEDIUM (deferred, FOU-778), `recipes/generate/route.ts:22-33`, `recipes/[id]/chat/route.ts:32-120`, `user/dietary/route.ts:60-70`: unbounded strings/arrays and unchecked `history[].role` flow into prompts.
3. LOW, `api/cron/*` compare the bearer secret with `!==` (not timing-safe); also accepts the secret without the `Bearer ` prefix. Not remotely exploitable in practice.
4. LOW, `auth/reset-password/route.ts:25`, `auth/signup`: `token`/`name` not type-checked; objects produce a Prisma 500, not a bypass. Signup returns 409 for existing emails (enumeration, mitigated by rate limit and BotID).
5. LOW, `auth/reset-password` and `verify-email-change` do not clear `failedLoginAttempts`/`lockedUntil` or revoke sessions on email change.
6. LOW, `recipes/[id]/share/route.ts:9` slug uses `Math.random`; slug is not a secret (public recipes are in the sitemap), so no impact.
7. LOW, `middleware.ts:151-152` sets the CSP request header twice (harmless duplicate); `staging.*` hosts skip the auth wall in middleware by design, handlers still self-authenticate.

## Other classes
- Secrets: none hardcoded. Sentry DSN/public key in middleware is a public ingest key by design. `.env*` not tracked except `.env.example`.
- Injection: only `$queryRaw` uses are tagged templates (parameterized). One `exec` (`admin/scripts/[name]/run`) is admin-only, regex-restricted name, and requires an `adminRunnable = true` opt-in. The single `dangerouslySetInnerHTML` renders `safeJsonLdString`. Email templates escape user names.
- Headers/CSRF: HSTS, nosniff, DENY framing, nonce CSP in middleware; NextAuth cookies and JSON-only mutation routes; no permissive CORS.
- Dependencies: package.json and lockfile already carry `next` 16.3.8 (the FOU-758 headline bump has landed on main; the tracker entry looks closeable). `npm audit` in this worktree ran against the shared checkout's stale hard-linked `node_modules` (next 16.3.0 installed), so its 3 critical / 10 high are not trustworthy; remaining items are transitive CLI/tooling (shadcn, prisma, @sentry/bundler). Per instructions, no bumps made and no new dependency issue filed; refresh `node_modules` and re-audit.

## Verification
Fast gate: `prisma generate` + `tsc --noEmit` clean (exit 0).
