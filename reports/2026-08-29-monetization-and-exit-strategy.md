# IngredientBot — Monetization and Exit Strategy

**Date:** 2026-08-29
**Question asked:** how do we make money with this site, with the end goal of selling it to a competitor?
**Short answer:** the revenue path is real but currently blocked by a missing payment rail; the "sell to a competitor" exit is not, and aiming at it will cost you the exit that *is* available.

---

## 1. Where the site actually stands

Facts, measured on 2026-08-29 (staging database, production is access-gated):

| Asset / blocker | State |
|---|---|
| Public recipe pages | 998 |
| Ingredient glossary pages | 364 |
| Cuisine listing pages | 50 |
| Total indexable pages | **1,412** (sitemap emits 1,420 including static) |
| Allergen glossary rows | **0** — the `/allergens` feature is built but unseeded |
| Payment processor | **None installed** — no Stripe, Paddle, or equivalent |
| Free-tier cap | **Enforced**, 5 recipes/month, HTTP 402 |
| Way to pay to lift the cap | **None** |
| `isPremium` / `plan` field on `User` | **Does not exist** |
| Production access gate | `COMING_SOON` set for **127 days** |
| Analytics | Plausible configured |
| Domain | `ingredientbot.com`, created 2026-04-06 |

### The single most damaging fact

`FREE_TIER_LIMIT = 5` is enforced in `src/app/api/recipes/cook/route.ts:71` and `src/app/api/recipes/[id]/save-variant/route.ts:110`. `/upgrade` renders marketing copy and no checkout.

**Every engaged user hits a hard wall on recipe #6 with no way through, and you cannot even comp someone manually — there is no field on `User` to mark them paid.** This is worse than having no monetization at all: it is a mechanism that selects precisely the users who like the product and then ejects them. Fix this before launching, not after.

---

## 2. Why "sell it to the competition" is the wrong target

An AI recipe generator's core mechanism is a prompt. SuperCook, DishGen, ChefGPT, Mealime, and Crumb can each reproduce your generation logic in a week. **Nobody buys an AI wrapper for its technology.**

Strategic acquirers buy one of four things:

1. **Revenue** — you have none, and no way to collect any.
2. **Users / distribution** — you have none; the site has been dark for 127 days.
3. **A team** — not applicable to a solo portfolio site.
4. **Technology or IP** — a prompt and a Next.js app. Not defensible.

There is a fifth thing competitors occasionally buy, which is a **brand or domain** they don't want a rival to have. That is real but rare and unpredictable.

The structural problem: the strategic-acquirer market for this asset has perhaps five plausible buyers, none of whom are shopping. Building toward them means building toward a market of five.

### The exit that actually exists

**Content-site aggregators and marketplace buyers** — Empire Flippers, Motion Invest, Flippa, and the private portfolio buyers who work those channels. This market has hundreds of active buyers and a published, formulaic valuation: roughly **30–45× monthly net profit**, conditional on **6–12 months of verifiable traffic and revenue history** (industry convention, not a quote — actual multiples move with niche, traffic source concentration, and how much of the work is owner-dependent).

This reframing is the most valuable thing in this document, because it *simplifies* the plan rather than complicating it:

> Every buyer type — aggregator, competitor, or private buyer — pays for the same thing: a verifiable record of traffic and revenue. So there is exactly one strategy, and it is not exit-shaped. It is "make the thing earn, and keep receipts."

Stop optimizing for an acquisition. An acquisition is a *consequence* of the numbers, never a substitute for them.

---

## 3. The risk that could zero the whole thesis

**998 AI-generated recipes, in the most competitive SEO niche on the internet, against Google's scaled-content-abuse policy.**

Three compounding problems:

1. **Policy risk.** Google's spam policies explicitly target content generated at scale primarily to manipulate rankings. A 998-page AI recipe library is a textbook shape for that classifier, whatever its actual quality.
2. **Competitive density.** Recipe search is owned by AllRecipes, Serious Eats, NYT Cooking, and a very long tail of food bloggers with a decade of backlinks, real photography, and E-E-A-T signals you do not have.
3. **No differentiating signal.** The library has no original photography, no author identity, no first-hand testing claims — the exact signals Google's helpful-content guidance rewards.

**Plan accordingly: do not bet the strategy on the content library ranking.** If it ranks, excellent, that's the aggregator exit. If it does not, the content asset is worth approximately zero and the domain is the salvage value. Treat organic traffic as a hypothesis to be tested cheaply and fast, not an assumption.

A mitigation worth considering: the **ingredient glossary (364 pages)** is a genuinely better SEO bet than the recipes. "What can I substitute for X", "how to store X", "is X gluten free" are lower-competition, higher-intent queries, and glossary content reads less like scaled spam than 998 full recipes do. If any part of the content asset ranks, it will probably be this part.

---

## 4. Recommended plan — a 90-day test, not a build-out

The goal of the next 90 days is **not** to grow. It is to cheaply answer one question: *can this site acquire users and earn money at all?* Spending six months building features before answering that is the expensive mistake.

### Phase 1 — Unblock (this week)

1. **Install Stripe and wire `/upgrade` to a real checkout.** Add `isPremium` (or `plan` + `stripeCustomerId`) to `User`. The usage cap and the 402 already exist; only the door is missing. This is roughly a day's work and *nothing else on this list matters until it is done*.
2. **Remove `COMING_SOON`.** A gated site earns nothing and — more importantly — accrues no traffic history, which is the asset every future buyer is actually paying for. Every dark day is a day not counted.
3. **Seed the allergen glossary.** `/allergens` is built, sitemapped, and backed by an empty table. Right now it is a live page serving nothing.

### Phase 2 — Monetize on two independent rails (weeks 2–4)

Do not rely on subscriptions alone. At the traffic levels realistically available in 90 days, a $5–7/month subscription on a handful of users is not a business — but it *is* a signal, and signals are what you are buying with this quarter.

| Rail | Why it fits | What it needs |
|---|---|---|
| **Subscription** | The cap already exists; pricing pressure is proven in this niche (ChefGPT gates at 10/mo, DishGen at $159/yr) | Stripe + `isPremium` |
| **Affiliate** | Ingredient-first content converts naturally to grocery and equipment; no traffic threshold to start | Amazon Associates; grocery-delivery partner programs |

Affiliate is the higher-expected-value rail here, for a reason specific to your goal: **it earns on anonymous traffic**, which is the traffic you will actually have. A subscription requires signup, activation, and retention — three conversion steps you have no users to push through yet.

### Phase 3 — Measure honestly (day 90)

Three numbers decide everything:

- **Organic sessions/month** from Plausible.
- **Indexed pages** in Search Console (register the property — this is also how you find out early if Google is ignoring the library).
- **Net revenue/month.**

**Decision rule, set in advance so it cannot be rationalized later:** if organic sessions are still near zero at day 90, the SEO thesis has failed. Do not spend another quarter on it. Sell the domain and redeploy the time.

---

## 5. The floor value

`ingredientbot.com` is a clean, brandable, exact-category `.com` — short, pronounceable, obviously on-topic, no hyphens or numbers. **That is a liquid asset independent of whether the product ever works**, and it is why the downside here is genuinely capped.

Do not let it lapse, and do not bundle it into a fire-sale of the codebase. If the 90-day test fails, the domain is the thing you sell, and it is worth more on its own than a failed app attached to it.

---

## 6. What this means for engineering priorities

The recipe library work already done (audit, cuisine normalization, sitemap, structured data) was correct and is now finished. **Further content-library polish is not the constraint.** The constraint is that there is no checkout and no audience.

Concretely, deprioritize until after Phase 1: F92 tag browse, fiber backfill, tag-vocabulary normalization, and any further recipe generation. None of them move a number that a buyer will ever look at.

---

*Facts in section 1 were measured against the staging database on 2026-08-29. Production was not queried. Valuation multiples are industry convention, not quotes.*
