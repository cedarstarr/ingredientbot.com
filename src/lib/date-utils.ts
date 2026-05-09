/**
 * Date utilities shared across API routes.
 */

/** Returns the UTC start of the current calendar month (midnight on the 1st). */
export function startOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
