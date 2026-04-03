import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

test.describe('Dashboard page', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows a welcome heading with the user name or generic greeting', async ({ page }) => {
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    const text = await h1.textContent()
    expect(text).toMatch(/welcome/i)
  })

  test('shows saved recipe count in the welcome copy', async ({ page }) => {
    // "You have X saved recipe(s)." is always present
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/\d+\s+saved recipe/i)
  })

  test('shows "Go to Kitchen" quick action button', async ({ page }) => {
    await expect(page.getByRole('link', { name: /go to kitchen/i })).toBeVisible()
  })

  test('shows "View All" saved recipes button', async ({ page }) => {
    await expect(page.getByRole('link', { name: /view all/i })).toBeVisible()
  })

  test('"Go to Kitchen" link navigates to /kitchen', async ({ page }) => {
    await page.getByRole('link', { name: /go to kitchen/i }).click()
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/kitchen')
  })
})
