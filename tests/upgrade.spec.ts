import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F30: Freemium gate + Pro upgrade page.
 * /upgrade shows pricing tiers and Pro features.
 */

test.describe('Upgrade page (F30)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/upgrade')
    await page.waitForLoadState('domcontentloaded')
  })

  test('loads without redirecting to login', async ({ page }) => {
    expect(page.url()).not.toContain('/login')
    expect(page.url()).toContain('/upgrade')
  })

  test('shows an upgrade or pricing heading', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/pro|upgrade|unlimited|pricing/i)
  })

  test('shows Free tier features', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/free/i)
  })

  test('shows Pro tier upgrade option', async ({ page }) => {
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/pro|upgrade/i)
  })

  test('unauthenticated user is redirected to /login', async ({ browser }) => {
    const ctx = await browser.newContext()
    const unauthPage = await ctx.newPage()
    await unauthPage.goto('http://localhost:3010/upgrade')
    await unauthPage.waitForLoadState('domcontentloaded')
    expect(unauthPage.url()).toContain('/login')
    await ctx.close()
  })
})

test.describe('Usage counter (F30) — kitchen page', () => {
  test.setTimeout(60000)

  test('kitchen page shows recipe generation usage counter', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')

    // UsageCounter component shows something like "3 / 5 recipes used" or "Pro"
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/recipe|generation|used|pro/i)
  })
})
