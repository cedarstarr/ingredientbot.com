# Ingredient Bot — Site Research Synthesis
**Date**: 2026-04-09
**Niche**: AI pantry-to-recipe generator — streaming recipe suggestions from ingredients you have

---

## Synthesis Method

Started with 150 raw features across 3 lists (50 each: mainstream competitors, niche/indie competitors, pure first-principles). Deduplication cut 150 to ~70 unique concepts. Further cut to ~50 by removing: features already built, grocery e-commerce traps, social network features, and anything requiring third-party API partnerships (loyalty cards, smart appliances). Final 50 tagged and prioritized.

---

## Tag Definitions

| Tag | Meaning |
|-----|---------|
| Hook | First-impression feature that gets users to sign up or share |
| Core | Table-stakes functionality every competing app has |
| Sticky | Retention driver — brings users back daily/weekly |
| Vibe | Differentiator or personality feature, not table-stakes |

---

## Deduplication Decisions

- "Ingredient input" collapsed from 8 variations → F01 (split-panel already built)
- "Dietary filters" + "allergy profile" + "dietary profile" → single F-series entry
- "Pantry inventory" + "pantry state persistence" → F-series (partial, not full)
- "Recipe saving" already built (F06), skipped
- "Meal planner" already built (F07), skipped
- "Grocery list" already built (F08), skipped
- "Voice input" — not built, kept as standalone
- "Serving size slider" + "recipe scaling" → merged one
- "Recipe sharing / public permalink" — not built, kept
- "Social network / follow other cooks" — explicitly trapped, removed
- "Grocery loyalty card sync" — trapped (Cooklist's moat, requires US partnership)
- "Smart appliance integration" — trapped (SideChef's partnership moat)

---

## Cuts Made (and Why)

| Feature | Why Cut |
|---------|---------|
| Grocery e-commerce / store integration | Cooklist's moat; supply chain trap |
| Loyalty card sync | US-only partnerships, zero margin |
| Creator monetization / tipping | Social network trap |
| Community recipe library | AllRecipes/Cookpad already own this |
| Smart kitchen device integration | SideChef's moat; not a software problem |
| Multi-language generation | Scope creep; low priority for MVP |
| Ingredient cost estimate | Requires price feed data, not static |
| Season/availability hints | Nice-to-have, Claude can estimate without real data |
| "What's missing?" analysis | Supercook's exact moat; we're AI-native, not database |
| Cocktail/mocktail generation | Feature bloat; different use case |
| Wine pairing | Same — ChefGPT's gimmick, not core |

---

## Final 50 Features by Tag

### Hook (7)
| ID | Feature | Why Hook |
|----|---------|----------|
| F24 | Recipe regeneration | One-click "try again" is addictive — no other app nails this |
| F25 | Ingredient substitution suggestions | Proactively solves the "I don't have X" moment during generation |
| F26 | Expiry-first mode | Emotionally resonant — save food before it goes bad |
| F27 | Recipe sharing (public permalink) | Virality mechanism — users share AI-generated recipes to social |
| F28 | Leftover optimizer | "Last night's roast chicken + these pantry items" is a real daily use case |
| F29 | Cooking mode | Full-screen step-by-step with screen-on; competitors all miss this |
| F30 | Freemium gate + Pro upgrade | Convert casual visitors; DishGen and ChefGPT both validate this model |

### Core (13)
| ID | Feature | Why Core |
|----|---------|----------|
| F31 | Dietary profile (persistent preferences) | Every competitor has this; without it you lose dietary-restricted users |
| F32 | Prep time filter | "I have 20 minutes" is one of the most common cooking constraints |
| F33 | Serving size slider | Recipe scaling is expected; missing it causes friction at 1am cooking |
| F34 | Cuisine selector | Quick prefix modifier ("make it Thai") dramatically improves relevance |
| F35 | Difficulty selector | Beginners abandon complex recipes; this gates appropriate generation |
| F36 | Nutrition estimate per recipe | Every competitor has calorie/macro info; it's expected now |
| F37 | Recipe history | Full archive of every generated recipe — search and re-access |
| F38 | Recipe tagging (auto + manual) | Organize the cookbook as it grows; search by cuisine/protein/method |
| F39 | Recipe collections/folders | Named boards — "weeknight dinners", "date night", "kid-friendly" |
| F40 | Print recipe view | Clean print-friendly layout; older demographics need this |
| F41 | Recipe completion tracking | Mark "cooked this" — builds history and improves recommendations |
| F42 | Dark mode | Universal expectation in 2025; already standard across the portfolio |
| F43 | PWA / offline saved recipes | Install on mobile home screen; view saved recipes without signal |

### Sticky (10)
| ID | Feature | Why Sticky |
|----|---------|----------|
| F44 | Pantry inventory (persistent, tracked) | Daily driver — users maintain their pantry and generate from it; not just one-off sessions |
| F45 | Weekly meal plan email digest | Monday morning nudge; brings users back; drip email already in place |
| F46 | Expiration date tracking | Users check in to manage expiry; panic-cooking is a high-frequency use case |
| F47 | Recipe completion history + streak | Gamification; "you've cooked 12 new recipes this month" drives retention |
| F48 | Nutritional summary over time | Weekly roll-up from meal planner — value compounds over time |
| F49 | Family profile (multi-eater) | Households cook for 2–6 people with different needs; this is the "whole household" hook |
| F50 | Grocery list → missing items only | Smarter than current implementation: shows only what's missing vs pantry state |
| F51 | Recipe rating (personal, 1–5 stars) | "Your favorites" list surfaces over time; drives revisit |
| F52 | Referral program | Extra recipe credits for referring friends; virality + retention |
| F53 | Budget mode | Prefer cheaper ingredient combos; cost-of-living anxious users respond strongly |

### Vibe (20)
| ID | Feature | Why Vibe |
|----|---------|----------|
| F54 | "Impress me" mode | Zero-input generation; AI picks ingredients based on season/mood — curiosity-driven |
| F55 | Voice input for ingredients | Hands-free pantry scanning; Crumb found it popular; differentiates on mobile |
| F56 | Leftover photo mode | Snap your leftovers container, AI figures out what's in it |
| F57 | Recipe card PDF export | Shareable, beautiful printable card — feels premium |
| F58 | Weekly meal themes | "Taco Tuesday + Pasta Wednesday" — AI generates themed week plans |
| F59 | Macro-targeting mode (MacrosChef-style) | Generate recipes hitting specific protein/carb targets — gym-goer niche |
| F60 | "Make it faster" modifier | Reduce cook time to under 15 min by substituting methods or ingredients |
| F61 | "Make it with what you have" strictness toggle | Strict: only what I listed. Flexible: assume common pantry staples (oil, salt, etc.) |
| F62 | Recipe URL import | Paste any recipe URL, AI saves and reformats it into your cookbook |
| F63 | Ingredient cost estimate (rough) | Approx cost per serving based on typical ingredient prices — no live data needed |
| F64 | "Teach me" recipe mode | Extra verbose instructions, with "why" explanations (why sear before braise, etc.) |
| F65 | Cuisine trend feed | Weekly "try this cuisine" suggestion based on what's popular or seasonal |
| F66 | Dietary challenge mode | "7-day Mediterranean challenge" — structured program using the meal planner |
| F67 | Smart pantry suggestions | "You often cook Italian but never have basil — add it?" proactive nudges |
| F68 | Recipe complexity graph | Visualize your cookbook by ease/time/cuisine — see your cooking patterns |
| F69 | Cooking history heatmap | GitHub-style contribution graph of "days cooked" — gamified habit tracking |
| F70 | AI chef personality toggle | Friendly home cook vs. strict French chef vs. street food vendor tone |
| F71 | "Date night" mode | Generates a 3-course menu from your pantry — dessert included |
| F72 | Ingredient-to-cuisine mapper | "You have miso and sesame oil — here are 8 Japanese dishes you can make" |
| F73 | Recipe video generation stub | Placeholder: generate a "recipe video script" from a saved recipe — AI-native future feature |

---

## Priority Order

**Build next (MVP gap-fillers):**
F24 → F25 → F27 → F29 → F31 → F32 → F33 → F34 → F35 → F36 → F37 → F44 → F46

**High-value retention adds (post-MVP):**
F45 → F47 → F48 → F49 → F50 → F51 → F52 → F30

**Differentiators (makes the product feel alive):**
F26 → F28 → F55 → F61 → F64 → F59 → F66

**Nice-to-have / long tail:**
F54, F56, F57, F58, F60, F62, F63, F65, F67–F73

---

## Market Gap Summary

**The core gap no competitor fully owns**: Streaming, AI-native, ingredient-first recipe generation with a split-panel kitchen UX. SuperCook does ingredient-first but is pure database matching. DishGen and ChefGPT do AI generation but with clunky UX and no streaming. Crumb is closest but mobile-only with no web power-user story.

**ingredientbot.com's wedge**: Own the power-user web kitchen experience. The split-panel streaming UI is the moat. Layer pantry persistence and dietary profile on top, and users stop going to ChatGPT for recipes.

