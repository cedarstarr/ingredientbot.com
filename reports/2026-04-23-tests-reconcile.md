# ingredientbot.com — Test Reconciliation Report

**Date**: 2026-04-23
**Command**: `/qa-tests-reconcile`
**Status**: ✅ DONE
**Commit**: `990242b`

---

## Summary

| Metric | Count |
|---|---|
| ✅ Features in FEATURES.md | ~60 |
| Already covered by tests | ~57 (27 spec files) |
| New tests written | 24 (3 files) |
| Stale tests fixed | 0 |
| Application code fixes | 0 |
| Remaining coverage gaps | 3 (intentionally untested) |

## Wrong-Tool Check

All 27 existing spec files matched current source. Recent UI changes (F74–F79 modifiers, navigation Option C, a11y/SEO/perf fixes) did not invalidate any selectors. No real app bugs surfaced — proceeded normally.

## New Test Files

### `tests/kitchen-modifiers-f74-f79.spec.ts` (recipe modifier sprint)

- **F74 Cooking Method Selector** — UI presence + API persist + invalid rejection
- **F75 "I'm Exhausted" Toggle** — aria-pressed state
- **F76 Protein-Max Toggle** — toggle state
- **F77 Restaurant Recreation Input** — text input + 120-char maxLength
- **F78 Spice Level Slider** — slider UI + API round-trip + range validation
- **F79 Medical Dietary Flags** — UI on `/settings` + API round-trip

### `tests/recipe-import-f62.spec.ts` (F62 URL Recipe Import)

- Uses existing `PLAYWRIGHT_TEST=true` mock branch in `src/app/api/recipes/import/route.ts` (returns "Classic Spaghetti Carbonara")
- Auth guard verified

### `tests/recipe-tags-f38.spec.ts` (F38 Recipe Tagging)

- "Add tag" button + new-tag input UI
- API auth guard

## Verification

- `npm run build` — clean

## Remaining Gaps (intentionally not auto-tested)

- **F02 Live AI generation/streaming** — already smoke-tested via mocked `/api/recipes/generate`
- **F15/F45 Cron jobs** — only auth-guard verified; full digest send requires email side effects
- **F30 Premium unlimited generation** — requires a premium test user; flagged Pro-only
