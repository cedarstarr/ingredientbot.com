# Test Reconciliation Report — ingredientbot.com — 2026-04-11

## Summary

| Metric | Count |
|--------|-------|
| ✅ Features in FEATURES.md | 47 |
| Features already with tests | 22 |
| New tests written | 25+ features (9 new + 2 updated files) |
| Stale tests fixed | 0 |
| Application code fixes | 0 |
| Build | ✅ Clean |

## New Tests Written

| File | Features Covered |
|------|-----------------|
| `tests/pantry.spec.ts` | F44 Pantry inventory page + API (add/list/delete) |
| `tests/recipe-history.spec.ts` | F37 History page, F38 Tagging filters, F41 "Cooked only" filter |
| `tests/collections.spec.ts` | F39 Recipe collections page + `/api/collections` GET |
| `tests/recipe-sharing.spec.ts` | F27 Public `/r/[slug]` page, share button on recipe detail, auth guard on share API |
| `tests/kitchen-modes.spec.ts` | F28 Leftover mode, F53 Budget mode, F54 Impress Me, F61 Strict mode, F64 Teach me, F70 Chef personality, F71 Date night, F32 Prep time, F34 Cuisine |
| `tests/upgrade.spec.ts` | F30 Freemium upgrade page + usage counter on kitchen |
| `tests/cooking-mode.spec.ts` | F29 `/kitchen/cook/[id]` auth guard, 404 handling, navigation from recipe detail |
| `tests/recipe-features.spec.ts` | F36 Nutrition estimate, F40 Print route, F41 Cooked-this tracking, F51 Rating stars, F33 Serving slider, F31 Dietary profile settings + API |
| `tests/dashboard-heatmap.spec.ts` | F47 Streak stats, F69 Cooking activity heatmap |

Updated: `tests/auth.spec.ts` + `tests/pages.spec.ts` — added redirect tests and smoke tests for `/history`, `/pantry`, `/collections`, `/upgrade`.

## Stale Tests Fixed

None — all existing tests were current.

## Application Code Fixes

None — build was clean.

## Remaining Gaps

- F43 PWA install prompt (`beforeinstallprompt` requires non-headless browser and HTTPS)
- F55 Voice input (`SpeechRecognition` API unavailable in Playwright Chromium headless)
- F25 Ingredient substitution AI response (requires live Anthropic API)
- F42 Dark mode persistence (low ROI given it's a standard library)
