// Account lockout backoff (FOU-344).
//
// IP-based rate limiting does not stop password spraying — one attempt per
// account across many accounts, rotating source IPs. Per-account lockout is the
// only control that addresses that.
//
// Chose progressive backoff over a permanent lock because a permanent lock lets
// an attacker deny a real user their own account just by deliberately failing
// that user's login a few times. Backoff self-heals.
export const LOCKOUT_FREE_ATTEMPTS = 5
export const LOCKOUT_BASE_MINUTES = 1
export const LOCKOUT_MAX_MINUTES = 15

/**
 * `failedAttempts` is the count *after* incrementing for the failure that just
 * happened. Returns the lock duration in minutes, or null if the account should
 * not be locked yet. Progression: 1 -> 2 -> 4 -> 8 -> 15 (capped).
 */
export function computeLockoutMinutes(failedAttempts: number): number | null {
  if (failedAttempts <= LOCKOUT_FREE_ATTEMPTS) return null
  const lockNumber = failedAttempts - LOCKOUT_FREE_ATTEMPTS
  const minutes = LOCKOUT_BASE_MINUTES * Math.pow(2, lockNumber - 1)
  return Math.min(minutes, LOCKOUT_MAX_MINUTES)
}

export function isLockedOut(lockedUntil: Date | null | undefined): boolean {
  return !!lockedUntil && lockedUntil.getTime() > Date.now()
}
