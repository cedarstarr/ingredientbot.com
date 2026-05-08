import { test, expect } from '@playwright/test'

/**
 * PWA + dark mode foundations (F42, F43).
 */

test.describe('PWA assets', () => {
  test('/manifest.json has required PWA fields and at least one icon', async ({ request }) => {
    const res = await request.get('/manifest.json')
    expect(res.status()).toBe(200)

    const manifest = await res.json()
    expect(typeof manifest.name).toBe('string')
    expect(typeof manifest.start_url).toBe('string')
    expect(typeof manifest.display).toBe('string')
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  test('/sw.js service worker is served as JS', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type'] ?? '').toMatch(/javascript|text/i)
  })

  test('/offline page renders the offline message and Saved Recipes link', async ({ page }) => {
    const res = await page.goto('/offline')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)

    const body = await page.locator('body').textContent()
    expect(body).toMatch(/offline/i)
    await expect(
      page.getByRole('link', { name: /view saved recipes/i }),
    ).toBeVisible()
  })
})
