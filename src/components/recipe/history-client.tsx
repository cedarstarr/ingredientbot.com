'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Clock, ArrowRight, Search, X, ChefHat, History,
  Camera, Tag, FolderOpen, CheckCircle2,
} from 'lucide-react'
import { DeleteRecipeButton } from '@/components/recipe/delete-recipe-button'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface HistoryRecipe {
  id: string
  title: string
  description?: string | null
  cuisine?: string | null
  difficulty?: string | null
  prepTimeMin?: number | null
  cookTimeMin?: number | null
  servings: number
  tags: string[]
  cookedCount: number
  lastCookedAt?: Date | string | null
  sourceIngredients: string[]
  fromPhoto: boolean
  createdAt: Date | string
  collection?: { id: string; name: string; color: string } | null
}

interface HistoryClientProps {
  recipes: HistoryRecipe[]
  allTags: string[]
  total: number
  currentPage: number
  totalPages: number
  initialQ: string
  initialTag: string
  initialCooked: boolean
}

export function HistoryClient({
  recipes,
  allTags,
  total,
  currentPage,
  totalPages,
  initialQ,
  initialTag,
  initialCooked,
}: HistoryClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(initialQ)

  const buildUrl = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams()
      const merged = { q: initialQ, tag: initialTag, cooked: initialCooked ? '1' : '', page: '1', ...overrides }
      for (const [k, v] of Object.entries(merged)) {
        if (v) params.set(k, v)
      }
      return `${pathname}?${params.toString()}`
    },
    [pathname, initialQ, initialTag, initialCooked],
  )

  const handleSearch = (q: string) => {
    router.push(buildUrl({ q, page: '1' }))
  }

  const handleTagFilter = (tag: string) => {
    router.push(buildUrl({ tag: tag === initialTag ? '' : tag, page: '1' }))
  }

  const handleCookedFilter = () => {
    router.push(buildUrl({ cooked: initialCooked ? '' : '1', page: '1' }))
  }

  const clearAll = () => {
    setSearch('')
    router.push(pathname)
  }

  const hasFilters = initialQ || initialTag || initialCooked

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Recipe History
          </h1>
          <p className="text-muted-foreground mt-1">
            {total} recipe{total !== 1 ? 's' : ''} generated
            {hasFilters && ' · filtered'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/kitchen">
            <ChefHat className="h-4 w-4 mr-2" />
            New Recipe
          </Link>
        </Button>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by title or ingredient…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch(search)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => handleSearch(search)}>
          Search
        </Button>
        <Button
          variant={initialCooked ? 'default' : 'outline'}
          size="sm"
          onClick={handleCookedFilter}
          className="gap-1.5"
        >
          <CheckCircle2 className="h-4 w-4" />
          Cooked
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagFilter(tag)}
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tag === initialTag
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <History className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {hasFilters ? 'No matching recipes' : 'No recipes yet'}
          </h2>
          <p className="text-muted-foreground mb-4 max-w-sm">
            {hasFilters
              ? 'Try adjusting your search or filters.'
              : 'Head to the kitchen to generate your first recipe!'}
          </p>
          {hasFilters ? (
            <Button variant="outline" onClick={clearAll}>Clear Filters</Button>
          ) : (
            <Button asChild>
              <Link href="/kitchen">Go to Kitchen</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(recipe => {
            const totalMin = (recipe.prepTimeMin || 0) + (recipe.cookTimeMin || 0)
            return (
              <div
                key={recipe.id}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title + badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link
                        href={`/recipe/${recipe.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors leading-tight"
                      >
                        {recipe.title}
                      </Link>
                      {recipe.fromPhoto && (
                        <Badge variant="outline" className="text-xs gap-1 py-0 shrink-0">
                          <Camera className="h-2.5 w-2.5" />
                          photo
                        </Badge>
                      )}
                      {recipe.cookedCount > 0 && (
                        <Badge className="text-xs gap-1 py-0 shrink-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          cooked {recipe.cookedCount}×
                        </Badge>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      {recipe.cuisine && <Badge variant="secondary" className="text-xs">{recipe.cuisine}</Badge>}
                      {recipe.difficulty && <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>}
                      {totalMin > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {totalMin}m
                        </span>
                      )}
                      {recipe.collection && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <FolderOpen className="h-3 w-3" style={{ color: recipe.collection.color }} />
                          {recipe.collection.name}
                        </span>
                      )}
                      {recipe.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {recipe.tags.slice(0, 4).map(t => (
                            <button
                              key={t}
                              onClick={() => handleTagFilter(t)}
                              className="text-xs text-primary hover:underline"
                            >
                              #{t}
                            </button>
                          ))}
                          {recipe.tags.length > 4 && (
                            <span className="text-xs text-muted-foreground">+{recipe.tags.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ingredients used */}
                    {recipe.sourceIngredients.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                        {recipe.sourceIngredients.slice(0, 6).join(', ')}
                        {recipe.sourceIngredients.length > 6 && ` +${recipe.sourceIngredients.length - 6} more`}
                      </p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <DeleteRecipeButton id={recipe.id} />
                    <span className="text-xs text-muted-foreground">{formatDate(recipe.createdAt as Date)}</span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/recipe/${recipe.id}`}>
                        View
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => router.push(buildUrl({ page: String(currentPage - 1) }))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => router.push(buildUrl({ page: String(currentPage + 1) }))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
