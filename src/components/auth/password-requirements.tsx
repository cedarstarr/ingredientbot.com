'use client'

import { Check, X } from 'lucide-react'
import { PASSWORD_RULES, scorePassword, validatePassword } from '@/lib/password-policy'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const SCORE_BAR_COLOR: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '[&>div]:bg-destructive',
  1: '[&>div]:bg-destructive',
  2: '[&>div]:bg-[hsl(var(--color-warning-fg))]',
  3: '[&>div]:bg-[hsl(var(--color-success-fg))]',
  4: '[&>div]:bg-[hsl(var(--color-success-fg))]',
}

/**
 * Live checklist + strength meter for a password field. Purely advisory —
 * the server-side passwordSchema/validatePassword() pair in
 * src/lib/password-policy.ts is the only authoritative check.
 */
export function PasswordRequirements({
  password,
  context,
  testIdPrefix,
}: {
  password: string
  context?: { email?: string | null; name?: string | null }
  testIdPrefix: string
}) {
  const failing = new Set(validatePassword(password, context))
  const { score, label } = scorePassword(password)
  const percent = (score / 4) * 100

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-requirements`}>
      <div className="space-y-1">
        <Progress
          value={percent}
          className={cn('h-1.5', SCORE_BAR_COLOR[score])}
          data-testid={`${testIdPrefix}-strength-bar`}
        />
        <p className="text-xs text-muted-foreground" data-testid={`${testIdPrefix}-strength-label`}>
          {password ? `Strength: ${label}` : 'Enter a password to see its strength'}
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" data-testid={`${testIdPrefix}-rules`}>
        {PASSWORD_RULES.map((rule) => {
          const met = password.length > 0 && !failing.has(rule)
          return (
            <li
              key={rule}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                met ? 'text-[hsl(var(--color-success-fg))]' : 'text-muted-foreground'
              )}
            >
              {met ? (
                <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
              ) : (
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
              {rule}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
