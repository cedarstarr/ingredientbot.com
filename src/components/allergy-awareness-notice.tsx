import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Site-wide standing notice: IngredientBot is not allergy-aware yet.
 *
 * Distinct from {@link AllergenDisclaimer}, which is contextual — it appears next
 * to a specific recipe or dietary filter and qualifies that result. This one states
 * the product-level position and belongs at the bottom of every page, so a user who
 * never opens a recipe still sees it.
 *
 * Deliberately worded as "not a safety feature" rather than "may be inaccurate":
 * the weaker phrasing invites people with real allergies to lean on it anyway.
 */
export function AllergyAwarenessNotice({ className }: { className?: string }) {
  return (
    <aside
      role="note"
      aria-label="Allergy awareness notice"
      data-testid="allergy-awareness-notice"
      className={cn(
        'mx-auto flex max-w-3xl gap-2.5 rounded-md border border-[hsl(var(--color-warning))]/30 bg-[hsl(var(--color-warning-muted))] px-3.5 py-3 text-left',
        // print: browsers drop backgrounds by default, so fall back to border + black text
        'print:border-gray-800 print:bg-transparent',
        className
      )}
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--color-warning-fg))] print:text-black"
      />
      <p className="text-xs leading-relaxed text-[hsl(var(--color-warning-fg))] print:text-black">
        <span className="font-semibold">IngredientBot is not allergy-aware.</span>{' '}
        Recipes, ingredients, and dietary filters on this site are not checked for allergens and
        are not a safety feature. Full allergy awareness is planned for a future release. Until
        then, always read the labels on the ingredients you buy, and do not rely on this site if
        you or anyone you cook for has a food allergy.
      </p>
    </aside>
  )
}
