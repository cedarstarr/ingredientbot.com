# IngredientBot — Feature Index

## ✅ Built
- ✅ F01 Split-panel kitchen at `/kitchen` [Hook]
- ✅ F02 AI recipe generation [Hook]
- ✅ F03 Recipe detail pages with structured data [Core]
- ✅ F04 Photo-based recipe analysis [Hook]
- ✅ F05 Recipe modification system + modification toolbar [Sticky]
- ✅ F06 Saved recipes collection [Sticky]
- ✅ F07 Meal planner with weekly slots [Sticky]
- ✅ F08 Grocery list sheet (generated from recipes) [Sticky]
- ✅ F09 Recipe search and filtering [Core]
- ✅ F10 Dashboard [Core]
- ✅ F11 Settings page [Core]
- ✅ F12 Admin panel (users, audit logs, scripts, AI debug) [Core]
- ✅ F13 Auth (credentials-only, public signup, email verification, password reset) [Core]
- ✅ F14 Email system (welcome, verify, password reset via ZeptoMail) [Core]
- ✅ F15 Welcome drip cron job [Sticky]
- ✅ F16 Error boundary, loading skeleton, rate limiting [Core]
- ✅ F17 Cookie consent banner + Plausible analytics [Core]
- ✅ F18 Notification preferences (marketing, product) [Core]
- ✅ F19 Sign out all devices [Core]
- ✅ F20 Email change flow [Core]
- ✅ F21 Audit logging [Core]
- ✅ F22 Health check API [Core]
- ✅ F23 Sitemap + robots.txt + OpenGraph image [Core]

---

## Competitive Intelligence

### Mainstream Competitors
| Competitor | Tier | Core Value Prop | The Moat | The Gap | User Complaints |
|------------|------|-----------------|----------|---------|-----------------|
| AllRecipes | established | Largest recipe community | SEO + UGC flywheel + brand | No AI, user must search | Ads everywhere, hard to trust ratings |
| NYT Cooking | established | Editorial quality recipes | Brand prestige + subscriber base | No AI generation, no ingredient-first flow | Paywalled, expensive subscription |
| Yummly | established | Personalized recipe recommendations | Whirlpool acquisition + data | Mediocre AI, no real-time generation | Recommendations feel random |

### Niche/Indie Competitors
| Competitor | Tier | Core Value Prop | The Moat | The Gap | User Complaints |
|------------|------|-----------------|----------|---------|-----------------|
| Supercook | niche | Ingredient-based recipe search | Indexed recipe corpus | No AI generation, just search | Limited to what's in database |
| ChefGPT | niche | AI recipe generation | First-mover AI recipe brand | No streaming, clunky UX | Slow, no split-panel workflow |

---

## Strategic Position
**The Moat:** AllRecipes and NYT Cooking own the recipe corpus and SEO. You can't out-index them.
**The Gap:** No mainstream recipe app starts from "what's in my fridge" and generates a real recipe in real time with streaming AI. The ingredient-first, AI-native flow is unclaimed.
**Our Angle:** ingredientbot wins the "I have stuff, what do I make?" moment that search-based apps fail at completely.

---

## Build Roadmap

### 🔴 Table Stakes — must-haves before launch
- F01 **Split-panel kitchen** [MEDIUM]
- F02 **AI recipe generation** [MEDIUM]
- F13 **Auth** [MEDIUM]
- F03 **Recipe detail pages** [SMALL]
- F09 **Recipe search and filtering** [SMALL]

### 🟡 Low-Hanging Fruit — high value, fast wins
- F04 **Photo-based recipe analysis** [MEDIUM]
- F06 **Saved recipes collection** [SMALL]
- F07 **Meal planner with weekly slots** [MEDIUM]
- F08 **Grocery list sheet** [SMALL]

### 🟢 Differentiators — what makes you stand out
- F05 **Recipe modification system** [MEDIUM]
- F02 **AI recipe generation (two-model strategy)** [MEDIUM]
- F04 **Photo-based recipe analysis** [MEDIUM]

### 🔵 Moonshots — complex long-term bets
- Pantry inventory system — users track what they have on hand; kitchen generates recipes from their live pantry state rather than a one-off ingredient list [LARGE]
- Nutrition tracking over time — aggregate nutrition data across saved recipes and meal plans into weekly/monthly summaries [LARGE]
- Ingredient substitution suggestions — when a recipe calls for something the user doesn't have, Claude suggests substitutes and regenerates [MEDIUM]

### ❌ Traps — explicitly skipping
- Grocery e-commerce / store integration — Amazon and Instacart own this; supply chain complexity with zero margin
- Meal kit delivery integration — logistics and partnerships required; not a software problem
- Building a recipe social network — AllRecipes already owns this and it takes years of UGC to matter

---

## Core App

F01. **Split-panel kitchen at `/kitchen`** — Ingredient input + streaming AI recipe suggestions. The primary entry point: left panel accepts a free-form list of ingredients, right panel streams a generated recipe in real time. [Hook] [Req: heavy compute, Edge runtime] (Feasibility: already built)

F02. **AI recipe generation** — claude-sonnet-4-6 for full recipes, claude-haiku-4-5 for per-ingredient comments (quick, cheap responses). Two-model strategy balances quality vs. latency/cost. [Hook] [Req: heavy compute] (Feasibility: already built)

F03. **Recipe detail pages** — Structured data display: ingredients list, step-by-step instructions, nutrition estimate, prep/cook time, and a modifications panel. [Core] [Req: Prisma model] (Feasibility: already built)

F04. **Photo-based recipe analysis** — `POST /api/recipes/analyze-photo` accepts an image upload and uses Claude vision to identify ingredients and suggest matching recipes. [Hook] [Req: heavy compute, R2/storage] (Feasibility: already built)

F05. **Recipe modification system** — `POST /api/recipes/[id]/modify` + a toolbar on the recipe page for one-click modifications (make it vegan, double the servings, simplify for beginners, etc.). Modifications stored as a JSON array on the Recipe model. [Sticky] [Req: Prisma model, heavy compute] (Feasibility: already built)

F06. **Saved recipes collection** — `/saved` page listing all recipes the user has saved, with search and filter. [Sticky] [Req: Prisma model] (Feasibility: already built)

F07. **Meal planner with weekly slots** — `/meal-plan` calendar grid where users assign saved recipes to breakfast/lunch/dinner slots for each day of the week. [Sticky] [Req: Prisma model] (Feasibility: already built)

F08. **Grocery list sheet** — Auto-generated ingredient list from the active meal plan. Rendered as a checklist sheet. [Sticky] [Req: Prisma model] (Feasibility: already built)

F09. **Recipe search and filtering** — Search across saved recipes by name, cuisine, dietary tags, or ingredients used. [Core] [Req: Prisma model] (Feasibility: already built)

F10. **Dashboard** — `/dashboard` landing after login: quick stats, recent recipes, meal plan preview, and shortcut to the kitchen. [Core] [Req: Prisma model] (Feasibility: already built)

F11. **Settings page** — `/settings` with account management: profile info, notification prefs, email change, sign out all devices, 2FA (once built), delete account. [Core] [Req: Prisma model] (Feasibility: already built)

F12. **Admin panel** — Admin-only routes for user management, audit log viewer, scripts runner, and AI debug (raw prompt/response inspection). [Core] [Req: Prisma model] (Feasibility: already built)

F13. **Auth** — Credentials-only public signup, email verification, password reset. No OAuth in MVP. [Core] [Req: none] (Feasibility: already built)

F14. **Email system** — Transactional emails via ZeptoMail: welcome, email verification, password reset. [Core] [Req: API integration] (Feasibility: already built)

F15. **Welcome drip cron job** — Scheduled email sequence for new signups introducing core features. [Sticky] [Req: cron, API integration] (Feasibility: already built)

F16. **Error boundary, loading skeleton, rate limiting** — Global error boundary, per-page skeleton loaders, and API rate limiting on AI endpoints. [Core] [Req: none] (Feasibility: already built)

F17. **Cookie consent banner + Plausible analytics** — EU-aware consent gate using `x-vercel-ip-country`; Plausible is enabled only after consent. [Core] [Req: none] (Feasibility: already built)

F18. **Notification preferences** — Users opt in/out of marketing and product emails. PATCH `/api/user/notifications`. [Core] [Req: Prisma model] (Feasibility: already built)

F19. **Sign out all devices** — `sessionsRevokedAt` timestamp approach: invalidates all existing JWTs on demand. [Core] [Req: Prisma model] (Feasibility: already built)

F20. **Email change flow** — Three-step flow: request new email → verify via token link → update record. Handles edge cases (token expiry, already-in-use email). [Core] [Req: Prisma model] (Feasibility: already built)

F21. **Audit logging** — `AuditLog` model records key security events: login, signup, password reset, password change, email change. [Core] [Req: Prisma model] (Feasibility: already built)

F22. **Health check API** — `GET /api/health` returns DB connectivity and uptime. Used by Vercel and monitoring tools. [Core] [Req: none] (Feasibility: already built)

F23. **Sitemap + robots.txt + OpenGraph image** — Static sitemap for public pages, robots.txt, and a custom OG image for social sharing. [Core] [Req: none] (Feasibility: already built)

---

## ❌ Traps

- Grocery e-commerce / store integration — Amazon and Instacart own this; supply chain complexity with zero margin
- Meal kit delivery integration — logistics and partnerships required; not a software problem
- Building a recipe social network — AllRecipes already owns this and it takes years of UGC to matter
