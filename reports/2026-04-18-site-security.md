━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECURITY AUDIT — ingredientbot.com
  Date: 2026-04-18
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Scope
Full-repo scan across 7 vulnerability classes: secrets & credentials, auth
& authorization, injection, input validation, sensitive data exposure,
CSRF/headers, dependency risks.

## Summary
- **Issues found:** 8 (1 HIGH, 5 MEDIUM, 2 LOW)
- **Fixed:** 8
- **Blockers:** none
- **Verification:** `npm run build` clean

## Systemic Fix Applied
**SYSTEMIC FIX — missing `aiLimiter` on AI routes, resolves findings #2, #3, #4, #5, #6**

Five separate AI endpoints called `generateText`/`streamText` without the
shared `aiLimiter.check()` guard. Any authenticated user could burn through
Anthropic tokens at their maximum rate. One hardening pass added the same
3-line rate-limit block (IP key → 10 req/min slidingWindow) to each route.

## Findings

### #1 HIGH — SSRF in recipe import
**File:** `src/app/api/recipes/import/route.ts:18` (`isValidUrl`)

The `/api/recipes/import` endpoint fetches an arbitrary user-supplied URL
server-side and pipes the HTML into Claude. The prior validator only
checked that the protocol was `http:`/`https:`, allowing requests to
internal infrastructure:
- `http://169.254.169.254/latest/meta-data/` — AWS/GCP/Azure instance
  metadata (credential theft on non-Vercel hosts).
- `http://localhost:<port>` / `http://127.0.0.1/` — internal services.
- RFC1918 ranges (`10.x`, `192.168.x`, `172.16–31.x`).
- IPv6 loopback and link-local.

Authenticated attacker → exfiltrates internal service responses via the
extracted-recipe JSON body.

**Fix:** extended `isValidUrl` to reject loopback, private, link-local,
and cloud-metadata hosts (see inline decision log comment). Chose a
hostname blocklist over DNS resolution because async DNS adds a
dependency and doesn't cover literal-IP exploits anyway.

---

### #2–#6 MEDIUM — Missing AI rate limiter (SYSTEMIC)
**Files:**
- `src/app/api/recipes/cook/route.ts`
- `src/app/api/recipes/ingredient-comment/route.ts`
- `src/app/api/recipes/analyze-photo/route.ts`
- `src/app/api/recipes/[id]/modify/route.ts`
- `src/app/api/recipes/[id]/nutrition/route.ts`

All five call Claude (`generateText` / `streamText`) after a bare `auth()`
check with no rate limit. Other AI routes (`generate`, `chat`, `import`,
`convert-diet`, `substitute`) already use `aiLimiter`; these were
overlooked. Cost-bomb / DoS vector for any logged-in user.

**Fix:** added the standard 3-line aiLimiter.check(ip) guard to each
route. Matches the existing pattern used in `recipes/generate/route.ts`.

---

### #7 LOW — Missing HSTS / static security headers on non-proxy paths
**File:** `next.config.ts`

`src/proxy.ts` sets `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, and `Permissions-Policy` on auth-gated responses, but
not on static assets or routes excluded by the middleware matcher. HSTS
was not set at all — Vercel injects it on the apex domain, but preview
deploys and self-hosted builds do not.

**Fix:** added a `headers()` block in `next.config.ts` that applies HSTS
(2-year max-age, includeSubDomains, preload) plus the same four headers
to every response. Does not duplicate work in the middleware — Next.js
merges both sets.

CSP was considered but deferred: IngredientBot uses streaming AI output
and inline Plausible analytics, so a meaningful CSP requires nonce
plumbing that's out of scope for this pass.

---

### #8 LOW — Unescaped user `name` and recipe title in meal-plan digest email
**File:** `src/app/api/cron/meal-plan-digest/route.ts`

Cron-generated HTML email interpolates `plan.user.name` and
`s.recipe.title` directly into the template. HTML email clients vary in
how aggressively they strip scripts — at minimum, angle-brackets in a
recipe title would break the layout; at worst, a permissive client could
render injected tags. Self-targeted (user ↔ user's own inbox) so impact
is low, but a trivial fix.

**Fix:** added a local `escapeHtml()` helper and wrapped both
interpolations.

## Scan Notes — areas checked, clean
- **Secrets:** `.env` gitignored and never committed; `src/lib/env.ts`
  validates required vars with zod; no hardcoded API keys anywhere in
  `src/`.
- **Auth:** every `/api/*` route under inspection calls `auth()`;
  admin routes layer `requireAdmin()` at the layout level; ownership
  checks present on all per-resource PATCH/DELETE (`recipes/[id]`,
  `collections/[id]`, `pantry/[id]`, `meal-plan/slot/[id]`).
- **Injection:** no `$queryRawUnsafe` / `$executeRawUnsafe`; no
  `dangerouslySetInnerHTML`; no `eval`/`Function` constructors. One
  `exec` call in `api/admin/scripts/[name]/run` — already gated by
  `isAdmin === true` and regex-sanitized name (`/^[a-zA-Z0-9_-]+$/`).
- **Input validation:** Zod used on critical paths (`user/email`);
  signup validates email + length; pantry/dietary routes coerce arrays.
  `isValidUrl` now hardened (see #1).
- **Data exposure:** user-facing queries use `select` allowlists;
  generic 500 responses don't leak stack traces (errors caught, message
  suppressed). Cron endpoints gate on `CRON_SECRET`.
- **CSRF:** NextAuth CSRF protection active via credentials provider;
  all state-changing routes accept only POST/PATCH/DELETE + require JWT
  session cookie; no CORS allow-list widening found.
- **Dependencies:** no suspicious packages; all `@anthropic-ai/*`,
  `@auth/*`, `next-auth@5`, `next@16.2` current. No known-vulnerable
  pins.
- **Anthropic SDK:** indirect via `@ai-sdk/anthropic`. API key read only
  from `process.env.ANTHROPIC_API_KEY`, never echoed back to clients,
  never logged.
- **Middleware (`src/proxy.ts`):** sound — email verification gate,
  admin wall, session-revocation flag via `sessionsRevokedAt`. Minor
  observation (not a security issue): `/r/[slug]` is not in
  `PUBLIC_PATHS`, so logged-out visitors to shared recipes are
  redirected to `/login`. That's a UX bug, not a security vuln — left
  for `/qa-bugs`.

## Verification
`npm run build` — passed, no errors, no warnings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
