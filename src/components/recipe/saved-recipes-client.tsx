'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChefHat, BookOpen, Clock, ArrowRight, Search, X, Star } from 'lucide-react'
import { DeleteRecipeButton } from '@/components/recipe/delete-recipe-button'
import { ShareRecipeButton } from '@/components/recipe/share-recipe-button'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface SavedRecipe {
  id: string
  title: string
  description?: string | null
  cuisine?: string | null
  difficulty?: string | null
  prepTimeMin?: number | null
  cookTimeMin?: number | null
  servings: number
  createdAt: Date
  isPublic: boolean
  publicSlug?: string | null
  rating?: number | null  // F51
}

interface SavedRecipesClientProps {
  recipes: SavedRecipe[]
}

const CUISINES = ['Any', 'Italian', 'Asian', 'Mexican', 'Mediterranean', 'American', 'Indian', 'French']
const DIFFICULTIES = ['Any', 'Easy', 'Medium', 'Hard']

export function SavedRecipesClient({ recipes }: SavedRecipesClientProps) {
  const [search, setSearch] = useState('')
  const [cuisine, setCuisine] = useState('Any')
  const [difficulty, setDifficulty] = useState('Any')
  // F51: Favorites filter — only show recipes rated 4 or 5 stars
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const filtered = useMemo(() => {
    return recipes.filter(r => {
      const matchesSearch =
        !search || r.title.toLowerCase().includes(search.toLowerCase())
      const matchesCuisine =
        cuisine === 'Any' ||
        (r.cuisine?.toLowerCase() === cuisine.toLowerCase())
      const matchesDifficulty =
        difficulty === 'Any' ||
        (r.difficulty?.toLowerCase() === difficulty.toLowerCase())
      const matchesFavorites = !favoritesOnly || (r.rating !== null && r.rating !== undefined && r.rating >= 4)
      return matchesSearch && matchesCuisine && matchesDifficulty && matchesFavorites
    })
  }, [recipes, search, cuisine, difficulty, favoritesOnly])

  const hasFilters = search !== '' || cuisine !== 'Any' || difficulty !== 'Any' || favoritesOnly

  const clearFilters = () => {
    setSearch('')
    setCuisine('Any')
    setDifficulty('Any')
    setFavoritesOnly(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
            <span>Saved Recipes</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/kitchen">
            <ChefHat className="h-4 w-4 mr-2" />
            New Recipe
          </Link>
        </Button>
      </div>

      {/* Filters */}
      {recipes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search recipes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={cuisine} onValueChange={setCuisine}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Cuisine" />
            </SelectTrigger>
            <SelectContent>
              {CUISINES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* F51: Favorites filter — show only 4–5 star recipes */}
          <Button
            variant={favoritesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFavoritesOnly(v => !v)}
            className="gap-1.5"
            aria-pressed={favoritesOnly}
          >
            <Star className={cn('h-3.5 w-3.5', favoritesOnly && 'fill-current')} />
            Favorites
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Results */}
      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No saved recipes yet</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Head to the kitchen, add your ingredients, and cook your first recipe!
          </p>
          <Button asChild>
            <Link href="/kitchen">Go to Kitchen</Link>
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No matching recipes</h2>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Try adjusting your search or filters.
          </p>
          <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(recipe => {
            const totalMin = (recipe.prepTimeMin || 0) + (recipe.cookTimeMin || 0)
            return (
              <div
                key={recipe.id}
                className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground leading-tight">{recipe.title}</h3>
                    {/* F51: star rating display */}
                    {recipe.rating !== null && recipe.rating !== undefined && (
                      <div className="flex items-center gap-0.5 mt-1" aria-label={`Rated ${recipe.rating} out of 5 stars`}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star
                            key={s}
                            className={cn(
                              'h-3.5 w-3.5',
                              s <= recipe.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30',
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ShareRecipeButton
                      recipeId={recipe.id}
                      initialIsPublic={recipe.isPublic}
                      initialSlug={recipe.publicSlug}
                    />
                    <DeleteRecipeButton id={recipe.id} />
                  </div>
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
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(recipe.createdAt)}</span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/recipe/${recipe.id}`}>
                      View Recipe
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
