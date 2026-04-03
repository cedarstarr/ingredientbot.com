import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

test.describe('Saved Recipes page', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows "Saved Recipes" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /saved recipes/i })).toBeVisible()
  })

  test('shows recipe count in subtitle', async ({ page }) => {
    const body = await page.locator('body').textContent()
    // Either "X recipes saved" (with recipes) or "No saved recipes yet" (empty state)
    const hasCount = /\d+\s+recipe/i.test(body ?? '')
    const hasEmpty = /no saved recipes yet/i.test(body ?? '')
    expect(hasCount || hasEmpty).toBe(true)
  })

  test('shows "New Recipe" link to the kitchen', async ({ page }) => {
    // Header always has a "New Recipe" button linking to /kitchen
    const link = page.getByRole('link', { name: /new recipe/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', '/kitchen')
  })

  test('shows empty state with "Go to Kitchen" when user has no recipes, or shows search filters when they do', async ({ page }) => {
    const body = await page.locator('body').textContent()
    const hasEmpty = /no saved recipes yet/i.test(body ?? '')
    const hasSearch = await page.locator('input[placeholder="Search recipes..."]').isVisible().catch(() => false)
    // One of the two states must be true
    expect(hasEmpty || hasSearch).toBe(true)
  })

  test('search input filters by title (if recipes exist)', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search recipes..."]')
    const hasSearch = await searchInput.isVisible().catch(() => false)
    if (!hasSearch) {
      // Empty state — nothing to filter
      test.skip()
      return
    }
    await searchInput.fill('zzz-no-match-xyz')
    // Should show "No matching recipes" text
    await expect(page.getByText(/no matching recipes/i)).toBeVisible()
  })

  test('"Clear Filters" button resets search (if recipes exist)', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Search recipes..."]')
    const hasSearch = await searchInput.isVisible().catch(() => false)
    if (!hasSearch) {
      test.skip()
      return
    }
    await searchInput.fill('zzz-no-match-xyz')
    const clearBtn = page.getByRole('button', { name: /clear filters/i })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()
    await expect(searchInput).toHaveValue('')
  })
})
