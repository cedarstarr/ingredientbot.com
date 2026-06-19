# Copy Audit — ingredientbot.com
**Date:** 2026-06-07  
**Auditor:** /qa-copy  
**Scope:** `src/app`, `src/components`, `src/emails`

---

## Summary

| Category | Count | Action |
|---|---|---|
| 🔴 Blockers | 1 | Flag only (Stripe not integrated) |
| 🟠 Typos | 0 | None found |
| 🟡 Voice drift | 0 | Copy is on-voice throughout |
| 🔵 Weak CTAs | 0 | CTAs are strong and specific |

**Typos fixed:** 0  
**Overall:** Clean copy. One active blocker (upgrade button is disabled with "(coming soon)" text).

---

## Findings

### 🔴 Blockers

| # | File | Line | Text | Notes |
|---|---|---|---|---|
| B1 | `src/components/upgrade/upgrade-client.tsx` | 141 | `(coming soon)` inside disabled "Upgrade to Pro" button | Stripe is not configured. The button is intentionally disabled and the inline comment confirms this. User-visible text reads "Upgrade to Pro (coming soon)" which clearly communicates the limitation. **Do not auto-fix** — this needs Stripe integration, not a copy change. |

### 🟠 Typos

None found.

### 🟡 Voice Drift

None. All copy matches the friendly, food-forward, practical voice profile:
- Hero: "Your kitchen, supercharged by AI" — warm and active
- Kitchen panel header: "What's in your fridge today?" — conversational, direct
- Empty state: "Add your ingredients" / "let the AI choose" — approachable
- Error states: "Failed to generate recipes. Please try again." — simple, non-alarming
- Emails: welcome, verify, password-reset copy is friendly and on-brand

### 🔵 Weak CTAs

None. CTAs are specific and action-oriented:
- "Start Cooking for Free" (landing page hero, CTA section)
- "Find recipes" (kitchen panel)
- "Cook this" (recipe suggestion card)
- "Snap fridge" (photo upload button)
- "Continue Free" (upgrade page free tier)
- "Back to Kitchen" (navigation)

---

## Notes

- The `Generated · claude-sonnet-4-6` attribution shown in the recipe results area is an internal model label, not user-facing marketing copy — not flagged.
- The upgrade page's "(coming soon)" text is the only user-visible incomplete state. It is self-explanatory and the button is disabled, so it does not block the user experience — but it should be resolved when Stripe is integrated.
- Metadata descriptions are specific and accurate. No generic placeholder metadata.
- All email copy (welcome, verify-email, password-reset) matches voice profile.
