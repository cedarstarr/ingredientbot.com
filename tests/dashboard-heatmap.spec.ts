import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F47: Recipe completion history + streak on dashboard.
 * F69: Cooking history heatmap (GitHub contribution-style grid).
 */

test.describe('Dashboard — cooking heatmap and streak (F47, F69)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows "Cooking Activity" heatmap section', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/cooking activity|last 12 weeks/i)
  })

  test('heatmap shows cook count (even if 0)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    // "0 cooks" or "3 cooks" or "1 cook"
    expect(body).toMatch(/\d+\s+cook/i)
  })

  test('shows streak information on dashboard', async ({ page }) => {
    const body = await page.locator('body').textContent()
    // "0 day streak", "Current streak", "cooked this month", etc.
    expect(body).toMatch(/streak|cooked this month|recipes this month/i)
  })

  test('shows "recipes cooked this month" stats card', async ({ page }) => {
    const body = await page.locator('body').textContent()
    // Either a stat card like "0 recipes cooked this month" or similar
    expect(body).toMatch(/this month|cooked/i)
  })
})
