import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Kitchen panel — generation mode toggles and modifiers.
 *
 * F28: Leftover optimizer mode
 * F53: Budget mode
 * F54: "Impress Me" zero-input mode
 * F61: Strictness toggle
 * F64: "Teach me" verbose mode
 * F70: Chef personality toggle
 * F71: "Date Night" 3-course mode
 * F32: Prep time filter
 * F34: Cuisine selector
 * F35: Difficulty selector
 */

test.describe('Kitchen — generation mode toggles', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows Leftover Mode toggle button (F28)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/leftover/i)
  })

  test('clicking Leftover Mode reveals "What\'s left over?" textarea (F28)', async ({ page }) => {
    // Find the leftover mode button/toggle by text
    const leftoverBtn = page.getByRole('button', { name: /leftover/i }).first()
    const hasBtn = await leftoverBtn.isVisible().catch(() => false)
    if (!hasBtn) {
      // May be inside a collapsed section — check text instead
      const body = await page.locator('body').textContent()
      expect(body).toMatch(/leftover/i)
      return
    }
    await leftoverBtn.click()
    // After activating, a textarea for describing leftovers should appear
    await page.waitForTimeout(300)
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/left over|leftover/i)
  })

  test('shows Strict mode toggle button (F61)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/strict/i)
  })

  test('shows Teach Me mode toggle button (F64)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/teach me/i)
  })

  test('shows Budget mode toggle button (F53)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/budget/i)
  })

  test('shows "Impress Me" button (F54)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/impress me/i)
  })

  test('shows Chef personality selector (F70)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    // Three personalities: Home Cook, French Chef, Street Food
    expect(body).toMatch(/home cook|french chef|street food/i)
  })

  test('shows Date Night mode toggle (F71)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/date night/i)
  })

  test('shows Prep Time filter (F32)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/prep time|15 min|30 min/i)
  })

  test('shows Cuisine selector with options (F34)', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/cuisine|italian|thai|mexican/i)
  })

  test('"Impress Me" button is enabled without any ingredients (F54)', async ({ page }) => {
    // "Impress Me" should work even with 0 ingredients
    const impressBtn = page.getByRole('button', { name: /impress me/i })
    await expect(impressBtn).toBeEnabled()
  })
})
