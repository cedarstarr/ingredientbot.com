/**
 * @description Seeds comprehensive demo data for the admin user: pantry items, dietary profile, collections, a meal plan, and recipe completions. Idempotent — safe to run multiple times. Depends on seed-admin-user.ts and seed-recipes.ts running first.
 * @tables pantry_items, dietary_profiles, recipe_collections, meal_plans, meal_plan_slots, recipe_completions
 */
import { PrismaClient, MealType } from '@prisma/client'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'cedarbarrett@gmail.com'

const PANTRY_ITEMS: { ingredient: string; daysUntilExpiry?: number }[] = [
  { ingredient: 'eggs', daysUntilExpiry: 14 },
  { ingredient: 'chicken breast', daysUntilExpiry: 3 },
  { ingredient: 'olive oil' },
  { ingredient: 'garlic' },
  { ingredient: 'yellow onion' },
  { ingredient: 'kosher salt' },
  { ingredient: 'black pepper' },
  { ingredient: 'rice' },
  { ingredient: 'pasta' },
  { ingredient: 'canned tomatoes' },
  { ingredient: 'spinach', daysUntilExpiry: 5 },
  { ingredient: 'greek yogurt', daysUntilExpiry: 10 },
  { ingredient: 'lemons', daysUntilExpiry: 21 },
  { ingredient: 'parmesan cheese', daysUntilExpiry: 30 },
  { ingredient: 'basil', daysUntilExpiry: 4 },
]

const COLLECTIONS: { name: string; description: string; color: string; recipeTitles: string[] }[] = [
  {
    name: 'Quick Weeknight',
    description: 'Recipes under 30 minutes total for busy weeknights.',
    color: '#22c55e',
    recipeTitles: ['Quick Miso Soup', 'Lemon Garlic Butter Shrimp', 'Fresh Caprese Salad', 'Spicy Middle Eastern Shakshuka'],
  },
  {
    name: 'Comfort Food',
    description: 'Hearty, satisfying meals for when you need a hug from the kitchen.',
    color: '#f97316',
    recipeTitles: ['Classic Spaghetti Bolognese', 'Mushroom Risotto', 'Traditional French Onion Soup', 'Classic American Cheeseburger'],
  },
  {
    name: 'Date Night',
    description: 'Impressive dishes worth the extra effort for a special evening.',
    color: '#a855f7',
    recipeTitles: ['Steak Frites', 'Authentic Margherita Pizza', 'Teriyaki Glazed Salmon'],
  },
]

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (!admin) throw new Error(`Admin user ${ADMIN_EMAIL} not found — run seed-admin-user.ts first`)

  // 1. Pantry items — upsert by unique (userId, ingredient)
  for (const item of PANTRY_ITEMS) {
    const expiresAt = item.daysUntilExpiry != null
      ? new Date(Date.now() + item.daysUntilExpiry * 24 * 60 * 60 * 1000)
      : null
    await prisma.pantryItem.upsert({
      where: { userId_ingredient: { userId: admin.id, ingredient: item.ingredient } },
      update: { expiresAt },
      create: { userId: admin.id, ingredient: item.ingredient, expiresAt },
    })
  }
  console.log(`✓ ${PANTRY_ITEMS.length} pantry items`)

  // 2. Dietary profile — one per user (unique userId)
  await prisma.dietaryProfile.upsert({
    where: { userId: admin.id },
    update: {
      restrictions: ['no shellfish'],
      cuisinePrefs: ['Italian', 'Mediterranean', 'Japanese', 'Thai'],
      dislikedIngredients: ['cilantro', 'licorice'],
    },
    create: {
      userId: admin.id,
      restrictions: ['no shellfish'],
      cuisinePrefs: ['Italian', 'Mediterranean', 'Japanese', 'Thai'],
      dislikedIngredients: ['cilantro', 'licorice'],
    },
  })
  console.log('✓ dietary profile')

  // 3. Collections — deduped by (userId, name) using find-then-create; schema has no unique
  for (const c of COLLECTIONS) {
    const existing = await prisma.recipeCollection.findFirst({ where: { userId: admin.id, name: c.name } })
    const collection = existing
      ?? (await prisma.recipeCollection.create({ data: { userId: admin.id, name: c.name, description: c.description, color: c.color } }))

    // Attach recipes that belong to this admin and match one of the titles
    const recipes = await prisma.recipe.findMany({
      where: { userId: admin.id, title: { in: c.recipeTitles } },
      select: { id: true },
    })
    if (recipes.length > 0) {
      await prisma.recipe.updateMany({
        where: { id: { in: recipes.map(r => r.id) } },
        data: { collectionId: collection.id },
      })
    }
  }
  console.log(`✓ ${COLLECTIONS.length} collections`)

  // 4. Meal plan for the current week — start = most recent Monday
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
  const mondayOffset = (dayOfWeek + 6) % 7 // days back to Monday
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)

  const mealPlan = await prisma.mealPlan.upsert({
    where: { userId_weekStart: { userId: admin.id, weekStart } },
    update: {},
    create: { userId: admin.id, weekStart },
  })

  // Pick some recipes to assign
  const recipeTitles = [
    { title: 'Classic Spaghetti Bolognese', day: 1, meal: 'dinner' as MealType },
    { title: 'Authentic Greek Salad', day: 1, meal: 'lunch' as MealType },
    { title: 'Thai Green Curry', day: 2, meal: 'dinner' as MealType },
    { title: 'Grilled Chicken Caesar Salad', day: 3, meal: 'lunch' as MealType },
    { title: 'Teriyaki Glazed Salmon', day: 4, meal: 'dinner' as MealType },
    { title: 'Sizzling Chicken Fajitas', day: 5, meal: 'dinner' as MealType },
  ]
  for (const rt of recipeTitles) {
    const r = await prisma.recipe.findFirst({ where: { userId: admin.id, title: rt.title }, select: { id: true } })
    if (!r) continue
    await prisma.mealPlanSlot.upsert({
      where: { mealPlanId_dayOfWeek_mealType: { mealPlanId: mealPlan.id, dayOfWeek: rt.day, mealType: rt.meal } },
      update: { recipeId: r.id },
      create: { mealPlanId: mealPlan.id, dayOfWeek: rt.day, mealType: rt.meal, recipeId: r.id },
    })
  }
  console.log('✓ meal plan with slots')

  // 5. Recipe completions — seed ~8 completions across past 21 days for streak/heatmap
  // Idempotent: clear any completions seeded by this script then re-insert (can't upsert without a unique key)
  const recentRecipes = await prisma.recipe.findMany({ where: { userId: admin.id }, take: 10, select: { id: true } })
  if (recentRecipes.length > 0) {
    // Wipe existing completions for admin from the last 30 days so re-runs don't multiply
    await prisma.recipeCompletion.deleteMany({
      where: { userId: admin.id, cookedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    })
    const daysAgo = [0, 1, 2, 4, 7, 10, 14, 18]
    for (let i = 0; i < daysAgo.length && i < recentRecipes.length; i++) {
      const cookedAt = new Date(Date.now() - daysAgo[i] * 24 * 60 * 60 * 1000)
      await prisma.recipeCompletion.create({
        data: { userId: admin.id, recipeId: recentRecipes[i].id, cookedAt },
      })
    }
    console.log(`✓ ${Math.min(daysAgo.length, recentRecipes.length)} recipe completions`)
  }

  console.log('\nDemo seed complete.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
