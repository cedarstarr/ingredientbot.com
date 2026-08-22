import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export type PasswordIssue = string

// Canonical rule copy — also the exact strings validatePassword() emits as
// issues. Keeping one source of truth means the client checklist can tick a
// rule off by checking `!issues.includes(RULE_TEXT)` instead of re-deriving
// its own parallel wording that could drift from the server check.
export const PASSWORD_RULES: string[] = [
  `At least ${PASSWORD_MIN_LENGTH} characters (max ${PASSWORD_MAX_LENGTH})`,
  'One lowercase letter',
  'One uppercase letter',
  'One number',
  'One symbol (e.g. ! @ # $ %)',
  'Not a commonly used password',
  "Doesn't contain your email or name",
  'No repeated or sequential characters (e.g. aaaa, 1234, abcd)',
]

const [
  RULE_LENGTH,
  RULE_LOWER,
  RULE_UPPER,
  RULE_DIGIT,
  RULE_SYMBOL,
  RULE_COMMON,
  RULE_PERSONAL,
  RULE_PATTERN,
] = PASSWORD_RULES

// ~130 entries pulled from the well-known "most-breached passwords" lists.
// Compared case-insensitively and after stripping trailing digits, so
// "password1", "Password123" etc. all collapse onto "password".
const COMMON_PASSWORDS = new Set([
  'password', 'passwords', 'passw0rd', 'password1', 'password123', 'p@ssw0rd', 'p@ssword',
  '123456789', '12345678', '123456', '1234567890', '1234567', '11111111', '00000000',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qazwsx', 'zaq1zaq1', '1qaz2wsx', '1q2w3e4r',
  'asdfgh', 'asdfghjkl', 'zxcvbnm',
  'letmein', 'letmein1', 'letmein123', 'iloveyou', 'iloveyou1', 'iloveu',
  'admin', 'admin123', 'administrator', 'root', 'toor', 'test', 'testing', 'guest',
  'changeme', 'changeme123', 'default', 'temppass', 'temppassword',
  'welcome', 'welcome1', 'welcome123',
  'monkey', 'monkey1', 'dragon', 'dragon1', 'football', 'football1', 'baseball', 'baseball1',
  'basketball', 'soccer', 'hockey', 'yankees', 'liverpool', 'arsenal', 'chelsea', 'united',
  'sunshine', 'princess', 'flower', 'superman', 'batman', 'starwars', 'starwars1',
  'trustno1', 'trustno1a', 'master', 'shadow', 'shadow1', 'ninja', 'mustang', 'access',
  'michael', 'jennifer', 'jennifer1', 'jordan', 'jordan23', 'hunter', 'hunter2', 'freedom',
  'whatever', 'thomas', 'robert', 'william', 'richard', 'george', 'andrew', 'charlie',
  'daniel', 'matthew', 'joshua', 'nicole', 'amanda', 'ashley', 'samantha', 'michelle',
  'elizabeth', 'jessica', 'maggie', 'buddy', 'lucky', 'harley', 'ranger', 'tigger', 'buster',
  'cookie', 'chocolate', 'pepper', 'hottie', 'loveme', 'sexy', 'iwantu',
  'computer', 'internet', 'service', 'orange', 'purple', 'rainbow', 'summer', 'winter',
  'autumn', 'spring2026', 'welcome2026', 'letmein2026', 'password2026', 'admin2026',
  'abc123', 'abcd1234', 'qwer1234',
])

function stripTrailingDigits(value: string): string {
  return value.replace(/\d+$/, '')
}

function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase()
  return COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(stripTrailingDigits(lower))
}

function isSingleRepeatedChar(password: string): boolean {
  return password.length > 0 && new Set(password).size === 1
}

const SEQUENTIAL_ALPHABETS = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890123456789',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
]

function hasSequentialRun(password: string): boolean {
  const lower = password.toLowerCase()
  for (let i = 0; i <= lower.length - 4; i++) {
    const chunk = lower.slice(i, i + 4)
    const reversed = [...chunk].reverse().join('')
    for (const alphabet of SEQUENTIAL_ALPHABETS) {
      if (alphabet.includes(chunk) || alphabet.includes(reversed)) return true
    }
  }
  return false
}

/** Returns [] when the password is acceptable. */
export function validatePassword(
  password: string,
  context?: { email?: string | null; name?: string | null }
): PasswordIssue[] {
  const issues: PasswordIssue[] = []

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    issues.push(RULE_LENGTH)
  }
  if (!/[a-z]/.test(password)) issues.push(RULE_LOWER)
  if (!/[A-Z]/.test(password)) issues.push(RULE_UPPER)
  if (!/[0-9]/.test(password)) issues.push(RULE_DIGIT)
  if (!/[^A-Za-z0-9]/.test(password)) issues.push(RULE_SYMBOL)
  if (isCommonPassword(password)) issues.push(RULE_COMMON)
  if (isSingleRepeatedChar(password) || hasSequentialRun(password)) issues.push(RULE_PATTERN)

  const lowerPassword = password.toLowerCase()
  const email = context?.email?.trim().toLowerCase()
  const localPart = email?.split('@')[0]
  // Spec's floor is >=4 for name tokens only; local-parts have no stated floor.
  // A bare 1-2 char floor would flag nearly every password against an email like
  // "cs@..." on pure coincidence, so this borrows the name-token floor down by one
  // (>=3) rather than leaving it uncapped.
  const emailHit = !!localPart && localPart.length >= 3 && lowerPassword.includes(localPart)

  const nameTokens = (context?.name ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
  const nameHit = nameTokens.some((token) => lowerPassword.includes(token))

  if (emailHit || nameHit) issues.push(RULE_PERSONAL)

  return issues
}

/** Zod schema built on validatePassword — use this everywhere a password is parsed. */
export const passwordSchema: z.ZodType<string> = z.string().superRefine((password, ctx) => {
  // Context-free subset only (no email/name here — zod has no side-channel for
  // it). Routes that know the account's email/name call validatePassword(...)
  // directly afterward for the personal-info rule; see signup/reset/password
  // routes.
  for (const issue of validatePassword(password)) {
    ctx.addIssue({ code: 'custom', message: issue })
  }
})

/** 0-4 score + label, for the client-side strength meter only (never authoritative). */
export function scorePassword(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: 'Too short' }

  let score = 0
  if (password.length >= PASSWORD_MIN_LENGTH) score++
  if (password.length >= 16) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++

  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
  // A common password is never "strong" no matter how it scores on shape alone.
  const finalScore = isCommonPassword(password) ? (Math.min(capped, 1) as 0 | 1 | 2 | 3 | 4) : capped

  const labels: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'Very weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Strong',
    4: 'Very strong',
  }

  return { score: finalScore, label: labels[finalScore] }
}
