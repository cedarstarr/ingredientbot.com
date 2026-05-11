━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECURITY AUDIT — ingredientbot.com
  Date: 2026-05-08
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Scope
Full-repo scan across the 7 vulnerability classes (secrets & credentials,
auth & authorization, injection, input validation, sensitive data exposure,
CSRF/headers, dependency risks). This is the third pass on this repo —
the 2026-04-18 and 2026-05-03 runs already remediated cron fail-open,
the `NEXT_PUBLIC_CRON_SECRET` foot-gun, JSON-LD XSS, password-reset/change
session revocation, password-change rate-limit, and the SSRF guard for
recipe import. This pass focuses on what changed since 2026-05-03 and
on residual auth-surface gaps not previously addressed.

Sprint context referenced `src/proxy.ts`; the actual middleware file is
`src/middleware.ts` (consistent with the prior run note).

## Summary
- **Issues found:** 6 (0 CRITICAL, 0 HIGH, 2 MEDIUM, 4 LOW)
- **Fixed:** 3 (2 MEDIUM, 1 LOW)
- **Deferred:** 3 LOW
- **Verification:** `npm run build` clean

## Findings

### #1 MEDIUM — NextAuth credentials login has no rate limit (FIXED)
**File:** `src/lib/auth.ts` (`authorize` callback)

NextAuth v5 owns the `/api/auth/callback/credentials` POST handler. Our
middleware lets `/api/auth/*` through as a public path (correct — login
must be reachable by unauthenticated callers), but no per-IP throttle
gates the bcrypt-compare on the inner `authorize()` function. Other
auth paths (signup, forgot-password, reset-password, password-change,
email-change) all share `authLimiter` (5/min/IP). Without the same guard
on login, an attacker can run unlimited online password-guess attempts
against any known email — and the bcrypt cost itself is the only brake
on rate.

**Fix:** added an `authLimiter.check(\`login:${ip}\`)` call at the top of
the `authorize()` callback. On rate-limit it throws a typed
`CredentialsSignin` ("Too many sign-in attempts") so the front-end form
gets a clean error instead of a silent 401. Key prefix shares the
`authLimiter` Redis namespace, so a brute-forcer cannot evade by
ping-ponging between `/login` and `/forgot-password`.

---

### #2 MEDIUM — Account-delete bcrypt-compare is unbounded (FIXED)
**File:** `src/app/api/user/account/route.ts` (DELETE)

Account deletion requires the user's password as a confirmation step,
but the route had no rate limit. A stolen session cookie or open browser
session let an attacker run unbounded `bcrypt.compare` attempts against
the password field — once cracked, the attacker can pivot to
unauthenticated brute-force or to changing the email address before
deleting. Same pattern previously fixed for `/api/user/password` in
the 2026-05-03 run; this route was missed.

**Fix:** added the standard `authLimiter.check(\`account-delete:${ip}\`)`
guard at the top of the handler, returning `rateLimitResponse()` (429)
when exceeded.

---

### #3 LOW — Admin pages relied solely on middleware for auth (FIXED)
**Files:**
- `src/app/(admin)/admin/page.tsx`
- `src/app/(admin)/admin/users/page.tsx`
- `src/app/(admin)/admin/audit-logs/page.tsx`

`/admin/scripts/page.tsx` and `/admin/ai-debug/page.tsx` already call
`requireAdmin()`. The other three pages relied solely on
`src/middleware.ts` enforcing `pathname.startsWith('/admin')` →
`user.isAdmin` redirect. That works today, but a future edit to the
middleware `matcher` config or to `PUBLIC_PATHS` could silently expose
the admin overview, user list, or audit log without any in-page check
catching the regression. Audit-logs in particular emits user IDs +
IPs, so the impact of an exposure regression is non-trivial.

**Fix:** added `await requireAdmin()` at the top of all three page
components. Defense-in-depth — the middleware check still runs first
in production, this is a belt-and-suspenders backstop. Inline comment
on each page documents the reasoning so the next person editing them
doesn't strip the redundant call.

---

### #4 LOW — Recipe share route trusts `host` header (DEFERRED)
**File:** `src/app/api/recipes/[id]/share/route.ts:43–45`

Returns `${protocol}://${host}/r/${slug}` to the caller using
`req.headers.get('host')`. On Vercel the host is fixed at the edge,
so reflected-host injection is bounded to the user's own response.
Useful only for self-XSS / phishing-style attacks where the attacker
controls the URL anyway. Acceptable risk on the current deployment
target; would matter more if the site moved to a self-hosted setup
without a strict host validator at the proxy layer.

**Recommended fix (deferred):** prefer `process.env.NEXT_PUBLIC_SITE_URL`
when set, fall back to `host` header only when env is unset.

---

### #5 LOW — `verify-email-change` has no rate limit (DEFERRED)
**File:** `src/app/api/auth/verify-email-change/route.ts`

Token entropy is `crypto.randomBytes(32).toString('hex')` — 256 bits.
A guess-rate brute-force is computationally infeasible inside the 1-hour
expiry window even at line-rate, so the missing rate-limit is not
exploitable today. Keeping the finding logged for symmetry with the
other auth-flow routes (which all have `authLimiter`).

**Recommended fix (deferred):** add `authLimiter.check(\`email-verify:${ip}\`)`
for symmetry — costs nothing.

---

### #6 LOW — `analyze-photo` accepts client-supplied mime-type (DEFERRED)
**File:** `src/app/api/recipes/analyze-photo/route.ts:37`

`mimeType = (photo.type || 'image/jpeg') as 'image/jpeg' | ...` — the
type assertion is a TypeScript-only cast. The browser-supplied
`File.type` reaches the AI provider unmodified. The provider rejects
unknown content types, so the worst-case is a wasted token call, not
data exfiltration or RCE.

**Recommended fix (deferred):** validate against the literal allowlist
(`['image/jpeg', 'image/png', 'image/webp', 'image/gif']`) and 400 on
mismatch, both for cost and for sanity.

---

## Scan Notes — areas checked, clean
- **Secrets:** `.env` gitignored; `src/lib/env.ts` uses `@t3-oss/env-nextjs`
  + zod schemas. No hardcoded keys in `src/`. `ANTHROPIC_API_KEY`,
  `CRON_SECRET`, `ZEPTOMAIL_API_KEY`, `UPSTASH_REDIS_REST_TOKEN` are all
  read server-side only. No `NEXT_PUBLIC_*_SECRET` / `NEXT_PUBLIC_*_KEY`
  variables exist (the previous `NEXT_PUBLIC_CRON_SECRET` foot-gun was
  removed in the 2026-05-03 run via the admin trigger-cron proxy).
- **Auth:** every state-changing `/api/*` route calls `auth()` and checks
  per-resource ownership. Middleware enforces session, email-verification
  gate, sessions-revoked-at kill switch, and `/admin/*` `isAdmin` check.
  `requireAdmin()` helper now applied to every admin page (#3).
- **Cron:** both `/api/cron/welcome-drip` and `/api/cron/meal-plan-digest`
  fail closed when `CRON_SECRET` is unset (503), then bearer-compare.
- **Injection:** zero `$queryRawUnsafe` / `$executeRawUnsafe`. No `eval`
  / `new Function`. The only `child_process.exec` call in
  `/api/admin/scripts/[name]/run` is admin-gated, regex-sanitized
  (`/^[a-zA-Z0-9_-]+$/`), with the script path joined to a fixed scripts
  directory and existence-checked before exec.
- **XSS:** two `dangerouslySetInnerHTML` call sites total (`/page.tsx`
  and `/r/[slug]/page.tsx`); both go through `safeJsonLdString()` which
  escapes `<`, `>`, `&`, U+2028, U+2029 (added 2026-05-03).
- **SSRF:** `recipe-import/route.ts` decodes IPv4 in dotted/decimal/octal/hex
  form, blocks RFC1918 / loopback / link-local / multicast / cloud
  metadata, fetches with `redirect: 'manual'` and re-validates 30x
  Location through the same guard before a single follow.
- **Input validation:** zod schemas present on email-change, cook-batch,
  nutrition, convert-diet, substitute, photo-analyze, recipe-import.
  Signup / forgot / reset / password-change validate manually (email
  regex, length, required types). Kitchen-prefs PATCH enforces enum
  allowlists (`ChefPersonality`, `VALID_COOKING_METHODS`, spice 0–3).
- **Data exposure:** user-facing queries use `select` allowlists. 500
  responses suppress error messages and pino-log internally. No PII in
  logs except audit log `email_change_requested` records (intentional,
  admin-only).
- **Headers:** `next.config.ts` sets HSTS (2yr, preload),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`. Middleware mirrors a subset on auth-gated
  responses. Per-response `x-request-id` set everywhere.
- **CSRF:** NextAuth credentials provider includes CSRF token; all
  state-changing routes are POST/PATCH/DELETE only and require the JWT
  session cookie. No CORS allow-list widening.
- **Session revocation:** password-reset, in-app password-change, and
  `/api/auth/signout-all` all bump `sessionsRevokedAt`. JWT callback
  in `auth.ts` short-circuits invalid tokens (token.iat compared to
  `sessionsRevokedAt`).
- **Anthropic / Google AI:** indirect via `@ai-sdk/anthropic` and
  `@ai-sdk/google`. API keys read only from `process.env` server-side,
  never serialized to the client, never logged. The Google SDK reads
  `GOOGLE_GENERATIVE_AI_API_KEY` from process.env directly (not via the
  zod env schema in `lib/env.ts`); not a vuln, but worth adding for
  consistency the next time the env file is touched.
- **Dependencies:** `npm audit --omit=dev` advisories all transitive
  through `shadcn` CLI / `ts-morph` (devDependencies, build-time only,
  never reach the runtime bundle). No production-runtime advisories.
- **Slug entropy:** `Math.random` in `recipes/[id]/share` — acceptable
  (36⁸ ≈ 2.8 trillion, public recipe by design, no PII).

## Verification
`npm run build` — passed, no errors.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
