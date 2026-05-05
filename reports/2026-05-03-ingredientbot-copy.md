# IngredientBot Copy Audit — 2026-05-03

**Scope:** All user-visible strings in `src/app/`, `src/components/`, and `src/emails/`
**Voice profile:** Friendly, practical, food-enthusiast energy. Knowledgeable kitchen companion. Not corporate, not clinical.

---

## Summary

| Tier | Count |
|------|-------|
| 🔴 Blockers | 1 |
| 🟠 Typos (auto-fixed) | 12 |
| 🟡 Voice drift | 4 |
| 🔵 Weak CTAs | 5 |
| **Total** | **22** |

---

## 🔴 Blockers (1)

### B-1 — Upgrade CTA permanently disabled with "(coming soon)" label
**File:** `src/components/upgrade/upgrade-client.tsx` line 138–142

```tsx
<Button className="w-full gap-2" disabled>
  <Sparkles className="h-4 w-4" />
  Upgrade to Pro
  <span className="text-xs opacity-70">(coming soon)</span>
</Button>
```

The Pro upgrade button is permanently `disabled` with a "(coming soon)" inline label. This is the site's only monetization path. Users reaching `/upgrade` (including those who hit the free-recipe limit and are prompted to upgrade) land on a dead CTA with no actionable next step.

**Recommendation:** Either wire up Stripe and remove the `disabled` state, or replace the disabled button with a waitlist/notify-me email capture so upgrade intent is captured. At minimum, the "(coming soon)" label should be surfaced more prominently — it currently reads as broken rather than intentional.

---

## 🟠 Typos — Auto-Fixed (12)

All instances were ASCII triple-dot `...` used as an ellipsis in loading/status strings. The correct Unicode ellipsis character `…` is already used consistently in other strings (`Signing in…`, `Preparing…`, `Creating account…`, etc.). These were made consistent.

| # | File | Before | After |
|---|------|--------|-------|
| T-1 | `src/components/settings/dietary-profile-section.tsx:129` | `Loading dietary profile...` | `Loading dietary profile…` |
| T-2 | `src/components/settings/dietary-profile-section.tsx:279` | `Saving...` | `Saving…` |
| T-3 | `src/components/settings/settings-client.tsx:127` | `'Saving...'` | `'Saving…'` |
| T-4 | `src/components/settings/settings-client.tsx:150` | `'Updating...'` | `'Updating…'` |
| T-5 | `src/components/settings/settings-client.tsx:185` | `'Saving...'` | `'Saving…'` |
| T-6 | `src/components/settings/settings-client.tsx:194` | `'Signing out...'` | `'Signing out…'` |
| T-7 | `src/components/settings/settings-client.tsx:228` | `'Deleting...'` | `'Deleting…'` |
| T-8 | `src/components/recipe/delete-recipe-button.tsx:47` | `'Deleting...'` | `'Deleting…'` |
| T-9 | `src/components/import/import-client.tsx:156` | `Extracting...` | `Extracting…` |
| T-10 | `src/components/import/import-client.tsx:215,358` | `Saving...` (×2) | `Saving…` (×2) |
| T-11 | `src/components/pantry/pantry-client.tsx:231` | `Loading pantry...` | `Loading pantry…` |
| T-12 | `src/components/kitchen/kitchen-panel.tsx:1111` | `Analyzing photo...` | `Analyzing photo…` |
| T-13 | `src/app/(admin)/admin/scripts/script-run-button.tsx:55,68` | `Running...` (×2) | `Running…` (×2) |

---

## 🟡 Voice Drift — Flagged for Human Review (4)

These are not incorrect per se, but they drift toward generic/corporate AI-app copy rather than the kitchen-companion personality.

### VD-1 — "transform how you cook" is marketing-speak
**File:** `src/app/page.tsx` line 155

> "Join IngredientBot and transform how you cook. Free to start — no credit card needed."

"Transform how you cook" is the kind of generic AI-product boilerplate found on every SaaS homepage. It says nothing specific.

**Suggested alternative:** "Join IngredientBot — your ingredients, instant recipes, zero fuss. Free to start." Or lean into the food-enthusiast angle: "Stop staring at the fridge wondering what to make. Join for free."

---

### VD-2 — "AI-powered recipe intelligence" on coming-soon page is jargon
**File:** `src/app/coming-soon/page.tsx` line 17

> "AI-powered recipe intelligence. Discover what you can make with what you already have."

"Recipe intelligence" is corporate filler. The second sentence is the actually good line — it describes the real value prop. The first sentence adds nothing.

**Suggested fix:** Remove "AI-powered recipe intelligence." entirely. Keep only: "Discover what you can make with what you already have."

---

### VD-3 — Layout description metadata is flat and feature-list flavored
**File:** `src/app/layout.tsx` line 16

> `description: 'AI-powered recipe suggestions based on ingredients you have.'`

This reads as a feature bullet. It doesn't communicate the feeling or the why.

**Suggested alternative:** `description: 'Tell it what's in your fridge. Get instant, customizable recipe ideas powered by Claude AI.'`

---

### VD-4 — "medical dietary flags" disclaimer appears twice with slightly different wording
**File:** `src/components/settings/dietary-profile-section.tsx` lines 131–136 and 268–271

The loading state renders a disclaimer at line 131–136, and the loaded state renders a nearly identical disclaimer at 268–271. The wording differs slightly:

- Loading state: "Medical dietary flags (low-sodium, low-FODMAP, diabetes-friendly) are general AI-generated guidelines — not medical advice. Consult your doctor for serious conditions."
- Loaded state: "These are general AI-generated guidelines based on common dietary recommendations — not medical advice. Consult your doctor for serious conditions."

**Recommendation:** Standardize to one version. The loaded-state version is cleaner. The loading-state duplicate can be removed entirely (it's visible for less than 500ms anyway).

---

## 🔵 Weak CTAs — Flagged for Human Review (5)

### CTA-1 — "View All" / "View all" buttons on Dashboard
**File:** `src/app/(app)/dashboard/page.tsx` lines 172 and 185

Two adjacent "View All" / "View all" CTAs appear on the dashboard — one on the Saved Recipes quick-action card and one in the Recent Recipes header. Both are passive. "View All" is the prototypical weak CTA.

**Suggested alternatives:**
- Quick-action card: "Browse Recipes" or "Open Recipe Book"
- Recent Recipes link: "See All Recipes"

---

### CTA-2 — Two "Apply" buttons in Modification Toolbar with no context
**File:** `src/components/recipe/modification-toolbar.tsx` lines 103 and 132

The serving-size and cooking-method controls each have an "Apply" button. "Apply" is generic; it could mean anything. Since both appear adjacent to their respective controls, they're not ambiguous in practice, but the button label is a missed opportunity.

**Suggested alternatives:**
- Servings Apply → "Rescale" or "Update Servings"
- Method Apply → "Switch Method"

---

### CTA-3 — "Get different suggestions" in Substitution Panel is passive
**File:** `src/components/recipe/substitution-panel.tsx` line 248

> "Get different suggestions"

Passive voice, low urgency. Better framing for a kitchen tool: "Try other swaps" or "Show me more options."

---

### CTA-4 — "Cook this" button on recipe cards is fine but could be stronger
**File:** `src/components/kitchen/recipe-suggestion-card.tsx` line 87

"Cook this" is actually good — direct, action-oriented, voice-appropriate. Flagging only because some users may expect a more informative label. A slight improvement: "Start Cooking" or "View Full Recipe." No change required if the current label tests well.

---

### CTA-5 — "Continue Free" on upgrade page is ambiguous
**File:** `src/components/upgrade/upgrade-client.tsx` line 107

> "Continue Free"

This button sends users back to `/kitchen`. "Continue Free" is slightly confusing — does it mean "stay on the free plan" or "keep using without paying"? Either reading is fine, but "Stay on Free Plan" is more explicit and less likely to cause hesitation.

---

## Notes

- No lorem ipsum, placeholder text, un-interpolated `{{var}}` patterns, or `undefined`/`null` rendering in UI found.
- No traditional spelling errors found (misspellings, double spaces, unclosed quotes).
- The overall copy quality is high. The site has consistent voice, good CTAs in most places, and sensible error messages throughout.
- The ellipsis inconsistency (`...` vs `…`) was the only systematic typo category found — all instances have been auto-fixed.
