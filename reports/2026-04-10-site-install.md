# ingredientbot.com — Site Install Report
**Date**: 2026-04-10
**Branch**: feat/install-2026-04-09
**Section**: All sections

## Features Built (10 DONE)

| # | Feature | Status |
|---|---------|--------|
| F24 | Recipe regeneration (one-click "try again") | DONE |
| F25 | Ingredient substitution suggestions | DONE |
| F29 | Cooking mode (full-screen step-by-step) | DONE |
| F30 | Freemium gate + Pro upgrade | DONE |
| F36 | Nutrition estimate per recipe | DONE |
| F37 | Recipe history (full archive, searchable) | DONE |
| F38 | Recipe tagging (auto + manual) | DONE |
| F39 | Recipe collections/folders | DONE |
| F40 | Print recipe view | DONE |
| F41 | Recipe completion tracking ("cooked this") | DONE |

## Agent Batches

- **Batch A** (schema): tags String[], cookedCount, lastCookedAt on Recipe; RecipeCollection model; /history, /collections pages; tag chips; "Cooked this" button
- **Batch B** (UX): F24 "Try Again" button, F25 SubstitutionPanel (already existed — verified+marked), F29 Cooking Mode (/kitchen/cook/[id] full-screen, Screen Wake Lock API, step timer, keyboard nav), F30 Freemium gate (5 recipes/month, /upgrade page, UsageCounter)
- **Batch C** (polish): F36 Nutrition estimate (FDA-style panel, AI estimates, cached), F40 Print view (/recipe/[id]/print route + @media print styles + auto-trigger window.print())

## Architecture Notes
- Middleware is src/proxy.ts — never modified
- Cooking mode uses Screen Wake Lock API to prevent screen sleep
- Freemium enforced server-side in /api/recipes/cook — returns 402 on limit breach

## Build
- PASS (Node 20)
- Remaining: 39 features in Phase 1
