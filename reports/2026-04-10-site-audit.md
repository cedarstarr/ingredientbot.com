# Feature Audit — ingredientbot.com
**Date**: 2026-04-10
**Features scanned**: 40 | **Built**: 4 | **Partial**: 2 | **New**: 34

## Already Built (4)
| ID | Feature | Evidence |
|----|---------|----------|
| F34 | Cuisine selector | src/app/kitchen/ (cuisine dropdown in generation UI) |
| F35 | Difficulty selector | src/app/kitchen/ (difficulty level in recipe output) |
| F42 | Dark mode | src/components/theme-toggle.tsx (next-themes dark mode toggle) |
| F62 | Recipe URL import | src/app/api/recipes/import/route.ts (URL scrape + Claude reformat) |

## Partial — Enhancement Needed (2)
| ID | Feature | Existing code | What's missing |
|----|---------|---------------|----------------|
| F32 | Prep time filter | src/app/kitchen/page.tsx | Kitchen page UI exists; no "I have 20 minutes" prep time constraint control wired to generation |
| F33 | Serving size slider | prisma/schema.prisma (servings field on Recipe) | DB field exists; no slider UI that scales ingredient quantities proportionally |

## New (34)
| ID | Feature |
|----|---------|
| F26 | Expiry-first mode |
| F27 | Recipe sharing with public permalink |
| F28 | Leftover optimizer mode |
| F31 | Dietary profile (persistent) |
| F43 | PWA / offline saved recipes |
| F44 | Pantry inventory |
| F45 | Weekly meal plan email digest |
| F46 | Expiration date tracking |
| F47 | Recipe completion history + streak |
| F48 | Nutritional summary over time |
| F49 | Family profile (multi-eater) |
| F50 | Smart grocery list |
| F51 | Recipe rating (personal 1–5 stars) |
| F52 | Referral program |
| F53 | Budget mode |
| F54 | "Impress me" zero-input mode |
| F55 | Voice input for ingredients |
| F56 | Leftover photo mode |
| F57 | Recipe card PDF export |
| F58 | Weekly meal themes |
| F59 | Macro-targeting mode |
| F60 | "Make it faster" modifier |
| F61 | Strictness toggle |
| F63 | Ingredient cost estimate |
| F64 | "Teach me" verbose recipe mode |
| F65 | Cuisine trend feed |
| F66 | Dietary challenge mode |
| F67 | Smart pantry suggestions |
| F68 | Recipe complexity graph |
| F69 | Cooking history heatmap |
| F70 | AI chef personality toggle |
| F71 | "Date night" mode |
| F72 | Ingredient-to-cuisine mapper |
| F73 | Recipe video script generation |
