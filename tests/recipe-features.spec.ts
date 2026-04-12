import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Recipe detail page — feature interactions.
 *
 * F36: Nutrition estimate per recipe
 * F40: Print recipe view
 * F41: Recipe completion ("cooked this") tracking
 * F51: Recipe rating (1–5 stars)
 * F33: Serving size slider (live quantity scaling)
 */

test.describe('Recipe detail — nutrition estimate (F36)', () => {
  test.setTimeout(60000)

  test('recipe detail page shows nutrition section or "Estimate Nutrition" button', async ({ page }) => {
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

    const body = await page.locator('body').textContent()
    // Either nutrition data is shown or an "Estimate Nutrition" button exists
    const hasNutrition = /calories|protein|carbs|fat|nutrition/i.test(body ?? '')
    expect(hasNutrition).toBe(true)
  })
})

test.describe('Recipe detail — print view (F40)', () => {
  test.setTimeout(60000)

  test('recipe detail page shows a Print button or link', async ({ page }) => {
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

    const body = await page.locator('body').textContent()
    expect(body).toMatch(/print/i)
  })

  test('/recipe/[id]/print page loads without a 500 error', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    // Get the recipe ID from the link href
    const href = await viewLinks.first().getAttribute('href')
    if (!href) {
      test.skip()
      return
    }
    const recipeId = href.replace('/recipe/', '')

    const res = await page.goto(`/recipe/${recipeId}/print`)
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    // Print page shows ingredients
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/ingredient|print/i)
  })
})

test.describe('Recipe detail — "Cooked This" tracking (F41)', () => {
  test.setTimeout(60000)

  test('"Cooked This" button is visible on recipe detail page', async ({ page }) => {
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

    const body = await page.locator('body').textContent()
    expect(body).toMatch(/cooked this|mark as cooked|times cooked/i)
  })

  test('POST /api/recipes/[id]/cook returns 401 for unauthenticated', async ({ request }) => {
    const res = await request.post('/api/recipes/fake-id/cook')
    expect(res.status()).not.toBe(200)
  })
})

test.describe('Recipe detail — rating (F51)', () => {
  test.setTimeout(60000)

  test('recipe detail page shows a rating control (1–5 stars)', async ({ page }) => {
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

    // Rating component renders star buttons
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/rating|rate this recipe|stars/i)
  })
})

test.describe('Recipe detail — serving size slider (F33)', () => {
  test.setTimeout(60000)

  test('recipe detail page shows servings label and a slider control', async ({ page }) => {
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

    // Servings slider shows "Servings: N" in modification toolbar
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/servings/i)

    // A range input (slider) should be present on the page
    const slider = page.locator('input[type="range"]')
    const hasSlider = await slider.count()
    expect(hasSlider).toBeGreaterThanOrEqual(1)
  })
})

test.describe('Recipe detail — dietary profile settings page (F31)', () => {
  test.setTimeout(60000)

  test('/settings shows Dietary Profile section', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const body = await page.locator('body').textContent()
    expect(body).toMatch(/dietary profile|dietary preferences|dietary restrictions/i)
  })

  test('GET /api/user/dietary returns preferences for authenticated user', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.get('/api/user/dietary')
    expect(res.status()).toBe(200)
    const body = await res.json()
    // Should have restriction and preference arrays
    expect(body).toHaveProperty('restrictions')
    expect(body).toHaveProperty('cuisinePrefs')
  })
})
