# Copy Audit — ingredientbot.com
**Date:** 2026-06-26
**Voice:** AI recipe/food, friendly and practical, ingredient-forward, approachable

## Auto-Fixed

### 1. Cooking method label inconsistency — `modification-toolbar.tsx`
`src/components/recipe/modification-toolbar.tsx` lines 118, 120

- `Air-Fry` → `Air Fryer` (matches kitchen-panel.tsx and kitchen-prefs API)
- `Slow Cook` → `Slow Cooker` (matches kitchen-panel.tsx and kitchen-prefs API)

These are passed as `targetMethod` to the AI prompt template (`"Rewrite this recipe to use ${targetMethod} cooking"`). "Air Fryer" and "Slow Cooker" are clearer phrases for the AI and consistent with the rest of the UI.

### 2. Auth casing — `signup-form.tsx`
`src/components/auth/signup-form.tsx` line 143

- `Sign in` → `Sign In` (matches login-form, forgot-password-form, and reset-password-form which all use title-case "Sign In")

---

## Needs Human Review

### 🔴 Blockers (ambiguous)

**Upgrade page — Stripe not yet wired**
`src/components/upgrade/upgrade-client.tsx` line 141

```tsx
<span className="text-xs opacity-70">(coming soon)</span>
```

The Pro upgrade button is disabled and shows "(coming soon)" — this is intentional per the inline comment `// Stripe integration placeholder — Stripe not yet configured`. Flag: if Stripe is never configured, users see a dead CTA indefinitely. Suggest either wiring Stripe or removing the upgrade page from nav until it's ready.

---

### 🟡 Voice Drift

1. **Root metadata description** — `src/app/layout.tsx` line 16
   `'AI-powered recipe suggestions based on ingredients you have.'`
   Dry and functional. Consider: *"Tell it what's in your fridge. Get dinner on the table."* The OG/Twitter description on the same file is already better — the default `<meta>` description lags behind.

2. **Dashboard empty-state** — `src/app/(app)/dashboard/page.tsx` line 154–155
   `"Start Cooking"` / `"Generate new recipes from your ingredients"` — fine, but the kitchen heading (`"What's in your fridge today?"`) is warmer. These cards feel more like admin labels than an encouragement to cook.

3. **Pantry empty-state** — `src/components/pantry/pantry-client.tsx` line 365–366
   `"Your pantry is empty"` / `"Add ingredients you keep stocked — they'll be used when generating recipes."`
   Voice is fine but the phrase "used when generating recipes" leans technical. Alternative: *"Add what you keep on hand — IngredientBot will include them every time."*

4. **Cookie banner** — `src/components/cookie-banner.tsx` (not scanned above, worth reviewing) — check that the banner copy matches the privacy policy's language.

---

### 🔵 Weak CTAs

1. **`src/app/(app)/dashboard/page.tsx` line 154** — `"Start Cooking"` (card link to `/kitchen`)
   Generic. Could be `"Cook Something Now"` or `"Open Kitchen"` for more specificity.

2. **`src/components/recipe/collection-detail-client.tsx` line 73**
   `"Browse Saved Recipes"` — fine but passive. Consider `"Add from Saved Recipes"` since the user is in a collection and the intent is to add.

3. **`src/app/page.tsx` line 84** (hero secondary CTA)
   `"Sign In"` as a secondary button alongside `"Start Cooking for Free"` — not weak per se, but it competes for attention. Usually secondary auth link is enough as a text link.

---

## Summary

| Category | Count |
|---|---|
| 🔴 Blockers auto-fixed | 0 |
| 🟠 Typos auto-fixed | 0 |
| 🔵 Inconsistencies auto-fixed | 2 |
| 🔴 Blockers (ambiguous / needs human) | 1 |
| 🟡 Voice drift | 4 |
| 🔵 Weak CTAs | 3 |

**Overall**: Copy is clean — no lorem ipsum, no TODOs, no typos. The site voice is consistent and ingredient-forward. Two mechanical inconsistencies were fixed (cooking method labels, auth casing). Main item for human review is the dead Stripe CTA on the upgrade page.
