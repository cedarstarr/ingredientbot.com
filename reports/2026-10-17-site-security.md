# /qa-security — ingredientbot.com — 2026-10-17

Scope: whole repo (50 API routes, middleware, auth config, next.config headers/CSP, raw SQL, exec, dangerouslySetInnerHTML, dependencies). IDOR heuristic applied against prisma/schema.prisma.

| # | File | Severity | Finding | Status |
|---|------|----------|---------|--------|
| 1 | package.json (next ^16.3.0, resolved 16.3.0) | CRITICAL | `npm audit`: Next.js RCE (image optimizer AVIF, next/og), cache poisoning; sharp, proxy-addr transitive | Deferred, FOU-758 (framework bump needs full build) |
| 2 | src/lib/ssrf.ts:50-60 | MEDIUM | `isValidUrl` never matched bracketed IPv6 literals (`url.hostname` keeps brackets): `http://[fd00::1]/`, `[fe80::1]`, `[::ffff:127.0.0.1]`, `[::]` passed the guard in `/api/recipes/import` (authenticated SSRF). The old `startsWith('fc'/'fd')` check also wrongly blocked public hosts such as fcbarcelona.com | Fixed (`isPrivateIPv6`, tests added) |
| 3 | src/app/api/recipes/import/route.ts | LOW | Guard is hostname-only; a public DNS name resolving to a private IP (rebinding / nip.io) is not caught. Response is only AI-extracted recipe JSON, so blind-ish | Not filed (LOW) |
| 4 | src/app/api/cron/*/route.ts | LOW | CRON_SECRET compared with `!==` (non-constant-time) | Not filed (LOW) |

Reviewed and clean: all `[id]` routes scope by `userId` (recipes, collections, pantry, meal-plan slot via mealPlan.userId, cook-feedback with userId+recipeId); fork reads only `isPublic`; admin routes check `isAdmin === true`, script runner has name regex + default-deny `adminRunnable` + execs a fixed path; crons fail closed; raw SQL is tagged-template parameterised; JSON-LD uses `safeJsonLdString`; nonce CSP is enforcing; login and /api rate-limited; forgot-password does not enumerate.

Verification: `gate.sh` exit 0; `vitest run src/lib/__tests__/ssrf.test.ts` 45/45.
