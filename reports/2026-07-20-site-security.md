# /qa-security — ingredientbot.com — 2026-07-20

Sprint: `/home/cedar/Projects/plans/qa-security-2026-07-20.md`
Branch: `staging`
Verification: `npm run build` — Compiled successfully in 11.3s

## Scope

- 42 API routes under `src/app/api/**/route.ts`
- Middleware auth model (whitelist + email-verify gate + admin gate)
- Cron routes (fail-closed CRON_SECRET check)
- AI-invoking routes (auth + `aiLimiter` per portfolio audit FOU-217 style)
- Public share pages `/r/[slug]`
- IDOR heuristic vs `prisma/schema.prisma` on every id-taking route
- Dependency `npm audit`

## Findings by severity

### HIGH — 3 (all fixed)

**H-1 through H-3. Transitive dependency vulnerabilities**
- `fast-uri <=3.1.1` — path traversal + host confusion (GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc)
- `path-to-regexp 8.0.0 – 8.3.0` — ReDoS (GHSA-j3q9-mxjg-w52f, GHSA-27v5-c462-wpq7)
- `picomatch <=2.3.1 / 4.0.0–4.0.3` — method injection + ReDoS (GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj)
- **Fix**: `npm audit fix` — non-breaking lockfile update. Vulnerable transitives replaced with patched versions. 8 advisories cleared (1 low + 3 high + 4 moderate).

### MEDIUM — 1 (deferred)

**M-1. `postcss <8.5.10` XSS via unescaped `</style>` reaches through the `next` package tree**
- Advisory: GHSA-qx2v-qp2m-jg93
- Location: `node_modules/next/node_modules/postcss` (bundled Next.js dep, not a direct dep)
- `npm audit fix --force` would downgrade `@sentry/nextjs` to 6.3.5 — a large breaking change that removes current instrumentation.
- **Exposure**: theoretical. postcss is a build-time CSS transformer; the site does not stringify attacker-controlled CSS at runtime. Advisory triggers only if a build ingests user-supplied CSS through postcss's stringifier.
- **Fix path**: wait for a `next` release that pins `postcss >=8.5.10` (Next 16.x line) — same posture as the rest of the portfolio.
- **Status**: deferred → Linear issue for tracking.

### LOW — 1 (fixed)

**L-1. `/api/auth/verify-email` GET had no rate limit**
- File: `src/app/api/auth/verify-email/route.ts`
- Token is 256-bit random hex so brute-force isn't feasible, but the sister route `/api/auth/verify-email-change` is symmetrically rate-limited to defend against replay storms (email forwarders bouncing the same token, misconfigured mail-warmer bots).
- **Fix**: added `authLimiter.check('email-verify:{ip}')` at the top of the handler, keyed by `x-forwarded-for` — matches the pattern used across the rest of the auth surface.

## Areas verified clean (no findings)

- **Middleware**: `src/middleware.ts` fails closed — any non-public route without a session returns 401 (API) or redirects to `/login` (page). Public path list is minimal and correct (share page `/r/`, auth routes, cron routes, PWA assets).
- **Cron routes** (`/api/cron/welcome-drip`, `/api/cron/meal-plan-digest`): both fail closed if `CRON_SECRET` is unset AND require the header match. `/api/admin/trigger-cron` proxies via `requireAdmin()` and server-side secret — no `NEXT_PUBLIC_CRON_SECRET`.
- **AI-invoking routes** (11): every one enforces session before invoking the LLM AND rate-limits via `aiLimiter` — no unauthenticated LLM cost-leak surface. Verified: `analyze-photo`, `generate`, `cook`, `import`, `ingredient-comment`, `save-variant`, `[id]/chat`, `[id]/modify`, `[id]/substitute`, `[id]/convert-diet`, `[id]/nutrition`.
- **SSRF**: `src/lib/ssrf.ts` covers localhost, IPv6 loopback/ULA/link-local, all RFC1918 ranges in dotted/decimal/octal/hex encodings, GCP metadata host, multicast. `/api/recipes/import` uses `redirect: 'manual'` + re-validates the Location header — no bypass via 30x.
- **IDOR heuristic (all 42 routes)**:
  - Every `[id]`-parametrized route uses `prisma.{model}.findFirst({ where: { id, userId: session.user.id } })` OR loads then checks `row.userId !== session.user.id` OR is admin-gated. No unscoped `findUnique({ where: { id } })` on user-scoped models.
  - Cross-model checks (recipe → collection assignment) verify the collection also belongs to the caller before assigning.
  - `MealPlanSlot` correctly checks ownership through `mealPlan.userId`.
- **XSS**: only two `dangerouslySetInnerHTML` usages — both are JSON-LD via `safeJsonLdString()` which escapes `<`, `>`, `&`, U+2028, U+2029. Safe.
- **Public share page** (`/r/[slug]`): server-side `findUnique` filters on `publicSlug` (unique) AND `isPublic: true`. No private data leaks; recipe body rendered as React text nodes, not HTML.
- **Auth-family routes**: signup / forgot-password / reset-password / verify-email-change / password-change / email-change / account-delete are all `authLimiter`-throttled AND bcrypt-compared. Password reset AND password change bump `sessionsRevokedAt` — stolen session cookies die on rotation.
- **Admin surface**: `requireAdmin()` on `/api/admin/*` + `/admin` middleware gate. `/api/admin/scripts/[name]/run` regex-validates `name` to `^[a-zA-Z0-9_-]+$` before path-joining — no directory traversal.
- **Security headers**: HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy set globally in `next.config.ts` AND re-asserted in middleware.
- **Secrets**: `grep` for `sk_`, `pk_`, `ANTHROPIC_API_KEY=`, hardcoded connection strings — none in source. All secrets via `process.env`.

## Systemic fix pass

Scanned for shared root causes. None qualified — the portfolio-wide "AI route without auth/limit" pattern (FOU-217 style) is **already fully addressed** on this site: all 11 AI-invoking routes had `session` + `aiLimiter` checks in place before this run, from the 2026-04-18 systemic fix. No new class of finding warranted a systemic patch this run.

## Summary

- 5 issues (3 HIGH transitive-dep, 1 MEDIUM postcss-in-next, 1 LOW rate-limit gap)
- 4 fixed (3 HIGH via `npm audit fix`, 1 LOW verify-email limiter)
- 1 MEDIUM deferred (postcss in Next tree — awaiting upstream)
- `npm run build`: SUCCESS
