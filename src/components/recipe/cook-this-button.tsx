'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * "Cook this" on a public library recipe: copies it into the visitor's own
 * collection and opens it, where the AI modifier toolbar works.
 *
 * A CLIENT component on purpose. Its host page (/r/[slug]) carries
 * `revalidate = 3600`, and calling auth() there to decide what to render would
 * make a public, SEO-bearing page dynamic for every visitor. So the button
 * renders identically for everyone and lets the API answer the auth question:
 * 401 means send them to sign in, and the fork happens on the way back.
 */
export function CookThisButton({ recipeId, slug }: { recipeId: string; slug: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'working' | 'limit' | 'error'>('idle')

  const onClick = async () => {
    setState('working')
    try {
      const res = await fetch(`/api/recipes/${recipeId}/fork`, { method: 'POST' })

      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/r/${slug}`)}`)
        return
      }
      if (res.status === 402) {
        setState('limit')
        return
      }
      if (!res.ok) {
        setState('error')
        return
      }

      const { id } = (await res.json()) as { id: string; existing: boolean }
      // Either way this opens THEIR copy — an existing fork is reused rather
      // than duplicated, so a second click costs nothing off the monthly cap.
      router.push(`/recipe/${id}`)
    } catch {
      setState('error')
    }
  }

  if (state === 'limit') {
    return (
      <div className="text-center" data-testid="cook-this-limit">
        <p className="text-sm text-foreground">
          You have used all 5 free recipes this month.
        </p>
        <Button asChild size="lg" className="mt-3">
          <Link href="/upgrade">See your options</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <Button size="lg" onClick={onClick} disabled={state === 'working'} data-testid="cook-this">
        {state === 'working' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding to your recipes…
          </>
        ) : (
          <>
            Cook this
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
      {state === 'error' && (
        <p className="mt-2 text-sm text-destructive" data-testid="cook-this-error">
          Could not add that recipe. Please try again.
        </p>
      )}
    </div>
  )
}
