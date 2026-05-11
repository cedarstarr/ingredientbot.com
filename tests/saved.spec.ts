import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Saved Recipes page — auth-gated library of the user's generated recipes.
 * Test user: test@test.com / Test1234!
 */

test('unauthenticated visitor is redirected to /login', async ({ page }) => {
  await page.goto('/saved')
  await page.waitForURL(/\/login/, { timeout: 10_000 })
})

test('authenticated user sees the Saved Recipes heading', async ({ page }) => {
  await loginAsTestUser(page)
  await page.goto('/saved')
  await expect(page.getByTestId('saved-heading')).toBeVisible({ timeout: 10_000 })
})

test('saved page shows recipe grid or empty state', async ({ page }) => {
  await loginAsTestUser(page)
  await page.goto('/saved')
  const heading = page.getByTestId('saved-heading')
  await expect(heading).toBeVisible()
  // Either an empty-state prompt or the recipe grid is present
  const emptyState = page.getByTestId('saved-empty')
  const recipeGrid = page.locator('.grid').first()
  await expect(emptyState.or(recipeGrid)).toBeVisible({ timeout: 10_000 })
})

test('New Recipe CTA links to /kitchen', async ({ page }) => {
  await loginAsTestUser(page)
  await page.goto('/saved')
  // The "New Recipe" link is always present regardless of how many recipes exist
  const cta = page.getByRole('link', { name: /new recipe/i })
  await expect(cta).toBeVisible({ timeout: 10_000 })
  await expect(cta).toHaveAttribute('href', '/kitchen')
})
