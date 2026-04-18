# ingredientbot.com — UX/UI Design Pass
**Date:** 2026-04-18
**Sprint:** /qa-design

---

## Pages Audited

| Page / Component | Issues Found |
|---|---|
| `(app)/settings/page.tsx` | Account info used flat `<p>` layout — no label/value hierarchy |
| `(admin)/admin/layout.tsx` | No active-link indicator on sidebar nav; raw `←` text instead of Lucide icon; no `focus-visible:ring` on Back link |
| `src/components/settings/settings-client.tsx` | Raw `<input type="checkbox">` elements — should use shadcn `Checkbox` component |
| `src/components/pantry/pantry-client.tsx` | Emoji icons (🔴 🟡) in ExpiryBadge — violates no-emoji-as-icons rule |
| `src/components/recipe/collections-client.tsx` | Invalid Tailwind class `h-4.5 w-4.5` on FolderOpen icon |
| `src/components/recipe/collection-detail-client.tsx` | Bare empty state — no icon container, no heading, no CTA button |
| `src/app/offline/page.tsx` | Raw `<button>` missing `focus-visible:ring-2 focus-visible:ring-ring` |
| `src/components/recipe/print-recipe-view.tsx` | `print:text-black`, `print:text-gray-*` — intentional, correct for print context, no change needed |
| `src/components/auth/*.tsx` | Clean — all use shadcn primitives, CSS variable tokens, proper structure |
| `(app)/dashboard/page.tsx` | Clean — stat cards, heatmap, quick actions all use CSS variable tokens |
| `(app)/saved/page.tsx`, `history/page.tsx` | Clean — delegated to well-structured client components |
| `(admin)/admin/page.tsx`, `users/page.tsx`, `audit-logs/page.tsx` | Clean — proper table layout with `bg-card`, `border-border`, `text-muted-foreground` |

---

## Pages / Components Redesigned

### 1. `(admin)/admin/layout.tsx` — Active-link indicator + icon fix
- Converted to client component to use `usePathname()`
- Added active-link indicator: `bg-primary/10 text-primary font-medium border-l-2 border-primary` (per CLAUDE.md standard)
- Replaced `← Back to App` text with `ChevronLeft` Lucide icon
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` to Back link

### 2. `components/settings/settings-client.tsx` — Checkbox upgrade
- Replaced 2x raw `<input type="checkbox">` with shadcn `Checkbox` component
- Proper `<Label htmlFor>` pairing with `cursor-pointer` for click affordance
- Passes through `checked` and `onCheckedChange` API (consistent with existing `script-run-button.tsx` pattern)

### 3. `components/pantry/pantry-client.tsx` — Remove emoji icons
- Replaced `🔴` and `🟡` emoji with `Circle` Lucide icon (`fill-current`) in `ExpiryBadge`
- Color context preserved via parent span class (`text-red-700`, `text-amber-700` with dark variants)

### 4. `components/recipe/collections-client.tsx` — Invalid class fix
- Fixed `h-4.5 w-4.5` (invalid Tailwind) → `h-5 w-5` on collection folder icon

### 5. `components/recipe/collection-detail-client.tsx` — Empty state improvement
- Added `rounded-xl border border-dashed border-border bg-muted/20` container
- Added icon inside `h-14 w-14 rounded-full bg-primary/10` container
- Added `h2` heading ("No recipes yet")
- Added descriptive sub-text
- Added "Browse Saved Recipes" CTA button

### 6. `(app)/settings/page.tsx` — Account info card
- Replaced flat `<p>` layout with `<dl>/<dt>/<dd>` semantic structure
- Added `flex justify-between` row layout for label/value pairs
- Consistent font sizing and muted-foreground label style
- Section title upgraded from `text-sm font-medium text-muted-foreground` to `text-base font-semibold text-foreground`

### 7. `app/offline/page.tsx` — Focus ring
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded` to the "Try again" raw button

---

## Items Deferred

- `print-recipe-view.tsx`: `print:text-black`, `print:text-gray-*`, `border-gray-300` — intentional print-context hardcoded values. CSS variable tokens are not accessible in print mode; these are correct as-is.
- Semantic status colors (`text-green-*`, `text-amber-*`, `text-red-*`): All have proper `dark:` variants. These are appropriate semantic status indicators (expiry urgency, difficulty badges, success/error feedback) — not design-system colors that should be CSS variables.
- Kitchen panel (`kitchen-panel.tsx`): Large file with complex split-panel state. Color usage is all semantic status (expiry, pantry matching) with proper dark variants. No changes needed.

---

## Build Verification

```
✓ Compiled successfully in 4.1s
✓ TypeScript passed
✓ 53 pages generated
```
