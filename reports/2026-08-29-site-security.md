# /qa-security — ingredientbot.com — 2026-08-29

Sprint: `/home/cedar/Projects/plans/qa-security-2026-08-29.md`
Branch: `staging` (no branch/checkout performed — orchestrator's portfolio-wide guard already passed)
Verification: fast gate only — `npx prisma generate && npx tsc --noEmit` clean. `npm run build` NOT run (portfolio concurrency constraint, 11 agents / build limit 6).

## Scope

- 42 API routes under `src/app/api/**/route.ts`
- Diff since last `/qa-security` (2026-08-02): ~60 commits — allergen phase-3 reference tables/routes, F86–F90 kitchen/pantry-close features (sous-chef, cook-feedback, palate profile, meal-plan orchestrate), password complexity + admin-forced password change, FOU-424 structured-lane routing, FOU-347 CSP nonce (already shipped report-only), FOU-355 global rate-limit floor (already shipped), dependency bumps (26 prod + 6 dev), and a large seeding/`ai-batch.ts` rewrite (Azure/DeepSeek "ds lane", batchMap worker pool) that touches `scripts/` only, not runtime app code
- Focus per sprint brief: image upload handling (vision lane), SSRF via remote image/recipe URLs, storage ACLs, the allergen annotation path, and whether the allergen disclaimer is actually rendered
- IDOR heuristic applied against `prisma/schema.prisma` on every `[id]`-parametrized route
- `npm audit`

## Findings by severity

### HIGH — 1 (deferred, upstream-blocked)

**H-1. `deepmerge-ts <8.0.0` — stack exhaustion (GHSA-ggr8-5vv4-36mx), transitive via `prisma@7.9.1` → `@prisma/config`.**
- `npm audit fix --force` would downgrade to `prisma@6.12.0` — a breaking major downgrade of the migration/client toolchain. Not applied.
- Dev/CLI-only surface (`@prisma/config`, not `@prisma/client`'s runtime bundle) — not reachable from any deployed route, but recorded at the advisory's own HIGH severity per policy.
- Same recurrence pattern as the now-closed FOU-239 (prisma-dev-tooling transitive dep blocked behind a breaking downgrade). Filed as **FOU-453** rather than reopening FOU-239, since the prior fix (7.9.0 → 7.9.1) genuinely cleared that batch and this is a fresh advisory.

### Fixed this run — 1

**F-1. `nanoid <3.3.18` — indefinite loop on `size: 0` (GHSA-2v37-7h3g-55p8), transitive via `@tailwindcss/postcss` → `postcss`.**
- `npm audit fix` (non-breaking) applied: `nanoid` bumped, lockfile-only change (`package.json` untouched, `git diff --stat` shows only `package-lock.json`, 42 insertions / 55 deletions from re-resolution). Removed 7 packages, changed 99, no dependency-tree surprises.
- Verified with `npx prisma generate && npx tsc --noEmit` — clean.
- `npm audit` before: 4 high (deepmerge-ts, nanoid). After: 3 (deepmerge-ts chain only).

### Areas verified clean (no findings)

**Vision lane / image upload (`/api/recipes/analyze-photo`)**
- Auth-gated (401 if no session), rate-limited via `aiLimiter.check(ip)`.
- Size cap: rejects >5MB before reading the buffer.
- MIME allowlist: validates the browser-supplied `photo.type` against `['image/jpeg','image/png','image/webp','image/gif']` rather than trusting the client's type assertion — malformed/unsupported uploads are rejected before the Gemini call.
- No filesystem write / storage ACL surface at all — the image never touches disk or a bucket; it's base64-inlined directly into the Gemini vision call and the JSON result is cached by SHA-256 of the raw bytes (`recipe-cache`). No SSRF surface here — no remote URL fetch, the input is a direct multipart upload.
- Minor non-security note: the route gates on `process.env.ANTHROPIC_API_KEY` before calling `geminiFlashVision` (a Google model) — looks like a stale copy-paste guard from a sibling allergen route rather than checking the Google key this path actually needs. Not a vulnerability (fails closed, just on the wrong variable), left as-is since fixing it is a functional/product call, not a security fix.

**SSRF (`/api/recipes/import`, the only remote-URL-fetching route)**
- `src/lib/ssrf.ts`'s `isValidUrl()` blocks `localhost`, `0.0.0.0`, `*.localhost`, `*.local`, the GCP metadata hostname, IPv6 loopback/unique-local/link-local, and IPv4 in all four textual encodings (dotted, 32-bit decimal, octal, hex) against RFC1918/loopback/link-local/multicast ranges.
- Fetch uses `redirect: 'manual'` and re-validates the `Location` header through the same `isValidUrl()` before following a single hop — a 30x to `http://localhost/` cannot bypass the initial check.
- 15s abort timeout, response size implicitly capped by an 80k-char HTML truncation before the AI call.
- Known accepted limitation (unchanged from prior audits): hostname blocklist, not DNS-resolution-time checking, so a DNS-rebinding attack (a public hostname that later resolves to a private IP) isn't covered. Documented in the file's own comment; not new, not fixed this run — no report of it being exploited and closing it requires a resolve-then-connect rewrite that's a larger change than this sweep's scope.

**Allergen annotation path / paid-model routing**
- `hasAllergenRestriction()` in `src/lib/ai.ts` matches a fixed enumerated set (`nut-free`, `dairy-free`, `gluten-free`, `egg-free`, `soy-free`, `shellfish-free`, `fish-free`, `sesame-free`, etc.) plus a substring fallback (`.includes('allerg')`, `.includes('celiac')`) so free-text custom restrictions still escalate.
- `safetyModel()` fails closed — throws if `ANTHROPIC_API_KEY` is unset rather than silently falling back to a free lane.
- `dietaryModel(restrictions, ctx)` is the only entry point that applies restrictions, and it's the one imported by all 7 AI routes that touch ingredient decisions: `generate`, `cook`, `substitute`, `convert-diet`, `modify`, `chat`, `save-variant` (the last two escalate specifically because they can rewrite ingredients from AI output, `save-variant`'s "substitution" branch is pure data-transform with no AI call at all). This list is unchanged from the 2026-08-02 audit's sweep — no route added since then bypasses it.
- New F86–F90 routes checked for the same class: `sous-chef` (Q&A only, explicitly instructed "never invent an ingredient/temperature", uses the free broker — accepted for v1, it's advisory not prescriptive), `cook-feedback` (tip generation from user-reported outcome, no ingredient substitution), `meal-plan/orchestrate` (re-sequences existing saved recipes' own steps, invents no new ingredients) — none of these apply a *new* dietary restriction to ingredient content, so none need the paid lane under the existing rule. If that's judged too permissive for sous-chef specifically (verbal advice mid-cook is arguably allergen-adjacent), that's a product-scope call, not something to change unilaterally in a security sweep — noted, not filed as its own issue since FOU-321 ("Remove AI allergen clearance; keep flagging + disclaimer only") already covers the broader allergen-scope-and-liability question and is open.

**Allergen disclaimer rendering**
- `AllergenDisclaimer` (`src/components/allergen-disclaimer.tsx`) renders on: `/ingredients/[slug]`, `/allergens`, `/allergens/[slug]`, the public recipe share page `/r/[slug]`, the recipe detail page, the print view, and the dietary-profile settings section — 8 render sites total. Confirmed actually rendered, not just imported-and-unused.
- Both the full and `compact` variants explicitly name the two failure modes a model can't see (misclassification, cross-contamination) and tell severe-allergy users not to rely on it.

**IDOR heuristic — all `[id]`-parametrized routes checked against `prisma/schema.prisma`**
- Every mutation/read on `Recipe`, `RecipeCollection`, `RecipeCompletion`, `PantryItem`, `MealPlan`/`MealPlanSlot`, `DietaryProfile`, `PalateProfile` either filters `where: { id, userId: session.user.id }` directly, or loads-then-compares ownership (`PantryItem`, `MealPlanSlot` via its parent `mealPlan.userId`) before mutating.
- New F86–F90 routes follow the same pattern: `cook-feedback` explicitly comments the IDOR guard ("a completion row belonging to another user must 404, not 200 — both userId and recipeId come from the session/URL, never the request body"); `meal-plan/orchestrate` uses the `findMany(... userId ...)` count-mismatch trick (any id belonging to another user simply isn't returned, and a length mismatch 404s the whole request) instead of per-id checks.
- Admin routes (`/api/admin/users/[id]/require-password-change`, `/api/admin/scripts/[name]/run`, `/api/admin/trigger-cron`) all gate on `session.user.isAdmin === true` before touching anything; the script runner additionally requires an explicit `export const adminRunnable = true` opt-in per script (FOU-399) and regex-validates the script name before path-joining.

**Auth / headers / secrets**
- `grep` for hardcoded API keys, tokens, and connection strings — none found outside `process.env.*`.
- No `Access-Control-Allow-Origin` anywhere (no CORS surface exposed) — same-origin only, correct for this app's shape.
- Security headers (HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy) set in both `next.config.ts` and middleware. CSP is nonce-based and still intentionally report-only (FOU-347 rollout note — not a regression, matches the documented soak plan).
- `dangerouslySetInnerHTML` — 4 usages, all through `safeJsonLdString()` for JSON-LD structured data. Safe.
- `/api/user/password`: bcrypt-compares current password before allowing change, enforces `password-policy.ts` schema + contextual checks (not similar to email/name), revokes sibling sessions, clears `mustChangePassword`, audit-logs the event.

## Systemic Fix Exception

No single change resolved ≥5 findings this run — only 2 findings total (1 fixed, 1 deferred), both in the same dependency-audit class but each requiring a different remediation path (one non-breaking, one blocked on a breaking downgrade), so no systemic fix applies.

## Summary

- 2 issues found: 1 HIGH (deferred, dev-tooling-only dependency, upstream-blocked), 1 HIGH (fixed, non-breaking lockfile bump)
- 1 fixed in place (`npm audit fix` — nanoid)
- 1 deferred to **FOU-453**
- Vision/upload lane, SSRF guard, allergen paid-model routing, and disclaimer rendering all verified clean — no regressions since the 2026-08-02 audit despite ~60 intervening commits
- Fast gate (`prisma generate && tsc --noEmit`): PASS
