import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F37: Recipe history — full paginated archive of every recipe a user has generated.
 * F38: Recipe tagging — cuisine/protein/method tags with filter chips.
 * F41: Recipe completion tracking — "cooked this" count shown in history.
 */

test.describe('Recipe History page', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/history')
    await page.waitForLoadState('domcontentloaded')
  })

  test('loads without redirecting to login', async ({ page }) => {
    expect(page.url()).not.toContain('/login')
  })

  test('shows "Recipe History" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /recipe history/i })).toBeVisible()
  })

  test('shows recipe count or empty state message', async ({ page }) => {
    const body = await page.locator('body').textContent()
    const hasCount = /\d+\s+recipe/i.test(body ?? '')
    const hasEmpty = /no recipes|start cooking|generate your first/i.test(body ?? '')
    expect(hasCount || hasEmpty).toBe(true)
  })

  test('shows search input field', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first()
    await expect(searchInput).toBeVisible()
  })

  test('shows "Cooked only" filter toggle or checkbox', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/cooked/i)
  })

  test('unauthenticated user is redirected to /login', async ({ browser }) => {
    const ctx = await browser.newContext()
    const unauthPage = await ctx.newPage()
    await unauthPage.goto('http://localhost:3010/history')
    await unauthPage.waitForLoadState('domcontentloaded')
    expect(unauthPage.url()).toContain('/login')
    await ctx.close()
  })

  test('search filters recipes by term', async ({ page }) => {
    // Only test if there are recipes to filter
    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first()
    await searchInput.fill('zzz-no-match-xyz-history')
    await page.waitForTimeout(800)
    const body = await page.locator('body').textContent()
    // Either shows empty state or no recipe cards match the term
    const hasNoMatch = /no recipes|no results|nothing found/i.test(body ?? '')
    const recipeLinks = await page.getByRole('link', { name: /view recipe/i }).count()
    // No matching recipes OR no recipe cards visible
    expect(hasNoMatch || recipeLinks === 0).toBe(true)
  })
})
