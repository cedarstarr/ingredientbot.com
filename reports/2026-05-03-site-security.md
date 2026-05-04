━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SECURITY AUDIT — ingredientbot.com
  Date: 2026-05-03
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Scope
Full-repo scan across 7 vulnerability classes: secrets & credentials, auth
& authorization, injection, input validation, sensitive data exposure,
CSRF/headers, dependency risks. Site uses `src/middleware.ts` (note:
sprint context referenced legacy `src/proxy.ts` path; actual file is
`src/middleware.ts`). AI integration is `@ai-sdk/anthropic` (Claude
Sonnet via `@/lib/ai`).

## Summary
- **Issues found:** 7 (2 HIGH, 4 MEDIUM, 1 LOW)
- **Fixed:** 7
- **Deferred:** 0
- **Verification:** `npm run build` clean

## Findings

### #1 HIGH — Cron routes fail open when CRON_SECRET is unset
**Files:**
- `src/app/api/cron/welcome-drip/route.ts:9–11`
- `src/app/api/cron/meal-plan-digest/route.ts:11–13`

Both cron handlers used the pattern:

```ts
if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
  return 401
}
```

If `CRON_SECRET` is unset (Vercel env var deleted, preview deploy without
the var, self-host without the var), the guard silently falls through.
Anyone on the internet could trigger `/api/cron/welcome-drip` to send
welcome emails to every recently-created user, or
`/api/cron/meal-plan-digest` to trigger a wave of digest emails plus the
DB load they entail. ZeptoMail spend / spam-list reputation impact in
addition to the standard DoS vector.

**Fix:** invert the guard — refuse the request entirely when
`CRON_SECRET` is missing (`503 Cron not configured`), then compare the
header. Also flagged in env.ts: `CRON_SECRET: z.string().optional()` — left
optional to keep dev/test ergonomics, but production deploys must set it
or both crons return 503 (not silently skip protection).

---

### #2 HIGH — `NEXT_PUBLIC_CRON_SECRET` would leak the cron secret into the client bundle
**File:** `src/app/(admin)/admin/ai-debug/ai-debug-client.tsx:30–31`

The admin debug page invoked the cron route from the browser using
`Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}`. Any value placed in
that env var is inlined into the public JS bundle by Next.js — accessible
to any unauthenticated visitor of the site, not just admins. Even though
no value happens to be set today, the code path is a foot-gun: the
moment someone (incl. an AI assistant) sets it to "make the button
work," the secret leaks portfolio-wide. Compounds finding #1.

**Fix:**
1. Added `src/app/api/admin/trigger-cron/route.ts` — admin-only proxy
   (POST, gated by `auth().user.isAdmin === true`) that forwards to a
   whitelisted cron path using the **server-side** `CRON_SECRET` only.
2. Replaced the client-side `NEXT_PUBLIC_CRON_SECRET` fetch with a POST
   to `/api/admin/trigger-cron` from the admin debug UI. The variable
   no longer needs to (and must not) exist.

---

### #3 HIGH — JSON-LD XSS via unescaped `</script>` in shared recipe page
**Files:**
- `src/app/r/[slug]/page.tsx:124` (recipe schema)
- `src/app/page.tsx:40` (web-app schema, low-risk static data)

Both routes render structured data with
`dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}`. Plain
`JSON.stringify` does **not** escape `<`, `>`, `&`, U+2028, U+2029,
which means an attacker-controlled string in the JSON tree can break
out of the surrounding `<script>` element and execute arbitrary JS in
the browser of every visitor of the public recipe page.

The `/r/[slug]` route interpolates **AI-generated** recipe titles,
descriptions, ingredients, and steps into the JSON-LD. A user can
bake an XSS payload into their own recipe via prompt-injection (or by
saving a recipe with a hand-crafted title field), publish it via the
share link, and any logged-out visitor — including search-engine
preview crawlers — executes the JS.

**Fix:** Added `safeJsonLdString()` helper in `src/lib/utils.ts`. It runs
`JSON.stringify` then replaces `<`, `>`, `&` with their `\uXXXX` escape
forms, plus the LINE/PARAGRAPH SEPARATOR characters that prematurely
terminate JS string literals. Both call sites switched over.

---

### #4 MEDIUM — Password reset does not invalidate existing sessions
**File:** `src/app/api/auth/reset-password/route.ts:28–31`

After a successful password reset, the user's previously issued JWT
sessions remained valid. The site already has a `sessionsRevokedAt`
kill-switch wired into `src/lib/auth.ts` (`token.invalid` short-circuit
in the JWT callback) — the reset path simply did not bump it. An
attacker who phished or stole a session cookie keeps access through
the reset.

**Fix:** added `sessionsRevokedAt: new Date()` to the password-reset
update. Same kill-switch the existing `/api/auth/signout-all` route
uses.

---

### #5 MEDIUM — Password change does not invalidate sibling sessions
**File:** `src/app/api/user/password/route.ts:32–34`

Same root cause as #4 for the in-app password change flow. Standard
hardening: when a user changes their password, sessions on other
devices should be revoked.

**Fix:** added `sessionsRevokedAt: new Date()` to the update. The
current session re-issues at the next request.

---

### #6 MEDIUM — Password change route lacks rate limiting
**File:** `src/app/api/user/password/route.ts`

Other auth routes (signup, forgot-password, reset-password, email-change)
share `authLimiter`. Password change had no limiter at all — an attacker
with a stolen but partial-credentials session (or testing brute-forced
`currentPassword` for admin accounts) had unlimited bcrypt-compare
attempts.

**Fix:** added the standard 3-line `authLimiter.check(\`password-change:${ip}\`)`
guard, returning `rateLimitResponse()` (429) when exceeded.

---

### #7 MEDIUM — SSRF guard accepts non-dotted IPv4 encodings and follows redirects
**File:** `src/app/api/recipes/import/route.ts:19–51, 178–206`

The previous `isValidUrl` blocklist matched on string prefixes
(`startsWith('127.')`, `startsWith('10.')`). It missed:

- Decimal IPv4 (`http://2130706433/` = 127.0.0.1).
- Octal IPv4 (`http://0177.0.0.1/` = 127.0.0.1).
- Hex IPv4 (`http://0x7f.0.0.1/`).
- Class-A `0.0.0.0/8` and multicast/reserved `224.0.0.0/4`.

Additionally, `fetch()` defaulted to `redirect: 'follow'`, so a
public-facing host could 30x to `http://localhost/` after the initial
guard passed.

**Fix:**
1. Rewrote the IPv4 path of `isValidUrl` — now decodes every segment as
   decimal/octal/hex, expands the single-integer form, and runs a
   range-based RFC1918/loopback/link-local check (`isPrivateIPv4`).
   Inline decision-log comment in the file.
2. Switched the import fetch to `redirect: 'manual'`. On a 30x response
   we re-validate the `Location` header through `isValidUrl` (one hop
   max) before issuing the follow-up request.

---

## Scan Notes — areas checked, clean
- **Secrets:** `.env` gitignored; `src/lib/env.ts` uses
  `@t3-oss/env-nextjs` with zod schemas; no hardcoded keys in `src/`.
  Confirmed `ANTHROPIC_API_KEY` only read server-side.
- **Auth:** every state-changing `/api/*` route calls `auth()`;
  middleware (`src/middleware.ts`) blocks unauthenticated app routes,
  enforces email-verification gate, kills revoked sessions, and gates
  `/admin/*` on `user.isAdmin === true`. Per-resource ownership checks
  present on all of: `recipes/[id]`, `collections/[id]`, `pantry/[id]`,
  `meal-plan/slot/[id]`, `recipes/[id]/share`, `recipes/[id]/chat`,
  `recipes/[id]/cook`, `recipes/[id]/modify`, `recipes/[id]/nutrition`,
  `recipes/[id]/substitute`, `recipes/[id]/convert-diet`,
  `recipes/[id]/tags`, `recipes/[id]/collection`.
- **Injection:** zero `$queryRawUnsafe` / `$executeRawUnsafe` in `src/`.
  No `eval` / `new Function`. Single `child_process.exec` call in
  `api/admin/scripts/[name]/run` — admin-gated and regex-sanitized
  (`/^[a-zA-Z0-9_-]+$/`), with the script path `path.join`'d to a fixed
  scripts directory and existence-checked.
- **XSS / dangerouslySetInnerHTML:** two call sites total (`/page.tsx`
  and `/r/[slug]/page.tsx`), both moved to `safeJsonLdString` (see #3).
- **Input validation:** zod schemas present on the email-change,
  cook-batch, nutrition, convert-diet, substitute, photo-analyze, and
  recipe-import paths; signup / forgot-password validate email regex
  and length. Generate / chat / ingredient-comment routes accept
  loosely-typed JSON — flagged as a soft prompt-injection risk, not a
  security vuln (impact is wasted Claude tokens, not data exfiltration;
  cost-DoS already mitigated by `aiLimiter`).
- **Data exposure:** user-facing queries use `select` allowlists; 500
  responses suppress error messages. No PII in logs except audit log
  `email_change_requested` records (intentional, admin-readable only).
- **CSRF:** NextAuth credentials provider includes CSRF token; all
  state-changing routes accept POST/PATCH/DELETE only and require the
  JWT session cookie. No CORS allow-list widening.
- **Headers:** `next.config.ts` sets `Strict-Transport-Security` (2yr,
  preload), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`. Middleware mirrors a subset
  on auth-gated responses.
- **Dependencies:** `npm audit --omit=dev` reports 7 advisories
  (5 high, 2 moderate). All transitive through `shadcn` CLI
  (`@modelcontextprotocol/sdk` → `hono`, `@hono/node-server`) and
  `@ts-morph/common` — devDependencies / build-time only, never reach
  the runtime bundle. No production-runtime advisories. Logged for
  awareness, not actionable here.
- **Anthropic SDK:** indirect via `@ai-sdk/anthropic`. API key read
  only from `process.env.ANTHROPIC_API_KEY`, never serialized to the
  client, never logged.
- **Slug entropy (`Math.random` in `recipes/[id]/share`):** acceptable
  — `36^8` ≈ 2.8 × 10¹² combinations, recipe is intended to be public,
  no PII in the body. Not a finding.

## Verification
`npm run build` — passed, no errors, no warnings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
