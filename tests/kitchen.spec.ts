import { test, expect } from '@playwright/test'

/**
 * Core kitchen-page journey — the heart of the product.
 * The current UI is a single textarea (comma/newline-separated) with
 * a Find recipes CTA gated on 2+ ingredients, plus a Snap fridge upload.
 */

const KITCHEN_PLACEHOLDER =
  '2 chicken thighs, broccoli, garlic, sesame oil, gochujang...'

test.describe('Kitchen — ingredient input journey', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('ingredient textarea is visible and accepts input', async ({ page }) => {
    const input = page.getByPlaceholder(KITCHEN_PLACEHOLDER)
    await expect(input).toBeVisible()
    await input.fill('chicken, rice')
    await expect(input).toHaveValue('chicken, rice')
  })

  test('Find recipes button is gated until 2+ ingredients are entered', async ({ page }) => {
    const input = page.getByPlaceholder(KITCHEN_PLACEHOLDER)
    const btn = page.getByRole('button', { name: /find recipes/i })

    // Empty textarea — disabled
    await expect(btn).toBeDisabled()

    // One ingredient — still disabled
    await input.fill('chicken')
    await expect(btn).toBeDisabled()

    // Two ingredients — enabled
    await input.fill('chicken, rice')
    await expect(btn).toBeEnabled()
  })

  test('Snap fridge button is visible for photo upload', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /snap fridge/i }),
    ).toBeVisible()
  })

  test('Find recipes click does not navigate away from /kitchen', async ({ page }) => {
    // Mock the AI endpoint so we don't burn tokens on a real generation
    await page.route('/api/recipes/generate', async (route) => {
      const fakeNdjson =
        JSON.stringify({
          id: 'r1',
          title: 'Quick Chicken Rice',
          description: 'Test',
          cuisine: 'Asian',
          difficulty: 'Easy',
          prepTimeMin: 10,
          cookTimeMin: 20,
          servings: 2,
          matchScore: 90,
          missingIngredients: [],
        }) + '\n'
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: fakeNdjson,
      })
    })

    await page.getByPlaceholder(KITCHEN_PLACEHOLDER).fill('chicken, rice')
    await page.getByRole('button', { name: /find recipes/i }).click()
    await page.waitForTimeout(500)
    expect(page.url()).toContain('/kitchen')
  })
})
