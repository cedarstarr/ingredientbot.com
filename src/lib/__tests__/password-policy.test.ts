import { describe, it, expect } from 'vitest'
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RULES,
  validatePassword,
  passwordSchema,
  scorePassword,
} from '@/lib/password-policy'

// A password that satisfies every rule, used as the "everything else held
// constant" baseline for each individual-rule test below.
const STRONG = 'Xk7!qLm9#Tzv'

describe('validatePassword — accepts a compliant password', () => {
  it('returns no issues for a strong password', () => {
    expect(validatePassword(STRONG)).toEqual([])
  })
})

describe('validatePassword — length', () => {
  it('flags a password under the minimum length', () => {
    expect(validatePassword('Xk7!qLm9')).toContain(PASSWORD_RULES[0])
  })

  it('flags a password over the maximum length', () => {
    const tooLong = 'Aa1!' + 'x'.repeat(PASSWORD_MAX_LENGTH)
    expect(validatePassword(tooLong)).toContain(PASSWORD_RULES[0])
  })

  it('accepts a password at exactly the minimum length', () => {
    // 12 chars, one of each required class.
    const exact = 'Xk7!qLm9#Tz'
    expect(exact.length).toBe(PASSWORD_MIN_LENGTH - 1)
    // pad to exactly the minimum
    const padded = exact + 'v'
    expect(padded.length).toBe(PASSWORD_MIN_LENGTH)
    expect(validatePassword(padded)).toEqual([])
  })
})

describe('validatePassword — character classes', () => {
  it('flags a password with no lowercase letter', () => {
    expect(validatePassword('XK7!QLM9#TZV')).toContain(PASSWORD_RULES[1])
  })

  it('flags a password with no uppercase letter', () => {
    expect(validatePassword('xk7!qlm9#tzv')).toContain(PASSWORD_RULES[2])
  })

  it('flags a password with no digit', () => {
    expect(validatePassword('Xkq!qLmq#Tzv')).toContain(PASSWORD_RULES[3])
  })

  it('flags a password with no symbol', () => {
    expect(validatePassword('Xk7qLm9qTzvB')).toContain(PASSWORD_RULES[4])
  })
})

describe('validatePassword — common password deny-list', () => {
  // The deny-list check is exact-match (after lowercasing + stripping TRAILING
  // digits only, per spec) — not a substring "contains" check. A trailing
  // symbol defeats the digit-strip, so these deliberately end on a digit.

  it('flags a password on the deny-list', () => {
    expect(validatePassword('Welcome123')).toContain(PASSWORD_RULES[5])
  })

  it('flags a deny-listed password with trailing digits stripped', () => {
    // "welcome" + a long trailing digit run -> "welcome" after stripping, still a hit
    expect(validatePassword('Welcome19999')).toContain(PASSWORD_RULES[5])
  })

  it('is case-insensitive', () => {
    expect(validatePassword('QWERTY123456')).toContain(PASSWORD_RULES[5])
  })

  it('does not flag a password that merely contains letters of a common word', () => {
    // Contains "password" as a substring but is not itself deny-listed —
    // proves the check is exact-match, not substring-`includes`.
    expect(validatePassword('MyPasswordVault99!')).not.toContain(PASSWORD_RULES[5])
  })
})

describe('validatePassword — personal info', () => {
  it('flags a password containing the email local-part', () => {
    const issues = validatePassword('Cedarstarr7!Xq', { email: 'cedarstarr@example.com' })
    expect(issues).toContain(PASSWORD_RULES[6])
  })

  it('flags a password containing a name token of length >= 4', () => {
    const issues = validatePassword('Cedarov7!Xq', { name: 'Cedar Barrett' })
    expect(issues).toContain(PASSWORD_RULES[6])
  })

  it('does not flag a name token shorter than 4 characters', () => {
    // "Cs" as a name token is under the floor, and the rest of STRONG is clean.
    const issues = validatePassword(STRONG, { name: 'Cs' })
    expect(issues).not.toContain(PASSWORD_RULES[6])
  })

  it('does not flag when email/name are absent', () => {
    expect(validatePassword(STRONG)).not.toContain(PASSWORD_RULES[6])
  })
})

describe('validatePassword — repeated/sequential patterns', () => {
  it('flags a single repeated character', () => {
    expect(validatePassword('aaaaaaaaaaaa')).toContain(PASSWORD_RULES[7])
  })

  it('flags a sequential alphabet run', () => {
    expect(validatePassword('Tzv9!abcdEqx')).toContain(PASSWORD_RULES[7])
  })

  it('flags a sequential digit run', () => {
    expect(validatePassword('Tzv!1234Eqxm')).toContain(PASSWORD_RULES[7])
  })

  it('flags a sequential keyboard-row run', () => {
    expect(validatePassword('Tzv9!qwerEqx')).toContain(PASSWORD_RULES[7])
  })

  it('does not flag a password with no repeated/sequential run', () => {
    expect(validatePassword(STRONG)).not.toContain(PASSWORD_RULES[7])
  })
})

describe('validatePassword — returns ALL failing rules, not just the first', () => {
  it('reports multiple issues at once', () => {
    const issues = validatePassword('abc')
    expect(issues.length).toBeGreaterThan(1)
    expect(issues).toContain(PASSWORD_RULES[0]) // too short
    expect(issues).toContain(PASSWORD_RULES[2]) // no uppercase
    expect(issues).toContain(PASSWORD_RULES[3]) // no digit
    expect(issues).toContain(PASSWORD_RULES[4]) // no symbol
  })
})

describe('passwordSchema', () => {
  it('parses a strong password successfully', () => {
    expect(passwordSchema.safeParse(STRONG).success).toBe(true)
  })

  it('fails a weak password and surfaces every issue as a zod error', () => {
    const result = passwordSchema.safeParse('abc')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(1)
    }
  })
})

describe('scorePassword', () => {
  it('scores an empty password as 0', () => {
    expect(scorePassword('').score).toBe(0)
  })

  it('scores a strong long password highly', () => {
    const { score } = scorePassword('Xk7!qLm9#TzvBhq2^Wf')
    expect(score).toBeGreaterThanOrEqual(3)
  })

  it('caps the score for a common password regardless of shape', () => {
    // 14 chars + mixed case would otherwise score 2 — the common-password cap
    // must pull it down to 1, proving the cap actually engages rather than
    // being redundant with an already-low score.
    const uncapped = scorePassword('Xk7!qLmqTzvBhq').score // structurally similar, NOT deny-listed
    const { score: capped } = scorePassword('Password123456') // deny-listed after digit-strip
    expect(uncapped).toBeGreaterThanOrEqual(2)
    expect(capped).toBeLessThanOrEqual(1)
  })

  it('never returns a score outside 0-4', () => {
    const { score } = scorePassword(STRONG)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(4)
  })
})
