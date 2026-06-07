━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECURITY AUDIT — ingredientbot.com
  Date: 2026-06-06
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Scope
Fifth pass on this repo. Prior runs (2026-04-18, 2026-05-03, 2026-05-08,
2026-05-09) already remediated cron fail-open, the `NEXT_PUBLIC_CRON_SECRET`
foot-gun, JSON-LD XSS, password-reset/change session revocation,
password-change & account-delete rate-limits, the SSRF guard for recipe
import, the credentials-callback brute-force gap, admin-page defense-in-
depth, the next-DoS advisory, the photo-analyze mime allowlist, and the
Google env var entry.

This pass focused on what changed since 2026-05-09: Sentry instrumentation
wire-up (3 files), the new `save-variant` route, the AI provider migration
to Cerebras/Groq, FOU-134 (auth layout main landmark), and clearing the
two LOW carry-overs from the 2026-05-09 deferred list. Full IDOR re-scan
across all 42 API routes; full secrets/injection/XSS re-scan; current
`npm audit --omit=dev` reach analysis.

## Summary
- **Issues found:** 3 (0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW)
- **Fixed:** 3 (3 LOW)
- **Deferred:** 0
- **Verification:** `npm run build` clean

## Findings

### #1 LOW — `next@16.2.6` postcss-transitive advisory (FIXED)
**Files:** `package.json`, `package-lock.json`

`npm audit --omit=dev` flags `next@16.2.6 → postcss@8.4.31` (XSS via
unescaped `</style>` in stringify output). The advisory is build-time
only — postcss is not bundled into the runtime page, and the advisory
requires attacker-controlled CSS in the stringify input which the app
does not do. Still: there's a clean patch bump available, no semver
risk, so take it rather than carry a yellow audit forward.

**Fix:** bumped `next` and `eslint-config-next` to `^16.2.7`.
Build clean.

---

### #2 LOW — Recipe share route trusts `host` header (FIXED)
**File:** `src/app/api/recipes/[id]/share/route.ts:43–45`

Carry-over from the 2026-05-09 deferred list. The share URL was assembled
from `req.headers.get('host')`, which an attacker who controls a Host
header (some hosting fronts pass it through unmodified) could swap to a
phishing domain. Worst case: the user gets a `phish.example/r/{slug}`
link they then forward thinking it's our domain.

Vercel rewrites Host to the project domain in practice, so exploitability
is low today, but `NEXT_PUBLIC_SITE_URL` is already validated in the env
schema — no reason not to prefer it.

**Fix:** prefer `process.env.NEXT_PUBLIC_SITE_URL` when set, fall back
to the request-host form for local dev where the env var is absent.

---

### #3 LOW — `verify-email-change` has no rate limit (FIXED)
**File:** `src/app/api/auth/verify-email-change/route.ts`

Carry-over from prior runs. Token entropy is 256 bits so brute-force is
computationally infeasible inside the 1-hour expiry window, but the
route was the only token-flow handler without an `authLimiter` and the
asymmetry kept resurfacing on every audit.

**Fix:** added `authLimiter.check('email-verify-change:{ip}')` ahead of
the token lookup. Sub-second rate-limit check, identical pattern to
signup / forgot / reset / password-change. Closes the carry-over.

---

## IDOR Re-scan

All 42 API routes under `src/app/api/**/route.ts` re-verified:

| Route family | Ownership check |
|---|---|
| `recipes/[id]/*` (10 routes) | `findFirst({ where: { id, userId: session.user.id } })` everywhere |
| `collections/[id]` | `findFirst({ where: { id, userId } })` |
| `user/pantry/[id]` | `findUnique` then `item.userId !== session.user.id → 403` |
| `meal-plan/slot/[id]` | loads slot with `mealPlan: { select: { userId } }`, then `slot.mealPlan.userId !== session.user.id → 403` |
| `meal-plan` PUT | verifies the user owns the `recipeId` before upserting the slot |
| `admin/*` | `session.user.isAdmin !== true → 401` |
| `cron/*` | fails closed when `CRON_SECRET` is unset, Bearer check otherwise |
| `auth/*` | rate-limited via `authLimiter` everywhere |

No IDOR findings.

## Dependency Advisory Reach Analysis

`npm audit --omit=dev` reports 14 advisories. Confirmed reach (via
`npm ls --all`):

| Package | Reach | Action |
|---|---|---|
| `next` | bundled at runtime | **bumped to 16.2.7** (see #1) |
| `@sentry/nextjs` | via `next` only | resolved by #1 |
| `@hono/node-server`, `hono`, `fast-uri`, `path-to-regexp`, `qs`, `picomatch`, `ip-address`, `express-rate-limit`, `brace-expansion` | all transit `shadcn` CLI / `@modelcontextprotocol/sdk` / `webpack-plugin` (build-time tooling, never bundled to client or server) | no action — no runtime reach |
| `postcss` | dev-time CSS pipeline only | covered by #1 next bump |
| `next-plausible` | no fix available (analytics provider client lib); analytics endpoint receives no user input | watch list |

## CSP / Security Headers

`src/middleware.ts` already sets `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
and `Permissions-Policy: camera=(), microphone=(), geolocation=()` on
every response. No regression since prior audits.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  END REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
