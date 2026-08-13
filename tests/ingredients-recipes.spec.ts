import { test, expect } from '@playwright/test'

/**
 * Public content pages — ingredient glossary index + detail, and the shared
 * recipe browse page. No auth required (unlike most of the app shell).
 *
 * /ingredients/apple is used as the known-slug fixture for the detail route:
 * confirmed present on staging via a direct DB read (5 seeded rows —
 * apple/banana/lemon/lime/orange) rather than assumed from the ~360-item
 * seed-ingredient-ai.ts default list, which has NOT been run against staging.
 */

test.describe('Ingredient glossary', () => {
  test('/ingredients renders heading and ingredient cards @smoke', async ({ page }) => {
    const res = await page.goto('/ingredients')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)

    await expect(page.getByTestId('ingredients-index-heading')).toBeVisible()

    // Data-dependent: assert whichever of the two states the client renders,
    // rather than assuming staging always has ingredients seeded.
    const cards = page.getByTestId('ingredients-index-card')
    const emptyState = page.getByTestId('ingredients-empty-state')
    await expect(cards.first().or(emptyState)).toBeVisible()
  })

  test('/ingredients/apple renders the ingredient detail page', async ({ page }) => {
    const res = await page.goto('/ingredients/apple')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)

    await expect(page.getByTestId('ingredient-detail-heading')).toHaveText(/apple/i)
  })

  test('/ingredients/nonexistent-slug returns 404 (not 500)', async ({ page }) => {
    const res = await page.goto('/ingredients/nonexistent-slug-that-does-not-exist')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    const body = await page.locator('body').textContent()
    const isNotFound = res?.status() === 404 || /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })
})

test.describe('Recipe browse', () => {
  test('/recipes renders heading and recipe cards or empty state @smoke', async ({ page }) => {
    const res = await page.goto('/recipes')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)

    await expect(page.getByTestId('recipes-browse-heading')).toBeVisible()

    const cards = page.getByTestId('recipes-browse-card')
    const emptyState = page.getByTestId('recipes-empty-state')
    await expect(cards.first().or(emptyState)).toBeVisible()
  })

  test('/recipes?cuisine= filters to a single cuisine section', async ({ page }) => {
    // Discover a real cuisine from the overview page rather than hardcoding
    // one — cuisine mix on staging is seed-dependent.
    await page.goto('/recipes')
    await page.waitForLoadState('domcontentloaded')

    const cards = page.getByTestId('recipes-browse-card')
    const cardCount = await cards.count()
    test.skip(cardCount === 0, 'No public recipes seeded on this environment')

    const viewAllLink = page.getByRole('link', { name: /view all/i }).first()
    const hasViewAll = await viewAllLink.count()
    test.skip(hasViewAll === 0, 'Fewer than PER_SECTION recipes in every cuisine — no "View all" link to follow')

    await viewAllLink.click()
    await page.waitForURL(/cuisine=/)
    await expect(page.getByTestId('recipes-browse-heading')).toBeVisible()
  })
})
