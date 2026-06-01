/**
 * @description Imports real recipes from TheMealDB (free API, ~300 meals) into the recipes
 *   table for the test user. Idempotent — skips recipes whose title already exists. Reuses
 *   buildRecipeRecord from seed-recipes.ts so recipeData/rawText match the app's expected shape.
 *   Attribution: recipe content sourced from TheMealDB (https://www.themealdb.com).
 * @tables Recipe
 */
import { PrismaClient } from '@prisma/client'
import { buildRecipeRecord } from './seed-recipes'

const prisma = new PrismaClient()
const API = 'https://www.themealdb.com/api/json/v1/1'

// TheMealDB has no description/timing/nutrition; map what it does provide into the
// same object shape buildRecipeRecord/buildRawText expect.
function toRecipeInput(m: any) {
  const ingredients: { name: string; amount: string; unit: string }[] = []
  for (let i = 1; i <= 20; i++) {
    const name = (m[`strIngredient${i}`] || '').trim()
    if (!name) continue
    ingredients.push({ name, amount: (m[`strMeasure${i}`] || '').trim(), unit: '' })
  }
  let steps = (m.strInstructions || '')
    .split(/\r?\n+/)
    .map((s: string) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
  if (steps.length < 2) {
    steps = (m.strInstructions || '').split(/(?<=\.)\s+/).map((s: string) => s.trim()).filter(Boolean)
  }
  return {
    title: m.strMeal,
    description: `A ${m.strArea || ''} ${(m.strCategory || 'dish').toLowerCase()} dish.`.replace(/\s+/g, ' ').trim(),
    servings: 4,
    prepTimeMin: null,
    cookTimeMin: null,
    cuisine: m.strArea || null,
    difficulty: 'medium',
    ingredients,
    steps,
    notes: m.strTags ? `Tags: ${m.strTags}` : undefined,
    nutrition: undefined,
    // extra fields (harmless if the UI ignores them; available if it reads them)
    image: m.strMealThumb || undefined,
    sourceUrl: m.strSource || undefined,
    source: 'TheMealDB',
  }
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'test@test.com' } })
  if (!user) throw new Error('test@test.com not found — run seed-test-user.ts first')

  // collect all meals by iterating first-letter search (a–z), dedupe by idMeal
  const seen = new Map<string, any>()
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    const res = await fetch(`${API}/search.php?f=${letter}`)
    const { meals } = await res.json()
    for (const m of meals || []) seen.set(m.idMeal, m)
  }
  console.log(`fetched ${seen.size} unique meals from TheMealDB`)

  const existingTitles = new Set(
    (await prisma.recipe.findMany({ select: { title: true } })).map((r) => r.title)
  )

  let created = 0, skipped = 0
  for (const m of seen.values()) {
    if (!m.strMeal || !m.strInstructions) { skipped++; continue }
    if (existingTitles.has(m.strMeal)) { skipped++; continue }
    const r = toRecipeInput(m)
    if (!r.ingredients.length || !r.steps.length) { skipped++; continue }
    await prisma.recipe.create({ data: buildRecipeRecord(r as any, user.id) })
    existingTitles.add(m.strMeal)
    created++
  }
  console.log(`done — created ${created}, skipped ${skipped} (existing/incomplete)`)
  console.log(`total recipes now: ${await prisma.recipe.count()}`)
  await prisma.$disconnect()
}

if (require.main === module) {
  main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
}
