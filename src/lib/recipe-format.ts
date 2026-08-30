/**
 * Presentation helpers for rendering recipe bodies. Shared by the public browse
 * page and the public recipe permalink so the two never drift.
 */

export interface RecipeIngredient {
  name: string
  amount: string
  unit: string
}

/**
 * Human duration for a recipe's total time. Long-cook dishes (brisket, injera,
 * cholent) run past 10 hours, and "4340 min" is unreadable — anything an hour or
 * over reads as hours, with the remainder only when it is non-zero.
 */
export function formatDuration(totalMin: number): string {
  if (!Number.isFinite(totalMin) || totalMin <= 0) return ''
  if (totalMin < 60) return `${totalMin} min`

  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  const hourPart = `${hours} hr`
  return minutes > 0 ? `${hourPart} ${minutes} min` : hourPart
}

/**
 * True when an ingredient row is really a section label ("For the broth and
 * tare", "For assembly") rather than something to buy. The AI seeder emits these
 * for multi-component dishes; they carry a name but no amount or unit, and
 * rendering them as ordinary bullets looks like a broken ingredient.
 *
 * Deliberately narrow: "plain yogurt, for serving" and "salt, to taste" are also
 * amount-less but ARE ingredients. The distinguishing signal is position — a
 * section label OPENS with "For", while a serving qualifier trails the
 * ingredient it belongs to.
 */
export function isIngredientHeading(ing: Pick<RecipeIngredient, 'name' | 'amount' | 'unit'>): boolean {
  const hasQuantity = Boolean(String(ing.amount ?? '').trim() || String(ing.unit ?? '').trim())
  if (hasQuantity) return false

  const name = String(ing.name ?? '').trim()
  if (!name) return false

  return /^for\s+\S/i.test(name)
}
