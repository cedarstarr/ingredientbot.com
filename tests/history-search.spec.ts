import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Recipe history page (F37) — search bar, filter chips, "Cooked" filter button.
 * Also smoke-tests the cooking mode 404 path (F29) for nonexistent recipe IDs.
 *
 * No AI calls or saved recipes required — the UI renders in empty state.
 */

test.describe('Recipe history search and filters (F37)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/history')
    await page.waitForLoadState('domcontentloaded')
  })

  test('history page shows search input and Search button', async ({ page }) => {
    await expect(
      page.getByPlaceholder(/search by title or ingredient/i),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /^search$/i })).toBeVisible()
  })

  test('history page shows Cooked filter button', async ({ page }) => {
    // "Cooked" toggle — always visible regardless of recipe count
    await expect(page.getByRole('button', { name: /cooked/i })).toBeVisible()
  })

  test('search input accepts text and submitting navigates with ?q= param', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search by title or ingredient/i)
    await searchInput.fill('chicken')
    await page.getByRole('button', { name: /^search$/i }).click()
    // URL should contain q=chicken after search
    await page.waitForURL(/q=chicken/, { timeout: 10_000 })
    expect(page.url()).toContain('q=chicken')
  })

  test('history heading shows total recipe count', async ({ page }) => {
    // Page always shows "X recipes generated" — value may be 0 on fresh account
    const body = await page.locator('[role="main"]').textContent()
    expect(body).toMatch(/\d+ recipe/)
  })

  test('history page has "New Recipe" link to /kitchen', async ({ page }) => {
    await expect(page.getByRole('link', { name: /new recipe/i })).toBeVisible()
  })
})

test.describe('Cooking mode (F29) — structural smoke', () => {
  test.setTimeout(60000)

  test('GET /kitchen/cook/nonexistent-id returns not-found (not 500)', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.goto('/kitchen/cook/nonexistent-id-that-does-not-exist')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    // Should render 404 or not-found page
    const body = await page.locator('body').textContent()
    const isNotFound = res?.status() === 404 || /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })

  test('unauthenticated /kitchen/cook/any-id redirects to /login', async ({ page }) => {
    await page.goto('/kitchen/cook/some-id')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})
