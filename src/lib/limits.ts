/**
 * Free-tier metering for recipe creation.
 *
 * **50 a month — an abuse ceiling, not a paywall.** Cedar's call, 2026-09-03.
 *
 * It was 5, enforced with an HTTP 402 in four routes while the site had no way
 * to take money: no payment processor in package.json, no billing routes, and
 * /upgrade is marketing copy with no checkout (FOU-460). That put a wall on the
 * 6th recipe with nothing behind it, which selects precisely the users who like
 * the product and ejects them. It was briefly removed altogether (2026-09-02).
 *
 * Removing it entirely turned out to be the wrong shape. Every generation
 * spends the SHARED free-tier broker budget that all eleven portfolio sites
 * draw on, so an uncapped anonymous-signup site is a way for one bad actor to
 * exhaust a resource the other ten depend on. `aiLimiter` (10/min per IP) stops
 * a hammer but sets no monthly ceiling.
 *
 * 50 is chosen to be invisible to real cooking — about a recipe and a half a
 * day — while bounding the worst case per account. It is deliberately NOT a
 * monetisation lever: if it ever starts converting people, that is a signal to
 * build a checkout, not to lower this number.
 *
 * `User.isPro` is still honoured, so an individual account can be exempted by
 * hand. Set this to null to remove the ceiling again.
 */
export const FREE_TIER_MONTHLY_RECIPES: number | null = 50

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
