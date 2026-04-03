import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

test.describe('Recipe detail page — not-found handling', () => {
  test.setTimeout(60000)

  test('returns a not-found page (not a 500) for a nonexistent recipe ID', async ({ page }) => {
    await loginAsTestUser(page)

    const res = await page.goto('/recipe/clxxxxxxxxxxxxxxxxxxxxxxxxx')
    await page.waitForLoadState('domcontentloaded')

    // Must not be a 500 error
    expect(res?.status()).not.toBe(500)

    // Should be 404 or the page body contains "not found" / "404"
    const body = await page.locator('body').textContent()
    const isNotFound =
      res?.status() === 404 ||
      /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })

  test('unauthenticated user is redirected to /login when accessing a recipe URL', async ({ page }) => {
    await page.goto('/recipe/some-recipe-id')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})

test.describe('Recipe detail page — content (if a recipe exists)', () => {
  test.setTimeout(60000)

  test('saved recipes page lists recipes that link to /recipe/[id]', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    // Find any "View Recipe" links — if present, at least one must go to /recipe/...
    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    const count = await viewLinks.count()

    if (count === 0) {
      // No recipes saved — nothing to test here
      test.skip()
      return
    }

    const href = await viewLinks.first().getAttribute('href')
    expect(href).toMatch(/^\/recipe\//)
  })

  test('navigating to a valid recipe shows the recipe title as an h1', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    const count = await viewLinks.count()

    if (count === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).toMatch(/\/recipe\//)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('recipe detail page shows Ingredients and steps sections', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /ingredients/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /steps|instructions/i })).toBeVisible()
  })

  test('recipe detail page has a "Back to Kitchen" link', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('link', { name: /back to kitchen/i })).toBeVisible()
  })
})
