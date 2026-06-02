import { test, expect } from '@playwright/test'

test.describe('Auth utility pages', () => {
  test('/forgot-password renders email form', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByRole('main')).not.toContainText(/internal server error/i)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'))
    ).toBeVisible()
  })

  test('/reset-password renders without server error', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByRole('main')).not.toContainText(/internal server error/i)
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
  })

  test('/verify-email renders without server error', async ({ page }) => {
    await page.goto('/verify-email')
    await expect(page.getByRole('main')).not.toContainText(/internal server error/i)
  })
})
