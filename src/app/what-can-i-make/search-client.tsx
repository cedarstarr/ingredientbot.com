'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { X, Loader2, Clock, ChefHat, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDuration } from '@/lib/recipe-format'

interface Suggestion {
  slug: string
  name: string
  category: string
  isStaple: boolean
}

interface SearchResult {
  id: string
  title: string
  publicSlug: string | null
  cuisine: string | null
  difficulty: string | null
  prepTimeMin: number | null
  cookTimeMin: number | null
  extras: number
  totalIngredients: number
}

interface SearchResponse {
  results: SearchResult[]
  hasMore: boolean
  matchedOn: string[]
  ignoredStaples: string[]
  unknown: string[]
}

const PAGE_SIZE = 24

/** "Cook this now" reads better than "0 more ingredients". */
function tierLabel(extras: number): string {
  if (extras === 0) return 'Cook this now'
  if (extras === 1) return 'Add 1 more ingredient'
  return `Add ${extras} more ingredients`
}

export function ReverseSearchClient() {
  const [chips, setChips] = useState<Suggestion[]>([])
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [open, setOpen] = useState(false)
  const [vegetarianOnly, setVegetarianOnly] = useState(false)

  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  // ---------------------------------------------------------------- suggest
  useEffect(() => {
    const q = query.trim()
    // Below two characters there is nothing to fetch. Returning WITHOUT clearing
    // state is deliberate: clearing here would be a synchronous setState in an
    // effect body (cascading render). `visibleSuggestions` derives the empty
    // list instead, which is the same result with one render.
    if (q.length < 2) return
    // Abort in flight on every keystroke: without this a slow early response
    // can land after a faster later one and repopulate the list with stale
    // suggestions for a query the user has already moved past.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/ingredients?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as { results: Suggestion[] }
        const chosen = new Set(chips.map((c) => c.slug))
        setSuggestions(data.results.filter((r) => !chosen.has(r.slug)))
        setHighlighted(0)
        setOpen(true)
      } catch {
        // Aborted or offline — leave the previous suggestions in place rather
        // than flashing an empty dropdown at the user.
      }
    }, 180)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, chips])

  // ----------------------------------------------------------------- search
  const runSearch = useCallback(
    async (activeChips: Suggestion[], veg: boolean, offset: number, signal?: AbortSignal) => {
      const have = activeChips.map((c) => c.slug).join(',')
      const params = new URLSearchParams({ have, limit: String(PAGE_SIZE), offset: String(offset) })
      if (veg) params.set('filter', 'vegetarian')
      const res = await fetch(`/api/search/recipes?${params}`, { signal })
      if (!res.ok) throw new Error(`search failed: ${res.status}`)
      return (await res.json()) as SearchResponse
    },
    [],
  )

  useEffect(() => {
    // Same reasoning as the suggestion effect: no chips means nothing to search,
    // and the stale response is derived away by `shown` rather than cleared here.
    if (!chips.length) return
    const controller = new AbortController()
    // Marking the request in flight before it starts. The rule guards against
    // cascading renders, which needs the effect to depend on what it sets —
    // this effect's deps are chips/vegetarianOnly/runSearch, none of which
    // `loading` or `error` feed, so there is no loop to cause. Writing it any
    // other way would only hide the flag from the linter, not improve it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    runSearch(chips, vegetarianOnly, 0, controller.signal)
      .then((data) => {
        setResponse(data)
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        console.error(err)
        setError('Search is unavailable right now. Please try again.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [chips, vegetarianOnly, runSearch])

  const loadMore = async () => {
    if (!response || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await runSearch(chips, vegetarianOnly, response.results.length)
      setResponse({ ...next, results: [...response.results, ...next.results] })
    } catch {
      setError('Could not load more results.')
    } finally {
      setLoadingMore(false)
    }
  }

  // ------------------------------------------------------------------ chips
  const addChip = (s: Suggestion) => {
    setChips((prev) => (prev.some((c) => c.slug === s.slug) ? prev : [...prev, s]))
    setQuery('')
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const removeChip = (slug: string) => {
    setChips((prev) => prev.filter((c) => c.slug !== slug))
    inputRef.current?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && visibleSuggestions.length) {
      e.preventDefault()
      setOpen(true)
      setHighlighted((h) => (h + 1) % visibleSuggestions.length)
    } else if (e.key === 'ArrowUp' && visibleSuggestions.length) {
      e.preventDefault()
      setHighlighted((h) => (h - 1 + visibleSuggestions.length) % visibleSuggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && visibleSuggestions[highlighted]) addChip(visibleSuggestions[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Backspace' && !query && chips.length) {
      // Emptying the box then pressing backspace removes the last chip — the
      // behaviour people already expect from every tag input.
      removeChip(chips[chips.length - 1].slug)
    }
  }

  // Derived rather than stored, so emptying the chips or the input clears the UI
  // without an extra state write (see the effects above).
  const visibleSuggestions = query.trim().length >= 2 ? suggestions : []
  const shown = chips.length ? response : null
  const shownError = chips.length ? error : null
  const tiers = groupByTier(shown?.results ?? [])

  return (
    <div data-testid="reverse-search">
      {/* ------------------------------------------------------- composer */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <label htmlFor="ingredient-input" className="text-sm font-medium text-foreground">
          What is in your kitchen?
        </label>

        <div className="relative mt-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
            {chips.map((c) => (
              <span
                key={c.slug}
                data-testid="ingredient-chip"
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary dark:bg-primary/20"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => removeChip(c.slug)}
                  aria-label={`Remove ${c.name}`}
                  data-testid="ingredient-chip-remove"
                  className="rounded-sm opacity-60 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}

            <Input
              id="ingredient-input"
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              onFocus={() => visibleSuggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              placeholder={chips.length ? 'Add another…' : 'Start typing — eggs, onion, rice…'}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              autoComplete="off"
              data-testid="ingredient-input"
              className="h-8 min-w-[10rem] flex-1 border-0 bg-transparent p-0 px-1 shadow-none focus-visible:ring-0"
            />
          </div>

          {open && visibleSuggestions.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              data-testid="ingredient-suggestions"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
            >
              {visibleSuggestions.map((s, i) => (
                <li key={s.slug} role="option" aria-selected={i === highlighted}>
                  <button
                    type="button"
                    // onMouseDown, not onClick: the input's blur fires first and
                    // would close the list before a click could land.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      addChip(s)
                    }}
                    onMouseEnter={() => setHighlighted(i)}
                    data-testid="ingredient-suggestion"
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                      i === highlighted ? 'bg-accent/20 text-foreground' : 'text-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      {s.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.isStaple ? 'pantry staple' : s.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={vegetarianOnly}
              onChange={(e) => setVegetarianOnly(e.target.checked)}
              data-testid="filter-vegetarian"
              className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            Vegetarian only
          </label>
          {chips.length > 0 && (
            <button
              type="button"
              onClick={() => setChips([])}
              data-testid="clear-ingredients"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear all
            </button>
          )}
        </div>

        {shown && shown.ignoredStaples.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="staples-note">
            Pantry staples don&apos;t narrow a search — we assume you have{' '}
            {shown.ignoredStaples.join(', ')}.
          </p>
        )}
        {shown && shown.unknown.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="unknown-note">
            We don&apos;t have {shown.unknown.join(', ')} in our ingredient list yet.
          </p>
        )}
      </div>

      {/* -------------------------------------------------------- results */}
      <div className="mt-8">
        {!chips.length && (
          <p className="text-sm text-muted-foreground" data-testid="reverse-search-empty">
            Add an ingredient or two and we&apos;ll show you what you can cook, starting with the
            recipes that need nothing else.
          </p>
        )}

        {shownError && (
          <p className="text-sm text-destructive" data-testid="reverse-search-error">
            {shownError}
          </p>
        )}

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="reverse-search-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </p>
        )}

        {!loading && !shownError && chips.length > 0 && shown?.results.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center" data-testid="reverse-search-none">
            <ChefHat className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Nothing uses all of those together.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try removing an ingredient — every result has to contain all of them.
            </p>
          </div>
        )}

        {!loading && tiers.map(([extras, group]) => (
          <section key={extras} className="mb-8" data-testid="result-tier">
            <h2
              className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
              data-testid="result-tier-heading"
            >
              {tierLabel(extras)}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {group.length}
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((r) => (
                <ResultCard key={r.id} recipe={r} />
              ))}
            </div>
          </section>
        ))}

        {shown?.hasMore && !loading && (
          <div className="mt-2 text-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} data-testid="load-more">
              {loadingMore ? 'Loading…' : 'Show more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Results arrive already ordered by extras, so a single pass groups them. */
function groupByTier(results: SearchResult[]): [number, SearchResult[]][] {
  const map = new Map<number, SearchResult[]>()
  for (const r of results) {
    const list = map.get(r.extras) ?? []
    list.push(r)
    map.set(r.extras, list)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
}

function ResultCard({ recipe }: { recipe: SearchResult }) {
  const totalMin = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0)
  return (
    <Link
      href={`/r/${recipe.publicSlug}`}
      data-testid="reverse-search-card"
      className="group flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <h3 className="text-balance text-sm font-semibold text-foreground transition-colors line-clamp-2 group-hover:text-primary">
        {recipe.title}
      </h3>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs text-muted-foreground">
        {recipe.cuisine && (
          <Badge variant="secondary" className="text-xs">
            {recipe.cuisine}
          </Badge>
        )}
        {totalMin > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(totalMin)}
          </span>
        )}
        <span className="ml-auto">{recipe.totalIngredients} ingredients</span>
      </div>
    </Link>
  )
}

