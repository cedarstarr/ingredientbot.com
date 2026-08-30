# Recipe Library Audit — 2026-08-29

Scope: the public recipe library (`isPublic` + `publicSlug`) on **staging** (Neon, synced 2026-08-29). Production was not queried (needs explicit permission). Read-only analysis of all 998 rows plus the code paths that render them (`/recipes`, `/r/[slug]`, `sitemap.ts`, `seed-public-recipes-ai.ts`).

## Verdict

The library is in good shape. All 998 planned dishes (50 cuisines) exist, owned by `library@ingredientbot.com`. Zero duplicate titles or slugs, zero truncated descriptions or steps, nutrition on every recipe, allergen annotation on every recipe, raw text present everywhere. The two real defects are **cuisine label drift (24 recipes)** and **section headers stored as ingredient rows (12 recipes)**.

---

## Errors found

### 1. Cuisine label drift — 24 recipes (HIGH, user-visible)

The seeder trusts the model's `cuisine` string instead of stamping the `DEFAULT_DISHES` key it prompted with. `/recipes` groups by exact string, so the browse page shows junk sections: an "ethiopian" section of 4 beside "Ethiopian" (16), three different spellings of Southern US, lowercase one-offs for 12 cuisines. Every canonical bucket that reads "short" (Ethiopian 16/20, Southern US 16/20, Tex-Mex 18/20…) is explained by these strays — no dish actually failed to seed.

Full list (slug → stored label):

| Slug | Stored | Should be |
|---|---|---|
| gored-gored, fosolia-green-bean-stew, alicha-tibs-mild-beef, yebeg-wat-lamb-stew | ethiopian | Ethiopian |
| chicken-and-dumplings | American Southern | Southern US |
| biscuits-and-sausage-gravy | Southern United States | Southern US |
| deviled-eggs-southern-style | American (Southern) | Southern US |
| okra-and-tomatoes | southern-us | Southern US |
| chile-relleno-tex-mex-style, bunuelos-tex-mex | tex-mex | Tex-Mex |
| tom-yum-goong | thai | Thai |
| lechon-asado-with-mojo | cuban | Cuban |
| xiaolongbao-soup-dumplings | chinese | Chinese |
| lebanese-lentil-soup | lebanese | Lebanese |
| nem-ran-fried-spring-rolls | vietnamese | Vietnamese |
| sukiyaki | japanese | Japanese |
| jjajangmyeon-black-bean-noodles | korean | Korean |
| kuih-lapis | malaysian | Malaysian |
| tinga-de-pollo | mexican | Mexican |
| herring-under-a-fur-coat | russian | Russian |
| jachnun-yemeni-pastry | israeli | Israeli |
| matbucha-tomato-pepper-salad | Israeli, North African | Israeli |
| thiakry-millet-pudding | West African | Senegalese |
| braai-lamb-chops | south-african | South African |

Also: "American" holds 21 (one Southern US stray likely absorbed).

**Fix (two parts):**
1. Data: one idempotent normalization script (24 `update`s by slug). Safe to re-run.
2. Seeder: in `seed-public-recipes-ai.ts`, overwrite the generated `cuisine` with the `DEFAULT_DISHES` key before insert, so future batches can't drift.

### 2. Section headers stored as ingredient rows — 12 recipes, 19 rows (MEDIUM)

Rows like `"For the broth and tare"` / `"For assembly"` with empty amount+unit sit in `recipeData.ingredients` (worst: miso-ramen with 4). On `/r/[slug]` they render as ordinary bullets with a dangling checkbox — reads like a broken ingredient. Options, in preference order:
1. Render any amount-less row matching `/^for /i` as a subheading in the ingredient list (keeps the data's structure, fixes all current and future cases).
2. Or flatten them out of the data and lose the grouping.

### 3. Not errors — verified plausible (leave alone)

- 19 recipes have amount-less "for serving / to taste / garnish" rows — legitimate.
- 4 recipes with total time > 10h (injera, Texas brisket, jachnun, cholent) — correct for those dishes; the card just shows e.g. "4340 min". **Improvement:** format ≥90 min as hours on cards.
- Servings 24–36 on candy/cookie recipes (lokum, melomakarona, rugelach) — batch yields, fine.
- Pisco sour macros don't sum to calories — alcohol calories, correct.
- Torshi at 18 kcal — pickles, correct.

### 4. `nutrition.fiber` is 0/998 (LOW)

The seeder generates only calories/protein/carbs/fat, but `/r/[slug]` and its Recipe structured data both support fiber. Either backfill fiber in a future batch or drop it — current state is consistent, just a missed schema.org field.

---

## Code findings (found while auditing)

1. **`seed-public-recipes-ai.ts` runs `main()` on import — no entrypoint guard.** Importing `DEFAULT_DISHES` from another script executes the seeder. This audit tripped it: the run inserted 0, skipped all 998 as existing, and made **zero AI calls** (the idempotence check runs before generation), but a guard (`if (process.argv[1]?.endsWith('seed-public-recipes-ai.ts'))` or moving the dish list to a data module) removes the hazard.
2. **Sitemap cap is nearly hit: `take: 1000` with 998 recipes.** The next content batch silently drops recipes from the sitemap. Raise the cap or split into sitemap index files now — the code comment already predicts this.
3. **The 50 cuisine listing pages aren't in the sitemap.** Each `/recipes?cuisine=X` view self-canonicalizes and is independently indexable, but nothing tells crawlers they exist beyond in-page links. Add them to `sitemap.ts` (cheap: derive from the same groupBy).
4. **`/recipes` reads `searchParams`, so `export const revalidate = 3600` is dead** — the page is dynamically rendered on every hit (two DB queries each). Options: split the cuisine view to `/recipes/[cuisine]` segments (also gives cleaner indexable URLs), or accept the cost at current traffic.
5. **The 120-row cap on the filtered view** is safe at ≤21 per cuisine — no action, noted for the next library expansion.

---

## Library improvement recommendations

### Missing browse axes (the real "missing categories")

Cuisine is the only navigation axis, but the tag data already supports three more, all strong SEO pages:

| Axis | Data already present |
|---|---|
| Dietary | gluten-free 157 · vegetarian 140 · vegan 71 · dairy-free 43 |
| Meal type | dessert 61 · breakfast 54 · appetizer 89 · soup 69 · side dish 65 · snack 42 |
| Speed | "quick" 82 + "quick dinner" 43; or compute total ≤ 30 min |

Recommendation: add a tag-filtered view (`/recipes?tag=vegan` mirroring the cuisine pattern) for a curated ~12-tag allowlist, with sections on the overview page. Do **not** add allergen-absence filters ("nut-free") — that contradicts the three-state allergen honesty rule; contains/may-contain data is unverified single-model annotation.

### Tag hygiene

1,763 distinct tags across 998 recipes — a long tail of near-synonyms (`quick` / `quick dinner` / `weeknight dinner`; `southern` / `eastern european` duplicating cuisine). If tags become a browse axis, normalize against a controlled vocabulary at seed time (same stamp-don't-trust fix as cuisine). Until then they only feed meta keywords, so cost is zero.

### Difficulty skew

604 medium / 372 easy / 22 hard. Fine editorially, but a difficulty filter would look broken with 22 "hard" results; if difficulty becomes a filter, either accept it or rebalance prompts in future batches.

### Cuisine roster gaps (only if expanding beyond 998)

Coverage of 50 cuisines is genuinely broad. Notable absences if a future batch expands: Caribbean beyond Cuba/Jamaica (Trinidad, Haiti, Puerto Rico), Cambodian, Afghan, Balkan (Serbian/Bosnian/Romanian), Tunisian/Algerian, Central Asian (Uzbek), Bangladeshi/Nepali, Chilean/Venezuelan, Ghanaian/Kenyan. West African and Yemeni dishes currently squat in other buckets (thiakry → Senegalese, jachnun → Israeli), which is acceptable.

---

## Suggested action order

1. Normalize the 24 drifted cuisines + stamp cuisine from the dish-list key in the seeder (unblocks a clean browse page).
2. Raise/split the sitemap recipe cap and add the 50 cuisine pages.
3. Ingredient-section-header rendering on `/r/[slug]`.
4. Entrypoint guard on `seed-public-recipes-ai.ts`.
5. Dietary/meal-type tag browse (new feature — belongs in FEATURES.md before building).
6. Hours formatting for long cook times.

---

## Resolution — branch `fix/recipe-library-audit` (2026-08-29)

All six items actioned. Data changes are **staging only**; production was never queried or written.

| # | Item | Outcome |
|---|---|---|
| 1 | Cuisine drift | **25** rows normalized on staging (not 24 — see below); seeder now stamps the canonical key at insert |
| 2 | Sitemap | Recipe + ingredient caps raised 1000 → 10000; 50 cuisine listing pages added via `groupBy` |
| 3 | Ingredient headers | `isIngredientHeading()` renders "For the broth…" rows as subheadings and drops them from the `recipeIngredient` JSON-LD |
| 4 | Entrypoint guard | `main()` now behind `require.main === module`, matching the repo's existing idiom |
| 5 | Tag browse | Filed as **F92** in FEATURES.md (🛠 planned) with its two prerequisites; not built |
| 6 | Long cook times | `formatDuration()` on both `/recipes` cards and `/r/[slug]` — "4340 min" now reads "72 hr 20 min" |

**The count was 25, not 24.** The normalization script joins on `publicSlug` against the seeder's own dish list rather than matching label spellings, which caught one case the original audit could not see: `red-beans-and-rice` was stored as `"American"` — a perfectly canonical label, just the wrong one, since the dish list files it under Cajun. That also explains the American=21 / Cajun=19 split noted above. Label-shape checks cannot find this class of error; the slug join can.

New files: `scripts/normalize-recipe-cuisines.ts` (idempotent, `--dry-run`, verified re-run reports 0 changes), `src/lib/recipe-format.ts` + unit tests.

**Still open — production.** Whether production carries the same 25 drifted labels is unknown. Running the normalization script there is a separate decision for Cedar; it is idempotent and non-destructive, and `--dry-run` will report the true count without writing.
