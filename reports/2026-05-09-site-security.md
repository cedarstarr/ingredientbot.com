━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECURITY AUDIT — ingredientbot.com
  Date: 2026-05-09
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Scope
Full-repo scan across the 7 vulnerability classes (secrets & credentials,
auth & authorization, injection, input validation, sensitive data exposure,
CSRF/headers, dependency risks). Fourth pass on this repo. Prior runs
(2026-04-18, 2026-05-03, 2026-05-08) already remediated cron fail-open,
the `NEXT_PUBLIC_CRON_SECRET` foot-gun, JSON-LD XSS, password-reset/change
session revocation, password-change & account-delete rate-limits, the
SSRF guard for recipe import, the credentials-callback brute-force gap,
and admin-page defense-in-depth. This pass focuses on what changed since
2026-05-08 (Vercel-bypass headers in playwright config + carry-over
deferred LOW findings) and on dependency advisories that surfaced since
the last audit.

The CLAUDE.md note for this site mentioned `src/proxy.ts`; the real
middleware file is `src/middleware.ts` (consistent with the prior runs).

## Summary
- **Issues found:** 5 (0 CRITICAL, 0 HIGH, 1 MEDIUM, 4 LOW)
- **Fixed:** 3 (1 MEDIUM, 2 LOW)
- **Deferred:** 2 LOW
- **Verification:** `npm run build` clean

## Findings

### #1 MEDIUM — Next.js DoS advisory (FIXED)
**Files:** `package.json`, `package-lock.json`

`next@16.2.0` was on the manifest. GHSA covering Server Components
DoS lands a fix at `next@16.2.6` (semver-compatible patch). The advisory
is exploitable by an unauthenticated remote caller against any RSC
endpoint, so this is the only production-runtime advisory worth acting
on this pass — every other entry in `npm audit --omit=dev` traces back
through the `shadcn` CLI (build-time only, never bundled), `@sentry/nextjs`
(would require a SemVer-major rollback to 6.x — net regression), or
`next-auth` v3 (we're intentionally on v5 beta and cannot downgrade).

**Fix:** bumped `next` and `eslint-config-next` to `16.2.6`. Verified
clean build.

---

### #2 LOW — `analyze-photo` accepts client-supplied mime-type (FIXED)
**File:** `src/app/api/recipes/analyze-photo/route.ts:37`

Carry-over from the 2026-05-08 deferred list. `mimeType = (photo.type || 'image/jpeg') as 'image/jpeg' | ...`
was a TypeScript-only cast — the browser-supplied `File.type` reached the
Gemini provider unmodified. Worst-case was a wasted token call (provider
rejects unknown content types), not data exfiltration or RCE. Cheap
enough to fix now rather than carry forward another sprint.

**Fix:** validate the mime against an explicit allowlist
(`['image/jpeg', 'image/png', 'image/webp', 'image/gif']`); 400 on
mismatch. Lower-cased before comparison so `IMAGE/JPEG` doesn't slip
past on principle even though browsers normalize it.

---

### #3 LOW — `GOOGLE_GENERATIVE_AI_API_KEY` not validated by env schema (FIXED)
**File:** `src/lib/env.ts`

The Google AI SDK reads `GOOGLE_GENERATIVE_AI_API_KEY` directly from
`process.env`. The site's `@t3-oss/env-nextjs` zod schema validates
every other server secret (`DATABASE_URL`, `NEXTAUTH_SECRET`,
`ANTHROPIC_API_KEY`, `UPSTASH_*`, `CRON_SECRET`, `ZEPTOMAIL_*`) but had
no entry for the Google key. Not a vulnerability today, but a config
drift trap — if the key were ever named incorrectly in Vercel, the
build would succeed and Gemini calls would silently fail at request
time instead of failing fast at boot. Flagged in the 2026-05-08 scan
notes; folded into the fix list this pass.

**Fix:** added `GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional()`
to the server schema and wired it through `runtimeEnv`. Optional rather
than required so env-less local builds still pass — the photo-analysis
route already returns a 503 when the AI service is unconfigured.

---

### #4 LOW — `verify-email-change` has no rate limit (DEFERRED)
**File:** `src/app/api/auth/verify-email-change/route.ts`

Carry-over from prior runs. Token entropy is `crypto.randomBytes(32).toString('hex')`
(256 bits) — guess-rate brute-force is computationally infeasible inside
the 1-hour expiry window even at line-rate, so the missing rate-limit is
not exploitable today. Keeping logged for symmetry with the other
auth-flow routes (signup / forgot / reset / password-change all share
`authLimiter`).

**Recommended fix (deferred):** add `authLimiter.check(\`email-verify:${ip}\`)`
for symmetry. Costs nothing but doesn't move the security needle either.

---

### #5 LOW — Recipe share route trusts `host` header (DEFERRED)
**File:** `src/app/api/recipes/[id]/share/route.ts:43–45`

Carry-over from 2026-05-08. Returns `${protocol}://${host}/r/${slug}`
to the caller using `req.headers.get('host')`. On Vercel the host is
fixed at the edge, so reflected-host injection is bounded to the user's
own response. Useful only for self-XSS / phishing-style attacks where
the attacker controls the URL anyway. Acceptable risk on the current
deployment target.

**Recommended fix (deferred):** prefer `process.env.NEXT_PUBLIC_SITE_URL`
when set, fall back to `host` header only when env is unset.

---

## Scan Notes — areas checked, clean
- **Secrets:** `.env` gitignored; `src/lib/env.ts` uses `@t3-oss/env-nextjs`
  + zod schemas (now including `GOOGLE_GENERATIVE_AI_API_KEY` — see #3).
  No hardcoded keys in `src/`. No `NEXT_PUBLIC_*_SECRET` /
  `NEXT_PUBLIC_*_KEY` variables. The new `VERCEL_AUTOMATION_BYPASS_SECRET`
  reference in `playwright.config.ts` is read-only at test boot, never
  baked into client bundles, never logged.
- **Auth:** every state-changing `/api/*` route calls `auth()` and
  enforces per-resource ownership. NextAuth credentials-callback
  brute-force gate added 2026-05-08 still in place (`authorize()` →
  `authLimiter.check('login:${ip}')`). `requireAdmin()` applied to all
  admin pages. `signout-all` bumps `sessionsRevokedAt`; JWT callback
  invalidates tokens whose `iat` predates revocation.
- **Cron:** both `/api/cron/welcome-drip` and `/api/cron/meal-plan-digest`
  fail closed when `CRON_SECRET` is unset (503), then constant-time
  bearer compare. Both wrap their work in try/catch and persist a
  `JobRun` row on failure so cron monitoring can flag silent breaks.
- **Injection:** zero `$queryRawUnsafe` / `$executeRawUnsafe`. No
  `eval` / `new Function`. The only `child_process.exec` call in
  `/api/admin/scripts/[name]/run` is admin-gated, regex-sanitized
  (`/^[a-zA-Z0-9_-]+$/`), with the script path joined to a fixed
  scripts directory and `fs.existsSync` checked before exec. The
  spawn is timeout-bounded (60s).
- **XSS:** two `dangerouslySetInnerHTML` call sites total
  (`/page.tsx` and `/r/[slug]/page.tsx`); both flow through
  `safeJsonLdString()`. Email digest interpolations use a local
  `escapeHtml()` (added 2026-04-18, still present and called on every
  user-controlled field).
- **SSRF:** `recipe-import/route.ts` decodes IPv4 in dotted/decimal/
  octal/hex form, blocks RFC1918 / loopback / link-local / multicast /
  cloud metadata, fetches with `redirect: 'manual'` and re-validates
  30x Location through the same guard before a single follow.
- **Input validation:** zod schemas on email-change, cook-batch,
  nutrition, convert-diet, substitute, photo-analyze (now strict
  mime allowlist — see #2), recipe-import. Signup / forgot / reset /
  password-change validate manually (email regex, length, required
  types). Kitchen-prefs PATCH enforces enum allowlists. Profile
  PATCH bounded by `name.length <= 100`. Notifications PATCH
  type-checks booleans.
- **Data exposure:** every user-facing query uses `select` allowlists.
  Recipe GET strips `recipeData` + `nutrition` JSON unless explicitly
  requested. 500 responses suppress error messages and pino-log
  internally. No PII in logs except the `email_change_requested`
  audit-log records (intentional, admin-readable only).
- **Headers:** `next.config.ts` sets HSTS (2yr, preload),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`. Middleware mirrors the four non-HSTS values on
  auth-gated responses. Per-response `x-request-id` is propagated
  end-to-end.
- **CSRF:** NextAuth credentials provider includes CSRF token; all
  state-changing routes are POST/PATCH/DELETE only and require the
  JWT session cookie. No CORS allow-list widening.
- **Anthropic / Google AI:** indirect via `@ai-sdk/anthropic` and
  `@ai-sdk/google`. API keys read only from `process.env` server-side,
  never serialized to the client, never logged. The Google key now
  validated by the env schema for symmetry with Anthropic.
- **Dependencies:** `next@16.2.6` (advisory fixed — see #1). Remaining
  `npm audit --omit=dev` entries are all transitive through `shadcn`
  CLI (build-time, never bundled), `@sentry/nextjs` (downgrade requires
  SemVer-major rollback to 6.x), or `next-auth` v3 (we're intentionally
  on v5 beta). Not actionable without regression.
- **Slug entropy:** `Math.random` in `recipes/[id]/share` — acceptable
  (36⁸ ≈ 2.8 trillion, public recipe by design, no PII).
- **Playwright Vercel-bypass headers:** `playwright.config.ts` sends
  `x-vercel-protection-bypass` + `x-vercel-set-bypass-cookie` only
  when `PLAYWRIGHT_BASE_URL` matches `vercel.app` AND
  `VERCEL_AUTOMATION_BYPASS_SECRET` is set. The bypass token is read
  from process.env at test boot, never embedded in source. Sound.

## Verification
`npm run build` — passed, no errors.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
