# Test Reconciliation Report — ingredientbot.com — 2026-04-14

## Summary

| Metric | Count |
|--------|-------|
| ✅ Features in FEATURES.md | 53 |
| Features already with tests (pre-run) | 51 |
| New tests written | 4 features / 2 new files |
| Tests updated (stale fix) | 1 (content-type in kitchen-generate mock) |
| New API tests added | 1 file (kitchen-prefs API, F53/F70) |
| Application code fixes | 0 |
| Build | ✅ Clean (Node 20 + next build) |

## Context

This reconcile ran after two significant changes since the 2026-04-11 run:

1. **Vercel AI SDK migration** — `@anthropic-ai/sdk` replaced with `ai@6 + @ai-sdk/anthropic`. The `/api/recipes/generate` response now uses `text/plain; charset=utf-8` instead of `application/x-ndjson`. The kitchen panel streaming reads raw text chunks, which is compatible. No UI behavior changed.
2. **Database design review fixes** — `prisma/schema.prisma` updated with additional indexes and query optimizations. No API surface changes.

## Stale Tests Fixed

| File | Issue | Fix |
|------|-------|-----|
| `tests/kitchen-generate.spec.ts` | Mock response used `application/x-ndjson` but generate endpoint now returns `text/plain; charset=utf-8` (Vercel AI SDK migration) | Updated `contentType` in the `route.fulfill()` call to match |

## New Tests Written

| File | Features Covered |
|------|-----------------|
| `tests/recipe-regeneration.spec.ts` | F24 "Try Different Recipes" button hidden before generation, appears after mocked result, enabled with 2+ ingredients; F35 Difficulty selector labels visible in kitchen panel |
| `tests/dark-mode-pwa.spec.ts` | F42 ThemeToggle button visible + clickable + has aria-label; F43 /manifest.json valid PWA fields + icons, /offline page renders, /sw.js accessible; F45 cron digest auth guard check |

## Updated API Tests

| File | What Changed |
|------|-------------|
| `tests/api-health.spec.ts` | Added import for `loginAsTestUser`; added unauthenticated guard test for `/api/user/kitchen-prefs`; added authenticated describe block testing GET returns `budgetMode`/`chefPersonality`, PATCH persists changes, PATCH rejects invalid enum values |

## Remaining Gaps (unchanged from 2026-04-11)

- **F55 Voice input** — `SpeechRecognition` API is unavailable in Playwright Chromium headless; cannot be E2E tested without a real browser
- **F43 PWA install prompt** — `beforeinstallprompt` event requires non-headless HTTPS context; the `PwaInstallPrompt` component itself is tested indirectly via manifest + sw.js
- **F24 visual confirmation** — The "Try Different Recipes" button only renders after suggestions appear in state; the mocked generation test verifies the absence pre-generation; full post-generation visibility requires a live AI response
