# Feature Audit — ingredientbot.com
Date: 2026-04-11
Features scanned: 37 | Built: 0 | Partial: 3 | New: 34

## Already Built (0)

_No previously-🛠 features were found to be fully built._

## Partial — Enhancement Needed (3)

| ID | Feature | Existing code | What's missing |
|----|---------|---------------|----------------|
| F31 | Dietary profile (persistent) | `src/components/kitchen/kitchen-panel.tsx` — session-level dietary dropdown (any / vegan / vegetarian / gluten-free / etc.) is wired into generate API | No `dietaryRestrictions` field on User model; no settings page section; resets on every page load |
| F33 | Serving size slider with live scaling | `src/components/ui/slider.tsx` (Radix Slider primitive exists); `src/components/recipe/recipe-detail-client.tsx` shows static servings count | No slider mounted on recipe detail; no ingredient quantity scaling logic |
| F57 | Recipe card PDF export | `src/components/recipe/print-recipe-view.tsx` — "Print / Save PDF" browser print button exists | No server-side or client-side PDF generation library; relies entirely on browser print dialog |

## New (34)

| ID | Feature |
|----|---------|
| F26 | Expiry-first mode |
| F27 | Recipe sharing with public permalink |
| F28 | Leftover optimizer mode |
| F43 | PWA / offline saved recipes |
| F44 | Pantry inventory (persistent) |
| F45 | Weekly meal plan email digest |
| F46 | Expiration date tracking |
| F47 | Recipe completion history + streak |
| F48 | Nutritional summary over time (weekly/monthly) |
| F49 | Family profile (multi-eater with different restrictions) |
| F50 | Smart grocery list (missing items vs pantry state only) |
| F51 | Recipe rating (personal 1–5 stars) |
| F52 | Referral program (extra credits) |
| F53 | Budget mode (prefer cheaper ingredient combos) |
| F54 | "Impress me" zero-input generation mode |
| F55 | Voice input for ingredients |
| F56 | Leftover photo mode (snap leftovers, AI detects contents) |
| F58 | Weekly meal themes ("Taco Tuesday + Pasta Wednesday") |
| F59 | Macro-targeting mode |
| F60 | "Make it faster" modifier (<15 min constraint) |
| F61 | Strictness toggle |
| F63 | Ingredient cost estimate |
| F64 | "Teach me" verbose recipe mode |
| F65 | Cuisine trend feed |
| F66 | Dietary challenge mode (7-day structured programs) |
| F67 | Smart pantry suggestions |
| F68 | Recipe complexity graph |
| F69 | Cooking history heatmap |
| F70 | AI chef personality toggle |
| F71 | "Date night" mode (3-course menu from your pantry) |
| F72 | Ingredient-to-cuisine mapper |
| F73 | Recipe video script generation |
| F32 | Prep time filter (already had [ENHANCE] annotation — no additional evidence found) |
| F50 | Smart grocery list (meal-plan slot API exists but no pantry-diff logic) |

---

## Notes

- **F31 partial**: A dietary dropdown is wired into the kitchen panel and passed to `/api/recipes/generate`, but it is per-session only. The User model has no `dietaryRestrictions` field and the Settings page has no dietary section.
- **F33 partial**: `src/components/ui/slider.tsx` (Radix UI) is present but not used in recipe detail. Servings are displayed as a static number. No scaling math exists.
- **F57 partial**: `print-recipe-view.tsx` exposes a "Print / Save PDF" button that triggers the browser print dialog. This is not a proper PDF export — no jsPDF, pdfkit, or Puppeteer integration exists.
- **F55 (Voice input)**: `src/proxy.ts` explicitly blocks microphone access via `Permissions-Policy: microphone=()`. Implementing voice input will require removing this restriction.
- **F56 (Leftover photo mode)**: `/api/recipes/analyze-photo` already exists (F04, marked ✅). F56 describes a distinct "leftover-specific framing" mode — no prompt variant or separate UI for this exists.
