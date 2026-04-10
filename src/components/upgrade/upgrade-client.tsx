'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Sparkles, Check, Zap, ChefHat } from 'lucide-react'

interface UsageData {
  isPro: boolean
  used: number
  limit: number
  remaining: number | null
}

const FREE_FEATURES = [
  '5 AI recipe generations per month',
  'Full recipe detail with steps',
  'Photo ingredient detection',
  'Grocery list generation',
  'Meal planner',
]

const PRO_FEATURES = [
  'Unlimited AI recipe generations',
  'Everything in free',
  'Priority AI response speed',
  'Ingredient substitution suggestions',
  'Cooking mode (full-screen, screen-on)',
  'Recipe modifications (vegan, faster, etc.)',
  'Advanced recipe history & search',
  'Collections & folders',
]

export function UpgradeClient() {
  const [usage, setUsage] = useState<UsageData | null>(null)

  useEffect(() => {
    fetch('/api/user/usage')
      .then(r => r.json())
      .then(setUsage)
      .catch(() => null)
  }, [])

  if (usage?.isPro) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-6 py-20">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <ChefHat className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">You&apos;re already on Pro!</h1>
        <p className="text-muted-foreground">Enjoy unlimited recipe generations and all premium features.</p>
        <Button asChild>
          <Link href="/kitchen">Back to Kitchen</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/kitchen">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Kitchen
        </Link>
      </Button>

      {/* Header */}
      <div className="text-center space-y-3">
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          IngredientBot Pro
        </Badge>
        <h1 className="text-4xl font-bold text-foreground text-balance">
          Unlimited AI recipes,<br className="hidden sm:block" /> zero limits
        </h1>
        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          Free plan gives you 5 recipes per month. Pro unlocks unlimited generations and every premium feature.
        </p>
        {usage && !usage.isPro && (
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            You&apos;ve used {usage.used} of {usage.limit} free recipes this month
            {usage.remaining === 0 ? ' — limit reached.' : '.'}
          </p>
        )}
      </div>

      {/* Plan cards */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Free */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Free</p>
            <p className="text-3xl font-bold text-foreground mt-1">$0</p>
            <p className="text-sm text-muted-foreground">Forever</p>
          </div>
          <ul className="space-y-2.5">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/kitchen">Continue Free</Link>
          </Button>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-primary bg-card p-6 space-y-6 relative overflow-hidden">
          {/* Glow accent */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-primary uppercase tracking-wide">Pro</p>
              <Badge className="text-xs gap-1">
                <Zap className="h-3 w-3" />
                Most popular
              </Badge>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-3xl font-bold text-foreground">$6</p>
              <p className="text-sm text-muted-foreground">/month</p>
            </div>
            <p className="text-sm text-muted-foreground">or $49/year (save 32%)</p>
          </div>
          <ul className="space-y-2.5">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {/* Stripe integration placeholder — Stripe not yet configured */}
          <Button className="w-full gap-2" disabled>
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
            <span className="text-xs opacity-70">(coming soon)</span>
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Pro payments powered by Stripe. Cancel anytime.
      </p>
    </div>
  )
}
