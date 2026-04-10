'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, FolderOpen, Clock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Recipe {
  id: string
  title: string
  description?: string | null
  cuisine?: string | null
  difficulty?: string | null
  prepTimeMin?: number | null
  cookTimeMin?: number | null
  tags: string[]
  cookedCount: number
  createdAt: string
}

interface Collection {
  id: string
  name: string
  description?: string | null
  color: string
  recipes: Recipe[]
}

interface Props {
  collection: Collection
}

export function CollectionDetailClient({ collection }: Props) {
  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/collections">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Collections
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: collection.color + '20' }}
        >
          <FolderOpen className="h-6 w-6" style={{ color: collection.color }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{collection.name}</h1>
          {collection.description && (
            <p className="text-muted-foreground text-sm mt-0.5">{collection.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {collection.recipes.length} recipe{collection.recipes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Recipes */}
      {collection.recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No recipes in this collection yet. Open any recipe and use the collection picker to add it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collection.recipes.map(recipe => {
            const totalMin = (recipe.prepTimeMin || 0) + (recipe.cookTimeMin || 0)
            return (
              <div
                key={recipe.id}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/recipe/${recipe.id}`}
                    className="font-semibold text-foreground hover:text-primary transition-colors leading-tight"
                  >
                    {recipe.title}
                  </Link>
                  {recipe.cookedCount > 0 && (
                    <Badge className="text-xs gap-1 py-0 shrink-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {recipe.cookedCount}×
                    </Badge>
                  )}
                </div>
                {recipe.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {recipe.cuisine && <Badge variant="secondary" className="text-xs">{recipe.cuisine}</Badge>}
                  {recipe.difficulty && <Badge variant="outline" className="text-xs">{recipe.difficulty}</Badge>}
                  {totalMin > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {totalMin}m
                    </span>
                  )}
                  {recipe.tags.slice(0, 3).map(t => (
                    <span key={t} className="text-xs text-primary">#{t}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(new Date(recipe.createdAt))}</span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/recipe/${recipe.id}`}>
                      View
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
