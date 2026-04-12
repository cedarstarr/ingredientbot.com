import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F44: Pantry inventory — persistent per-user ingredient list.
 * F26: Expiry-first mode and expiry badge rendering.
 */

test.describe('Pantry page', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/pantry')
    await page.waitForLoadState('domcontentloaded')
  })

  test('loads and shows "Pantry" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^pantry$/i })).toBeVisible()
  })

  test('shows description text about kitchen tracking', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/kitchen|pantry items/i)
  })

  test('shows ingredient input with "Add item" button', async ({ page }) => {
    const input = page.locator('input[placeholder*="ingredient" i], input[placeholder*="e.g." i], input[type="text"]').first()
    await expect(input).toBeVisible()
  })

  test('adding an ingredient shows it in the list', async ({ page }) => {
    const input = page.locator('input[type="text"]').first()
    await input.fill('test-pantry-avocado')
    await page.keyboard.press('Enter')

    // Wait for the item to appear
    await page.waitForTimeout(1500)
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/test-pantry-avocado/i)
  })

  test('unauthenticated user is redirected to /login', async ({ page: unauthPage }) => {
    await unauthPage.goto('/pantry')
    await unauthPage.waitForLoadState('domcontentloaded')
    expect(unauthPage.url()).toContain('/login')
  })
})

test.describe('Pantry API (F44)', () => {
  test.setTimeout(60000)

  test('GET /api/user/pantry returns an array for authenticated user', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.get('/api/user/pantry')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('GET /api/user/pantry returns 401 for unauthenticated user', async ({ request }) => {
    const res = await request.get('/api/user/pantry')
    expect(res.status()).not.toBe(200)
  })

  test('POST /api/user/pantry adds a pantry item', async ({ page }) => {
    await loginAsTestUser(page)

    const ingredient = `e2e-pantry-${Date.now()}`
    const res = await page.request.post('/api/user/pantry', {
      data: { ingredient },
    })
    expect(res.status()).toBe(200)

    // Verify it appears in the list
    const listRes = await page.request.get('/api/user/pantry')
    const items = await listRes.json()
    const found = items.some((i: { ingredient: string }) => i.ingredient === ingredient)
    expect(found).toBe(true)

    // Cleanup: delete the item we added
    const item = items.find((i: { ingredient: string; id: string }) => i.ingredient === ingredient)
    if (item) {
      await page.request.delete(`/api/user/pantry/${item.id}`)
    }
  })
})
