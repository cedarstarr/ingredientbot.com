import { test, expect } from '@playwright/test'

/**
 * Authenticated app-shell pages — verify each loads without 500 and shows
 * a heading. Detail-page interactions (tags, rating, print, nutrition) sit
 * behind "have at least one saved recipe" data which staging may not have,
 * so we keep this to navigation smoke tests + 404 verification.
 */

test.describe('Authenticated app shell', () => {
  test.setTimeout(60000)

  test('/dashboard, /saved, /history, /collections, /pantry all load @smoke', async ({ page }) => {
    for (const path of ['/dashboard', '/saved', '/history', '/collections', '/pantry']) {
      const res = await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      expect(res?.status(), `${path} status`).not.toBe(500)
      expect(page.url(), `${path} url`).not.toContain('/login')
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    }
  })

  test('/settings shows Sessions section + Sign Out All Devices button', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /sign out all devices/i }),
    ).toBeVisible()
  })

  test('/recipe/nonexistent-id returns 404 (not 500) @smoke', async ({ page }) => {
    const res = await page.goto('/recipe/nonexistent-id-that-does-not-exist')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    const body = await page.locator('body').textContent()
    const isNotFound = res?.status() === 404 || /404|not found/i.test(body ?? '')
    expect(isNotFound).toBe(true)
  })

  test('/meal-plan loads without error', async ({ page }) => {
    const res = await page.goto('/meal-plan')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    expect(page.url()).not.toContain('/login')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })
})
