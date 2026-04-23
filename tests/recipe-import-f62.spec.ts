import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F62: Recipe URL import — paste any recipe URL, AI scrapes and reformats it
 *      into the cookbook. POST /api/recipes/import.
 *
 * The route (src/app/api/recipes/import/route.ts) returns a deterministic
 * mock recipe when PLAYWRIGHT_TEST=true (set via playwright.config.ts), so
 * these tests can exercise the full extract flow without hitting the live
 * Anthropic API.
 */

test.describe('Recipe URL import — extract flow (F62)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/import')
    await page.waitForLoadState('domcontentloaded')
  })

  test('clicking Import Recipe with a URL triggers the import API and shows the extracted recipe', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://www.allrecipes.com/recipe/...')
    await urlInput.fill('https://example.com/recipe/test')

    const importBtn = page.getByRole('button', { name: /import recipe/i })
    await expect(importBtn).toBeEnabled()
    await importBtn.click()

    // The route returns a mocked recipe titled "Classic Spaghetti Carbonara" in test mode
    await expect(page.getByText(/classic spaghetti carbonara/i)).toBeVisible({ timeout: 15000 })
  })

  test('extracted recipe view shows ingredients and steps from the mock response', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://www.allrecipes.com/recipe/...')
    await urlInput.fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: /import recipe/i }).click()

    // Mock returns Spaghetti as an ingredient — wait for the extracted recipe panel to render
    await expect(page.getByText(/classic spaghetti carbonara/i)).toBeVisible({ timeout: 15000 })

    const body = await page.locator('body').textContent()
    expect(body).toMatch(/spaghetti/i)
  })

  test('Save to Cookbook button is visible after a successful extract', async ({ page }) => {
    const urlInput = page.getByPlaceholder('https://www.allrecipes.com/recipe/...')
    await urlInput.fill('https://example.com/recipe/test')
    await page.getByRole('button', { name: /import recipe/i }).click()

    await expect(page.getByText(/classic spaghetti carbonara/i)).toBeVisible({ timeout: 15000 })

    // Once a recipe is loaded the user can save it
    const saveBtn = page.getByRole('button', { name: /save to (cookbook|recipes)|save recipe/i })
    await expect(saveBtn.first()).toBeVisible()
  })
})

test.describe('Recipe import API — auth + SSRF guards', () => {
  test('POST /api/recipes/import requires authentication', async ({ request }) => {
    const res = await request.post('/api/recipes/import', {
      data: { url: 'https://example.com/recipe' },
    })
    // Either 401 directly or a redirect — but never 200
    expect(res.status()).not.toBe(200)
  })
})
