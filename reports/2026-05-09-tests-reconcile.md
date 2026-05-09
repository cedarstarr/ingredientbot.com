# Test Reconciliation Report — 2026-05-09

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TEST RECONCILIATION REPORT — 2026-05-09
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Repo | Status | New Tests | Stale Fixed | Code Fixed | Notes |
|------|--------|-----------|-------------|------------|-------|
| shkdwn.com | ✅ | 3 files + 2 extra tests | 0 | 0 | settings, portfolio-accuracy, research-advanced |
| gurumind.ai | ✅ | 8 files (37 tests) | 0 | 0 | book-detail, concepts, subscription, program-pause, testimonials, cohort, reading-path, silent-reading |
| dailypriceguru.com | ✅ | 2 new tests | 0 | 2 testid additions | shared-comparison, generation-compare |
| matchmymajor.ai | ✅ | 1 file (39 tests, 18 features) | 0 | 0 | features2.spec.ts |
| jetsetfx.com | ✅ | 1 file (19 features) | 0 | 3 testid additions | features-2026-05-09.spec.ts |
| newsbro.com | ✅ | 1 file (17 tests, 13 features) | 0 | 0 | features-extended.spec.ts |
| foulweatherlabs.com | ✅ | 4 files (21 features) | 0 | 0 | dashboard-settings, workspace-private-tools, webcams-and-moon, coastal-content-pages |
| ingredientbot.com | ✅ | 2 files (3 features) | 0 | 0 | dashboard-stats, history-search |
| padjobs.com | ✅ | 3 files (15 features) | 0 | 0 | location-browse, application-flows, employer-advanced |
| padhr.com | ✅ | 1 file (16 features) | 0 | 0 | feature-coverage.spec.ts |
| padats.com | ✅ | 2 files (8 features) | 0 | 0 | portfolio-analytics, monitor-kill-zones |

## Summary

- **Total new test files written**: 27 files
- **Total new test cases**: ~165+ tests across 11 repos
- **Stale tests fixed**: 0 (all existing tests were aligned with current UI)
- **Application code fixes**: 5 testid additions (dailypriceguru ×2, jetsetfx ×3)

## Gaps (features too complex for auto-testing)

### shkdwn.com
- F64 AI Debate Mode streaming UI — requires seeded DebateSession in staging DB
- F74/F75 Brier score + calibration plot — requires resolved positions in staging
- F100 Grid search heatmap — requires a completed batch job in staging
- F73 wallet connect form submission — needs real Polymarket wallet address

### gurumind.ai
- F04 Discussion Threads — requires seeded book discussions
- F05 Shareable Notes — requires saved note with public token
- F06/F07/F08/F09 Streak/Clubs/Following/Authors — requires seeded relationship data
- F11 Referral System — referral code generation/redemption flow
- F25/F38 Email drip/re-engagement — cron jobs, not testable via E2E
- F40 Insight of the Day — requires cron-generated daily insight

### dailypriceguru.com
- F42 full share comparison view — requires seeded SavedComparison with shareToken
- F80 generation comparison — requires products with generationFamily seeded

### matchmymajor.ai
- F08 Future Me Salary Projections — requires auth + specific profile data
- F25 Career Outcomes Explorer — embedded in career-pathways detail pages

### jetsetfx.com
- F10 Referral System — Stripe-gated, no public landing page
- F47 Gamified Education Quizzes — requires seeded quiz data
- F56 Indicator Version Control — requires known seeded slug
- F60 Pro Trial Extension — Stripe webhook-driven

### newsbro.com
- F52/F54 Related Real Stories / Source Citations — requires seeded articles
- Admin features — test user lacks isAdmin flag
- F24 Crons — no direct E2E surface
- F39 Weekly Satire Digest Email — backend-only cron

### foulweatherlabs.com
- F33/F34 Swell/HWY20 alerts — require email delivery testing
- F36 Cookie consent — conditional on first visit
- F49 Dynamic OG images — generated at build time

### ingredientbot.com
- F33/F36/F38/F40/F41/F51 recipe-detail features — require real saved recipe ID in staging
- F45 Weekly meal plan email digest — cron-triggered

### padjobs.com
- F02/F60 Job posting creation — requires employer + Stripe payment
- F03 Full apply flow — requires active ACTIVE-status job in staging
- F85 Dark mode WCAG AA — needs visual regression tooling

### padhr.com
- F15 Stripe Billing — requires live Stripe test keys + webhook simulation
- N10 Candidate Video Intro — requires R2 file upload mock
- F36/F37 CI/Crons — infrastructure-level

### padats.com
- F4x–F50 strategy templates/backtesting — require live execution engine state

## Linear Issues Filed
none — all gaps are data-dependency or integration issues noted above
