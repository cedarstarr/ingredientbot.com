import { test, expect } from '@playwright/test'

/**
 * Recipe Collections page — auth-gated listing with create/delete.
 * Test user: test@test.com / Test1234!
 */

test.describe('Recipe Collections (unauthenticated)', () => {
  test.use({ storageState: undefined })

  test('unauthenticated visitor is redirected to /login', async ({ page }) => {
    await page.goto('/collections')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })
})

test.describe('Recipe Collections (authenticated)', () => {
  test('authenticated user sees the Collections heading', async ({ page }) => {
    await page.goto('/collections')
    await expect(page.getByTestId('collections-heading')).toBeVisible({ timeout: 10_000 })
  })

  test('New Collection button is present and opens create dialog', async ({ page }) => {
    await page.goto('/collections')
    const newBtn = page.getByTestId('collections-new-btn')
    await expect(newBtn).toBeVisible({ timeout: 10_000 })
    await newBtn.click()
    // Dialog opens with name input
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByLabel('Name')).toBeVisible()
  })

  test('collections page shows grid or empty state', async ({ page }) => {
    await page.goto('/collections')
    const grid = page.locator('[data-testid="collections-empty"], .grid')
    const emptyState = page.getByTestId('collections-empty')
    const heading = page.getByTestId('collections-heading')
    await expect(heading).toBeVisible()
    // Tolerant: passes whether user has 0 or N collections
    await expect(emptyState.or(grid).first()).toBeVisible({ timeout: 10_000 })
  })
})
