import { test, expect } from '@playwright/test'

/**
 * Saved Recipes page — auth-gated library of the user's generated recipes.
 * Test user: test@test.com / Test1234!
 */

test.describe('Saved Recipes (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('unauthenticated visitor is redirected to /login', async ({ page }) => {
    await page.goto('/saved')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })
})

test.describe('Saved Recipes (authenticated)', () => {
  // Scoped through <main> deliberately: when Next's SSR stream closes early, the
  // resolved content is left doubled — once in <main>, once orphaned in a hidden
  // <div id="S:0"> sibling under <body>. Unscoped testids then hit two nodes and
  // trip Playwright strict mode (FOU-388; same mechanism diagnosed in padjobs FOU-389).
  test('authenticated user sees the Saved Recipes heading @smoke', async ({ page }) => {
    await page.goto('/saved')
    await expect(page.getByRole('main').getByTestId('saved-heading')).toBeVisible({ timeout: 10_000 })
  })

  test('saved page shows recipe grid or empty state', async ({ page }) => {
    await page.goto('/saved')
    const main = page.getByRole('main')
    const heading = main.getByTestId('saved-heading')
    await expect(heading).toBeVisible()
    // Either an empty-state prompt or the recipe grid is present
    const emptyState = main.getByTestId('saved-empty')
    const recipeGrid = main.locator('.grid').first()
    await expect(emptyState.or(recipeGrid)).toBeVisible({ timeout: 10_000 })
  })

  test('New Recipe CTA links to /kitchen', async ({ page }) => {
    await page.goto('/saved')
    // The "New Recipe" link is always present regardless of how many recipes exist
    const cta = page.getByRole('main').getByRole('link', { name: /new recipe/i })
    await expect(cta).toBeVisible({ timeout: 10_000 })
    await expect(cta).toHaveAttribute('href', '/kitchen')
  })
})
