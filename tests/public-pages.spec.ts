import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('/ landing renders an h1', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  test('/privacy renders an h1', async ({ page }) => {
    await page.goto('/privacy')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  test('/terms renders an h1', async ({ page }) => {
    await page.goto('/terms')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  test('/robots.txt is served', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body.toLowerCase()).toMatch(/user-agent/)
  })

  test('/sitemap.xml is served', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toMatch(/<urlset|<sitemapindex/)
  })
})
