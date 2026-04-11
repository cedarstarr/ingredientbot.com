# Ingredient Bot — Feature Index

**Vision**: The definitive AI-native kitchen — enter what you have, stream a recipe instantly, then shape it to your exact taste.

**Last Updated**: 2026-04-09

---

## ✅ Built

- ✅ F01 Split-panel kitchen at `/kitchen` [Hook]
- ✅ F02 AI recipe generation (streaming, claude-sonnet-4-6 + claude-haiku-4-5) [Hook]
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
- ✅ F24 Recipe regeneration (one-click "try again") [Hook]
- ✅ F25 Ingredient substitution suggestions [Hook]
- ✅ F29 Cooking mode (full-screen step-by-step, screen-on) [Hook]
- ✅ F30 Freemium gate + Pro upgrade [Hook]
- ✅ F36 Nutrition estimate per recipe [Core]
- ✅ F37 Recipe history (full archive, searchable) [Core]
- ✅ F38 Recipe tagging (auto by cuisine/protein/method + manual) [Core]
- ✅ F39 Recipe collections/folders [Core]
- ✅ F40 Print recipe view [Core]
- ✅ F41 Recipe completion tracking ("cooked this") [Core]

## 🛠 Planned / In Progress

- 🛠 F26 Expiry-first mode [Hook]
- 🛠 F27 Recipe sharing with public permalink [Hook]
- 🛠 F28 Leftover optimizer mode [Hook]
- 🛠 F31 Dietary profile (persistent preferences across all generations) [Core]
- 🛠 F32 Prep time filter [Core]
- 🛠 F33 Serving size slider with live scaling [Core]
- ✅ F34 Cuisine selector [Core]
- ✅ F35 Difficulty selector [Core]
- ✅ F42 Dark mode [Core]
- 🛠 F43 PWA / offline saved recipes [Core]
- 🛠 F44 Pantry inventory (persistent, tracked between sessions) [Sticky]
- 🛠 F45 Weekly meal plan email digest [Sticky]
- 🛠 F46 Expiration date tracking [Sticky]
- 🛠 F47 Recipe completion history + streak [Sticky]
- 🛠 F48 Nutritional summary over time (weekly/monthly) [Sticky]
- 🛠 F49 Family profile (multi-eater with different restrictions) [Sticky]
- 🛠 F50 Smart grocery list (missing items vs pantry state only) [Sticky]
- 🛠 F51 Recipe rating (personal 1–5 stars) [Sticky]
- 🛠 F52 Referral program (extra credits) [Sticky]
- 🛠 F53 Budget mode (prefer cheaper ingredient combos) [Sticky]
- 🛠 F54 "Impress me" zero-input generation mode [Vibe]
- 🛠 F55 Voice input for ingredients [Vibe]
- 🛠 F56 Leftover photo mode (snap leftovers, AI detects contents) [Vibe]
- 🛠 F57 Recipe card PDF export [Vibe]
- 🛠 F58 Weekly meal themes ("Taco Tuesday + Pasta Wednesday") [Vibe]
- 🛠 F59 Macro-targeting mode (generate recipes hitting protein/carb targets) [Vibe]
- 🛠 F60 "Make it faster" modifier (<15 min constraint) [Vibe]
- 🛠 F61 Strictness toggle (only listed ingredients vs assume pantry staples) [Vibe]
- ✅ F62 Recipe URL import (paste any recipe URL, AI reformats it) [Vibe]
- 🛠 F63 Ingredient cost estimate (rough per-serving cost, no live data) [Vibe]
- 🛠 F64 "Teach me" verbose recipe mode (explains the why) [Vibe]
- 🛠 F65 Cuisine trend feed (weekly "try this cuisine" suggestion) [Vibe]
- 🛠 F66 Dietary challenge mode (7-day structured programs) [Vibe]
- 🛠 F67 Smart pantry suggestions (proactive "you often cook X, add Y?") [Vibe]
- 🛠 F68 Recipe complexity graph (visualize cookbook by ease/time/cuisine) [Vibe]
- 🛠 F69 Cooking history heatmap (GitHub-style contribution graph) [Vibe]
- 🛠 F70 AI chef personality toggle (home cook / French chef / street food vendor tone) [Vibe]
- 🛠 F71 "Date night" mode (3-course menu from your pantry) [Vibe]
- 🛠 F72 Ingredient-to-cuisine mapper (miso + sesame oil → 8 Japanese dishes) [Vibe]
- 🛠 F73 Recipe video script generation (AI-native future feature) [Vibe]

---

## Recommended MVP (Build First)

> Build these 12 features to close the gap between built and launchable v1.

- F30 **Freemium gate + Pro upgrade** — without monetization there's no product
- F31 **Dietary profile** — table stakes; competitors all have it; without it you lose dietary-restricted users immediately
- F33 **Serving size slider** — scaling recipes is a basic cooking need; missing it causes daily friction
- F36 **Nutrition estimate per recipe** — every competing app provides this; absence is conspicuous
- F24 **Recipe regeneration** — "try again" is the most addictive UI primitive in the category; differentiates instantly
- F29 **Cooking mode** — full-screen step-by-step with screen-on; competitors all miss it; high-delight unlock
- F27 **Recipe sharing (public permalink)** — virality mechanism; shared recipes bring new users without paid acquisition
- F32 **Prep time filter** — "I have 20 minutes" is the #1 real-world cooking constraint; generation without it feels arbitrary
- F34 **Cuisine selector** — quick modifier ("make it Thai") dramatically improves relevance and user confidence
- F25 **Ingredient substitution suggestions** — proactively solves the "I don't have X" drop-off moment during generation
- F44 **Pantry inventory** — the shift from "one-off session" to "daily tool"; the key retention unlock
- F37 **Recipe history** — users need to find a recipe they generated 3 days ago; without history the app feels disposable

---

## Mainstream Competitors

| Competitor | Key Strengths | User Complaints | Gap to Exploit |
|------------|--------------|-----------------|----------------|
| **SuperCook** | 11M+ indexed recipes, ingredient-first discovery, entirely free, voice dictation, 20 languages | Database-matching only (no AI generation), stale results, no quality ranking, can't filter by cooking equipment, occasional ingredient hallucination | AI-native generation vs. index lookup — we create novel recipes, not just match to corpus |
| **DishGen** | Strong prompt-to-recipe AI, meal planning, personalized profile, image generation (Pro), recipe sharing | Credits drain fast, no streaming UX, clunky interface, expensive Pro tier ($159/yr), no split-panel design | Streaming split-panel vs. wait-then-show; generation quality per dollar |
| **ChefGPT** | Multi-mode AI (PantryChef/MacrosChef/MealPlanChef), calorie tracking, AmazonFresh integration | Web app deprecated (mobile-only), severely limited free tier (10/mo), too many modes feel gimmicky, no streaming | Web power-user story; we keep our web app; cleaner UX without 6 branded "Chef modes" |
| **Cooklist** | Loyalty card sync auto-imports pantry, barcode scanner, real-time price comparison, expiry tracking | US loyalty programs only (privacy concern), complex setup, not an AI generation tool, steep pricing | We don't need grocery partnerships; ingredient-first AI is cleaner than purchase-history inference |
| **Mealime** | Clean meal planning UI, shopping lists, allergen filtering, family support, nutritional totals | Not ingredient-first — you pick recipes then shop; weak AI personalization; feels dated vs AI-native apps | Ingredient-first workflow is fundamentally different; Mealime is shop-then-cook, we're have-then-cook |

---

## Niche/Vibe Competitors

| Competitor | What Makes Them Different | User Praise | Gap to Exploit |
|------------|--------------------------|-------------|----------------|
| **Crumb** | Voice-first ingredient input, "Try Again" instant regeneration, sustainability framing, mobile-native clean UX | Fast, fun, waste-conscious; voice input feels natural | Mobile-only; no web power-user story; no pantry persistence; no meal planning |
| **PantryCook** | Camera + voice + manual ingredient entry, expiry tracking baked in, kid-friendly filter | All-in-one pantry ecosystem; multi-input flexibility | Unclear pricing; limited web presence; no streaming generation; early-stage polish |
| **RecipeGen AI** | No account required for basic use, minimal friction, clean card output | Low barrier to try | No persistence, no meal planning, no dietary profile; a toy more than a tool |
| **Cookii** | Community remixing — take any recipe and AI-transforms it; ingredient substitution built-in | Creative; social angle; substitution suggestions feel natural | Social network features are a growth trap; their core insight (ingredient substitution) we can absorb |
| **MyAIChef / Be My Chef** | Strong allergen/chronic condition profiles, serving size input at generation time, nutritional breakdown | Good for dietary-restricted users | No pantry state; starts fresh every session; no streaming; no meal planning integration |

---

## Core Product

F01. **Split-panel kitchen at `/kitchen`** [Hook] — Left panel: ingredient list input. Right panel: streaming AI recipe in real time. The primary entry point and the defining UX innovation of the product. Competitors show a loading spinner; we show the recipe forming word by word. (Feasibility: built)

F02. **AI recipe generation (two-model strategy)** [Hook] — claude-sonnet-4-6 for full recipe generation, claude-haiku-4-5 for lightweight per-ingredient comments. Balances quality vs. latency/cost. Streaming via Edge runtime. (Feasibility: built)

F03. **Recipe detail pages** [Core] — Structured recipe view: ingredients list with quantities, numbered steps, estimated prep/cook time, difficulty, nutrition estimate. Schema.org Recipe structured data for SEO. (Feasibility: built)

F04. **Photo-based recipe analysis** [Hook] — POST /api/recipes/analyze-photo — Claude vision identifies ingredients from a fridge/counter photo and generates matching recipes. No pantry manual entry required. (Feasibility: built)

F05. **Recipe modification system** [Sticky] — POST /api/recipes/[id]/modify + one-click toolbar: make it vegan, double servings, simplify for beginners, spice it up, make it faster. Modifications stored as JSON array on Recipe model. (Feasibility: built)

F06. **Saved recipes collection** [Sticky] — /saved page listing every recipe the user has generated and kept, with search and filter. The personal cookbook. (Feasibility: built)

F07. **Meal planner with weekly slots** [Sticky] — /meal-plan calendar grid. Assign saved recipes to breakfast/lunch/dinner for each day of the week. (Feasibility: built)

F08. **Grocery list sheet** [Sticky] — Auto-generated ingredient list from the active meal plan, rendered as a checklist. Current version aggregates all ingredients. F50 (smart list) will diff against pantry state. (Feasibility: built)

F09. **Recipe search and filtering** [Core] — Full-text search across saved recipes by name, cuisine, dietary tags, or ingredients used. (Feasibility: built)

F24. **Recipe regeneration** [Hook] — One-click "Try again" to get a completely different recipe from the same ingredient set without re-entering anything. The single highest-delight UX unlock in the category — Crumb popularized it on mobile; we bring it to the web kitchen. (Feasibility: Medium — new API call + UI state management)

F25. **Ingredient substitution suggestions** [Hook] — During or after generation, proactively show "you don't have X — use Y instead" inline. Reduces generation abandonment when users are missing one ingredient. Cookii built this as a remix feature; we make it a native part of generation. (Feasibility: Medium — Claude prompt engineering + UI callout component)

F29. **Cooking mode** [Hook] — Full-screen step-by-step recipe view with tap-to-advance, progress indicator, and screen-wake-lock API to prevent the phone from sleeping mid-recipe. Every competitor ships recipe detail but none ship cooking mode. This is a high-delight unlock. (Feasibility: Medium — Wake Lock API + step navigation UI)

F30. **Freemium gate + Pro upgrade** [Hook] — Free tier: N recipe generations per month. Pro: unlimited generations + premium features. Validated by DishGen ($72/yr), ChefGPT ($2.99/mo), and the broader SaaS niche. Required for monetization. (Feasibility: Medium — generation counter + Stripe integration)

F36. **Nutrition estimate per recipe** [Core] — Calories, protein, carbs, fat, fiber per serving calculated by Claude from the ingredient list. Every competitor offers this; absence is conspicuous. Displayed on recipe detail page and in cooking mode. (Feasibility: Low — Claude can estimate from ingredients during generation)

F37. **Recipe history** [Core] — Full paginated archive of every recipe a user has generated, with timestamp, ingredients used, and search. Without history the app feels disposable — users need to recover the recipe they generated 3 days ago. (Feasibility: Low — already stored in DB, needs history page UI)

---

## Differentiators

F26. **Expiry-first mode** [Hook] — Flag ingredients expiring soon and tell Claude to prioritize using them. "Spinach expires tomorrow — generate a recipe that uses it up." Emotionally resonant; reduces household food waste guilt. Requires pantry inventory (F44) with expiry dates (F46). (Feasibility: Medium — depends on F44+F46 being built first)

F27. **Recipe sharing (public permalink)** [Hook] — Every saved recipe gets a public URL. Share to Twitter/Instagram/iMessage. Virality mechanism: each shared recipe is an ad for ingredientbot. No other ingredient-first AI app has a shareable recipe URL that doesn't require signup to view. (Feasibility: Low — public route + access control on recipe model)

F28. **Leftover optimizer mode** [Hook] — "I have leftover roast chicken from last night plus these pantry items — what do I make?" Explicit "leftovers" framing changes the generation prompt to prioritize using yesterday's remainder before it goes off. (Feasibility: Low — UX framing + prompt variant)

F31. **Dietary profile (persistent)** [Core] — [ENHANCE: src/components/kitchen/kitchen-panel.tsx] Store dietary restrictions, allergies, and preferences on the user account. Applied to every generation so users never have to repeat "I'm vegan" or "no nuts." Table stakes for all competitors; absence immediately alienates dietary-restricted users. Session-level dietary dropdown exists in kitchen panel but is not persisted to the User model or settings page. (Feasibility: Low — user profile field + prompt injection)

F44. **Pantry inventory (persistent)** [Sticky] — A managed list of what's in your kitchen that persists between sessions. The kitchen page pre-fills from your pantry; you add/remove items as you shop and cook. This shifts ingredientbot from a "one-off session" tool to a "daily cooking OS." (Feasibility: Medium — new Prisma model + inventory management UI)

F55. **Voice input for ingredients** [Vibe] — Web Speech API: tap a mic button, speak your ingredients naturally. "chicken, garlic, some leftover rice, and I think I have coconut milk." Hands-free pantry scanning is especially valuable on mobile when your hands are full. Crumb built this on mobile; we bring it to the web. (Feasibility: Low — Web Speech API, no backend change)

F61. **Strictness toggle** [Vibe] — Two modes: Strict (only use exactly what I listed) vs. Flexible (assume user has common staples: oil, salt, pepper, garlic, onion). Solves a real frustration — users who list "chicken and vegetables" and get a recipe requiring 12 more ingredients. (Feasibility: Low — prompt variant toggle in UI)

F64. **"Teach me" verbose recipe mode** [Vibe] — Optional mode where Claude explains the why behind each step. "Why do you sear the chicken before braising? Because..." Differentiates ingredientbot as an educational kitchen companion, not just a recipe vending machine. (Feasibility: Low — prompt modifier)

---

## Growth & Retention

F33. **Serving size slider** [Core] — [ENHANCE: src/components/recipe/recipe-detail-client.tsx] 1–12 servings; all ingredient quantities scale proportionally. Basic expectation of any recipe app; missing it creates daily friction. Slider UI component exists (src/components/ui/slider.tsx) and servings display is present in recipe-detail-client.tsx, but no live scaling logic is wired up. (Feasibility: Low — math on ingredient quantities, UI slider)

F45. **Weekly meal plan email digest** [Sticky] — Monday morning email summarizing the week's planned meals from the meal planner. Brings users back to the app to check or adjust. The welcome drip (F15) is already built; this is a new recurring cron. (Feasibility: Low — new cron + email template, drip infrastructure already exists)

F47. **Recipe completion history + streak** [Sticky] — "You've cooked 12 new recipes this month" with a streak count for consecutive days cooked. Gamified habit tracking; the GitHub contribution graph for cooking. Drives daily app opens. (Feasibility: Medium — completion tracking model + streak calculation)

F48. **Nutritional summary over time** [Sticky] — Weekly and monthly roll-up of nutrition data from completed recipes in the meal planner. "This week you averaged 2,100 kcal/day." Value compounds over time — users who see their patterns stay longer. (Feasibility: Medium — requires F36 + F41 first)

F49. **Family profile (multi-eater)** [Sticky] — Multiple dietary profiles in one account. "Generate one dinner that works for a vegan adult and a picky 7-year-old." The household cooking use case is underserved by every competitor except Mealime (and Mealime doesn't do AI generation). (Feasibility: Medium — user profile schema extension)

F51. **Recipe rating (personal 1–5 stars)** [Sticky] — Rate saved recipes; "Your favorites" auto-surfaces top-rated recipes. Simple feedback loop that makes the cookbook more useful over time. (Feasibility: Low — rating field on Recipe model + UI)

F52. **Referral program** [Sticky] — Share a link; both user and referee get bonus recipe credits. Standard referral loop. DishGen lets users earn credits via social shares; we do it via direct referral. Portfolio referral system pattern already established. (Feasibility: Medium — referral model already in portfolio pattern)

F53. **Budget mode** [Sticky] — Prefer ingredient combinations that are cheaper at typical grocery prices. "I want to keep this meal under $8." Cost-of-living anxiety is real; this positioning resonates with budget-conscious users who cook at home to save money. (Feasibility: Low — Claude prompt modifier, no live pricing data needed for rough guidance)

---

## Admin & Ops

F10. **Dashboard** [Core] — /dashboard landing after login: quick stats, recent recipes, meal plan preview, kitchen shortcut. (Feasibility: built)

F11. **Settings page** [Core] — /settings: profile info, dietary profile (F31), notification prefs, email change, sign out all devices, delete account. (Feasibility: built — dietary profile not yet added)

F12. **Admin panel** [Core] — /admin: user management, audit log viewer, scripts runner, AI debug (raw prompt/response inspection). (Feasibility: built)

F13. **Auth** [Core] — Credentials-only public signup, email verification, password reset. (Feasibility: built)

F16. **Rate limiting on AI endpoints** [Core] — Prevents abuse of expensive claude-sonnet API calls. Per-IP and per-user limits. (Feasibility: built)

F21. **Audit logging** [Core] — AuditLog model records key security events: login, signup, password reset, email change. (Feasibility: built)

F22. **Health check API** [Core] — GET /api/health returns DB connectivity and uptime. (Feasibility: built)

F23. **Sitemap + robots.txt + OpenGraph image** [Core] — Static sitemap for public pages; custom OG image for social sharing; robots.txt. (Feasibility: built)

---

## Nice-to-Haves

F32. **Prep time filter** [Core] — [ENHANCE: src/app/kitchen/page.tsx] "I have 20 minutes" constrains generation to quick recipes. Most common cooking constraint after dietary restrictions. (Feasibility: Low — prompt modifier + UI toggle)

✅ F34. **Cuisine selector** [Core] — "Make it Thai / Italian / Mexican" prefix. Quick modifier that dramatically improves relevance and gives users agency over generation direction. (Feasibility: Low — prompt modifier + UI dropdown)

✅ F35. **Difficulty selector** [Core] — Beginner / Intermediate / Advanced. Beginners abandon complex recipes; this gates appropriate generation from the start. (Feasibility: Low — prompt modifier)

F54. **"Impress me" zero-input mode** [Vibe] — No ingredients entered; Claude picks seasonal/interesting ingredients and generates a recipe. Curiosity-driven discovery; good for users who want inspiration rather than pantry-clearance. (Feasibility: Low — empty-pantry prompt variant)

F57. **Recipe card PDF export** [Vibe] — [ENHANCE: src/components/recipe/print-recipe-view.tsx] Generate a beautifully formatted PDF of a recipe card for offline printing and sharing. A browser "Print / Save PDF" button already exists in print-recipe-view.tsx; a true PDF export (e.g. via a server-side PDF library) is not yet implemented. (Feasibility: Small — server-side PDF generation or print stylesheet polish)

F58. **Weekly meal themes** [Vibe] — "Taco Tuesday, Pasta Wednesday, Stir-Fry Thursday" — AI generates a themed week plan using your pantry. Makes meal planning feel fun rather than administrative. (Feasibility: Low — meal planner prompt variant)

✅ F62. **Recipe URL import** [Vibe] — Paste any recipe URL; Claude scrapes and reformats it into the cookbook. Helps users centralize all their recipes in one place. (Feasibility: Medium — Jina/scraper + Claude parsing)

F65. **Cuisine trend feed** [Vibe] — Weekly "try this cuisine" suggestion on the dashboard. Low-effort discovery nudge; keeps the app from feeling like a static utility. (Feasibility: Low — curated or Claude-generated weekly card)

F69. **Cooking history heatmap** [Vibe] — GitHub contribution-graph style visualization of "days cooked" on the dashboard. Gamified habit tracking visual; high engagement for habitual cookers. (Feasibility: Low — date-based query on completion events + SVG grid render)

F70. **AI chef personality toggle** [Vibe] — Friendly home cook / strict French chef / street food vendor. System prompt variant changes tone and vocabulary of all generated recipes. Cheap to build, high delight. (Feasibility: Low — system prompt variant selection)

F71. **"Date night" 3-course mode** [Vibe] — From your pantry, generate a full 3-course menu: starter, main, dessert. A high-emotion cooking moment; great for viral sharing (F27). (Feasibility: Low — structured multi-recipe generation prompt)

---

## ❌ Traps

- **Grocery e-commerce / store integration** — Cooklist's moat; supply chain partnerships with zero margin for an indie app
- **Grocery loyalty card sync** — US-only, requires partnerships, major privacy concern in user research
- **Meal kit delivery integration** — Logistics and fulfillment; not a software problem
- **Building a recipe social network** — AllRecipes/Cookpad own this; requires years of UGC to matter; community remix features are a trap
- **Smart kitchen device integration** — SideChef's partnership moat; not buildable without hardware APIs
- **AI-generated recipe images for every recipe** — DishGen Pro charges $159/yr partly for this; generation cost is too high for a per-recipe feature
- **Cocktail / wine pairing modes** — Different use case; ChefGPT's gimmick; dilutes the pantry-to-meal focus

