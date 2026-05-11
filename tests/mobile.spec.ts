import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Mobile-critical journeys — runs on iphone + android projects (gated
 * by the `@mobile` grep tag in playwright.config.ts).
 *
 * Sidebar nav is hidden on mobile, so we verify the alternate UI:
 * a visible top bar (with theme toggle) and the primary CTAs.
 */

test.describe('@mobile public pages', () => {
  test('home page renders an h1 on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })

  test('login form is usable on mobile', async ({ page }) => {
    await page.goto('/login')
    // networkidle ensures the client-rendered LoginForm has fully hydrated
    // before asserting — domcontentloaded fires too early for Suspense-wrapped components
    await page.waitForLoadState('networkidle')

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})

test.describe('@mobile authenticated', () => {
  test.setTimeout(60000)

  test('kitchen ingredient input is reachable on mobile', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')

    await expect(
      page.getByPlaceholder(
        '2 chicken thighs, broccoli, garlic, sesame oil, gochujang...',
      ),
    ).toBeVisible()
  })

  test('mobile nav surfaces the theme toggle', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // The mobile top-bar variant of ThemeToggle is the visible one.
    const toggles = page.getByTestId('theme-toggle')
    const count = await toggles.count()
    let visible = false
    for (let i = 0; i < count; i++) {
      if (await toggles.nth(i).isVisible()) {
        visible = true
        break
      }
    }
    expect(visible).toBe(true)
  })
})
