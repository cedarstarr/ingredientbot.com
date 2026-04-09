import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Kitchen — Photo tab (fridge photo analysis).
 * Tests the UI of the photo upload panel. Actual image analysis
 * requires a live Anthropic API key and is not tested here.
 */

test.describe('Kitchen — photo upload tab', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('Photo tab is visible in the kitchen panel', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /^photo$/i })).toBeVisible()
  })

  test('clicking the Photo tab shows the upload area', async ({ page }) => {
    await page.getByRole('tab', { name: /^photo$/i }).click()

    // After switching to the Photo tab, the upload dropzone appears
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/upload fridge photo|analyzing photo/i)
  })

  test('Type tab is also visible alongside Photo tab', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /^type$/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /^photo$/i })).toBeVisible()
  })

  test('Photo tab upload area shows supported formats text', async ({ page }) => {
    await page.getByRole('tab', { name: /^photo$/i }).click()

    const body = await page.locator('body').textContent()
    // "JPG, PNG, WebP up to 5MB" is shown in the dropzone
    expect(body).toMatch(/jpg|png|webp/i)
  })
})
