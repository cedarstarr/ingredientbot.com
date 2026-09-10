import { cn } from '@/lib/utils'

/**
 * Standing copyright line for the site footer (FOU-448 item 4 — ingredientbot.com was
 * one of two sites in the portfolio with no copyright notice anywhere in src/).
 *
 * Names the legal entity, not the product: a copyright line identifies the OWNER,
 * and "IngredientBot" is a brand, not a party that can hold a copyright. It matches
 * the holder named in LICENSE so the two cannot drift apart.
 *
 * Year is computed at render, never hardcoded — a build made in December and viewed the
 * following January would otherwise show a stale year.
 */
export function CopyrightNotice({ className }: { className?: string }) {
  const year = new Date().getFullYear()
  return (
    <p data-testid="copyright-notice" className={cn('text-xs text-muted-foreground', className)}>
      &copy; {year} Foulweather Labs LLC. All rights reserved.
    </p>
  )
}
