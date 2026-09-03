/**
 * Free-tier metering for recipe creation.
 *
 * **The cap is currently OFF (null = unlimited).** Cedar's call, 2026-09-02.
 *
 * It used to be 5 a month, enforced with an HTTP 402 in four routes, while the
 * site had no way to take money: no payment processor in package.json, no
 * billing routes, and /upgrade is marketing copy with no checkout (FOU-460).
 * The net effect was a wall on the 6th recipe with nothing behind it — which
 * selects precisely the users who like the product and ejects them, and is
 * worse than having no cap at all. Reverse ingredient search would have driven
 * materially more traffic into it.
 *
 * Counting still happens: `User.recipeCount` and `monthlyResetDate` are
 * maintained exactly as before, so usage data keeps accruing and turning the
 * cap back on is this one value plus a deploy. `User.isPro` also still exists
 * and is still honoured, so an individual account can be exempted by hand
 * whether or not a cap is in force.
 */
export const FREE_TIER_MONTHLY_RECIPES: number | null = null

/**
 * Whether this user has exhausted their monthly allowance. Pro accounts and an
 * absent cap both mean "no".
 *
 * Callers pass the already-reset-adjusted count — the monthly rollover lives at
 * the call site because it also has to write `monthlyResetDate`.
 */
export function isOverFreeLimit(isPro: boolean, currentCount: number): boolean {
  if (isPro) return false
  if (FREE_TIER_MONTHLY_RECIPES === null) return false
  return currentCount >= FREE_TIER_MONTHLY_RECIPES
}
