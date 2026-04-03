import { test, expect, type Page } from '@playwright/test'

async function loginAsTestUser(page: Page) {
  const csrfRes = await page.request.get('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json()

  await page.request.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: 'test@test.com',
      password: 'Test1234!',
      callbackUrl: 'http://localhost:3010/kitchen',
    },
  })

  await page.goto('/kitchen')
  await page.waitForLoadState('domcontentloaded')
}

test.describe('Landing page (public)', () => {
  test('/ loads and shows a visible h1', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('Privacy page (public)', () => {
  test('/privacy loads with a visible heading', async ({ page }) => {
    await page.goto('/privacy')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('Terms page (public)', () => {
  test('/terms loads with a visible heading', async ({ page }) => {
    await page.goto('/terms')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('h1').first()).toBeVisible()
  })
})

test.describe('Authenticated pages', () => {
  test.setTimeout(60000)

  test('/dashboard loads without error and shows a heading', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).not.toContain('login')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('/kitchen loads without error and stays authenticated', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).not.toContain('login')
    // The kitchen page renders the ingredient input, not a bare h1 — check for a known element
    await expect(page.getByPlaceholder('e.g. chicken, rice, garlic...')).toBeVisible()
  })

  test('/meal-plan loads without 500 error', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/meal-plan')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).not.toContain('login')
    // Meal planner renders an h1 "Meal Planner"
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('/saved loads without 500 error', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).not.toContain('login')
    // SavedRecipesClient renders an h1
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('/settings loads without 500 error and shows Settings heading', async ({ page }) => {
    await loginAsTestUser(page)

    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    expect(page.url()).not.toContain('login')
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('/recipe/nonexistent-id returns a not-found page, not a 500', async ({ page }) => {
    await loginAsTestUser(page)

    const response = await page.goto('/recipe/nonexistent-id-that-does-not-exist')
    await page.waitForLoadState('domcontentloaded')

    // Should be a 404, not a 500 crash
    expect(response?.status()).not.toBe(500)
    // Next.js not-found pages typically include "404" or "not found" text
    const body = await page.locator('body').textContent()
    const isNotFound =
      (response?.status() === 404) ||
      /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })
})
