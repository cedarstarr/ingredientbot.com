# IngredientBot — Feature Index

## ✅ Built
- ✅ Split-panel kitchen at `/kitchen`
- ✅ AI recipe generation (claude-sonnet-4-6 for recipes, claude-haiku-4-5 for ingredient comments)
- ✅ Recipe detail pages with structured data (ingredients, steps, nutrition, modifications)
- ✅ Photo-based recipe analysis
- ✅ Recipe modification system + modification toolbar
- ✅ Saved recipes collection
- ✅ Meal planner with weekly slots
- ✅ Grocery list sheet (generated from recipes)
- ✅ Recipe search and filtering
- ✅ Dashboard
- ✅ Settings page
- ✅ Admin panel (users, audit logs, scripts, AI debug)
- ✅ Auth (credentials-only, public signup, email verification, password reset)
- ✅ Email system (welcome, verify, password reset via ZeptoMail)
- ✅ Welcome drip cron job
- ✅ Error boundary, loading skeleton, rate limiting
- ✅ Cookie consent banner + Plausible analytics
- ✅ Notification preferences (marketing, product)
- ✅ Sign out all devices
- ✅ Email change flow
- ✅ Audit logging
- ✅ Health check API
- ✅ Sitemap + robots.txt + OpenGraph image

---

## Core App

- ✅ **Split-panel kitchen at `/kitchen`** — Ingredient input + streaming AI recipe suggestions. The primary entry point: left panel accepts a free-form list of ingredients, right panel streams a generated recipe in real time.

- ✅ **AI recipe generation** — claude-sonnet-4-6 for full recipes, claude-haiku-4-5 for per-ingredient comments (quick, cheap responses). Two-model strategy balances quality vs. latency/cost.

- ✅ **Recipe detail pages** — Structured data display: ingredients list, step-by-step instructions, nutrition estimate, prep/cook time, and a modifications panel.

- ✅ **Photo-based recipe analysis** — `POST /api/recipes/analyze-photo` accepts an image upload and uses Claude vision to identify ingredients and suggest matching recipes.

- ✅ **Recipe modification system** — `POST /api/recipes/[id]/modify` + a toolbar on the recipe page for one-click modifications (make it vegan, double the servings, simplify for beginners, etc.). Modifications stored as a JSON array on the Recipe model.

- ✅ **Saved recipes collection** — `/saved` page listing all recipes the user has saved, with search and filter.

- ✅ **Meal planner with weekly slots** — `/meal-plan` calendar grid where users assign saved recipes to breakfast/lunch/dinner slots for each day of the week.

- ✅ **Grocery list sheet** — Auto-generated ingredient list from the active meal plan. Rendered as a checklist sheet.

- ✅ **Recipe search and filtering** — Search across saved recipes by name, cuisine, dietary tags, or ingredients used.

- ✅ **Dashboard** — `/dashboard` landing after login: quick stats, recent recipes, meal plan preview, and shortcut to the kitchen.

- ✅ **Settings page** — `/settings` with account management: profile info, notification prefs, email change, sign out all devices, 2FA (once built), delete account.

- ✅ **Admin panel** — Admin-only routes for user management, audit log viewer, scripts runner, and AI debug (raw prompt/response inspection).

- ✅ **Auth** — Credentials-only public signup, email verification, password reset. No OAuth in MVP.

- ✅ **Email system** — Transactional emails via ZeptoMail: welcome, email verification, password reset.

- ✅ **Welcome drip cron job** — Scheduled email sequence for new signups introducing core features.

- ✅ **Error boundary, loading skeleton, rate limiting** — Global error boundary, per-page skeleton loaders, and API rate limiting on AI endpoints.

- ✅ **Cookie consent banner + Plausible analytics** — EU-aware consent gate using `x-vercel-ip-country`; Plausible is enabled only after consent.

- ✅ **Notification preferences** — Users opt in/out of marketing and product emails. PATCH `/api/user/notifications`.

- ✅ **Sign out all devices** — `sessionsRevokedAt` timestamp approach: invalidates all existing JWTs on demand.

- ✅ **Email change flow** — Three-step flow: request new email → verify via token link → update record. Handles edge cases (token expiry, already-in-use email).

- ✅ **Audit logging** — `AuditLog` model records key security events: login, signup, password reset, password change, email change.

- ✅ **Health check API** — `GET /api/health` returns DB connectivity and uptime. Used by Vercel and monitoring tools.

- ✅ **Sitemap + robots.txt + OpenGraph image** — Static sitemap for public pages, robots.txt, and a custom OG image for social sharing.
