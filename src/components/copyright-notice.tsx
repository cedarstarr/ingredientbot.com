import { cn } from '@/lib/utils'

/**
 * Standing copyright line for the site footer (FOU-448 item 4 — ingredientbot.com was
 * one of two sites in the portfolio with no copyright notice anywhere in src/).
 *
 * Year is computed at render, never hardcoded — a build made in December and viewed the
 * following January would otherwise show a stale year.
 */
export function CopyrightNotice({ className }: { className?: string }) {
  const year = new Date().getFullYear()
  return (
    <p data-testid="copyright-notice" className={cn('text-xs text-muted-foreground', className)}>
      &copy; {year} IngredientBot. All rights reserved.
    </p>
  )
}
